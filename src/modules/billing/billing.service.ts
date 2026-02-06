import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { forbidden } from "../../lib/errors";
import { auditService } from "../audit/audit.service";

const usageKey = (organizationId: string) => `billing:usage:${organizationId}`;

export const billingService = {
  enforceLimits: async (organizationId: string) => {
    const profile = await prisma.billingProfile.findFirst({ where: { organizationId } });
    if (!profile) {
      throw forbidden("Billing profile not found");
    }
    const usage = await redis.hgetall(usageKey(organizationId));
    const messages = Number(usage.messages ?? 0);
    const aiInvocations = Number(usage.aiInvocations ?? 0);
    const activeChats = Number(usage.activeChats ?? 0);

    if (messages >= profile.messagesLimit || aiInvocations >= profile.aiLimit || activeChats >= profile.activeChatsLimit) {
      await auditService.log({
        action: "BILLING_LIMIT_REACHED",
        organizationId,
        metadata: { messages, aiInvocations, activeChats }
      });
      throw forbidden("Billing limits exceeded");
    }
  },
  incrementUsage: async (organizationId: string, field: "messages" | "aiInvocations" | "activeChats", amount = 1) => {
    await redis.hincrby(usageKey(organizationId), field, amount);
    const ttl = await redis.ttl(usageKey(organizationId));
    if (ttl < 0) {
      const profile = await prisma.billingProfile.findFirst({ where: { organizationId } });
      if (profile) {
        await redis.expireat(usageKey(organizationId), Math.floor(profile.periodEnd.getTime() / 1000));
      }
    }
  }
};
