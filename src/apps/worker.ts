import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { streamKeys, consumerGroups } from "../lib/streams";
import { prisma } from "../lib/prisma";
import type { MessageVisibility, SenderType } from "@prisma/client";
import { logger } from "../lib/logger";
import { queues } from "../lib/queues";
import { emailService } from "../lib/email";
import { billingService } from "../modules/billing/billing.service";
import { billingFlushIntervalSeconds } from "../config/env";

const ensureGroup = async () => {
  try {
    await redis.xgroup("CREATE", streamKeys.chatMessages, consumerGroups.persistence, "$", "MKSTREAM");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
      throw error;
    }
  }
};

const parseFields = (fields: string[]) => {
  const result: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    result[fields[i]] = fields[i + 1];
  }
  return result;
};

const persistMessage = async (data: Record<string, string>) => {
  const website = await prisma.website.findFirst({
    where: { id: data.websiteId },
    select: { organizationId: true }
  });
  if (!website) {
    return;
  }
  const senderType = data.senderType as SenderType;
  const visibility = data.visibility as MessageVisibility;
  await prisma.message.create({
    data: {
      sessionId: data.sessionId,
      websiteId: data.websiteId,
      senderType,
      senderId: data.senderId || null,
      content: data.content,
      visibility
    }
  });
  await billingService.incrementUsage(website.organizationId, "messages", 1);
  await redis.xadd(
    streamKeys.analytics,
    "*",
    "websiteId",
    data.websiteId,
    "type",
    "message",
    "sessionId",
    data.sessionId,
    "senderType",
    data.senderType
  );
};

const streamConsumer = async () => {
  await ensureGroup();
  while (true) {
    const streams = await redis.xreadgroup(
      "GROUP",
      consumerGroups.persistence,
      "persistence-worker",
      "BLOCK",
      5000,
      "COUNT",
      10,
      "STREAMS",
      streamKeys.chatMessages,
      ">"
    );
    if (!streams) continue;
    for (const [, entries] of streams) {
      for (const [id, fields] of entries) {
        const data = parseFields(fields as string[]);
        try {
          await persistMessage(data);
          await redis.xack(streamKeys.chatMessages, consumerGroups.persistence, id);
        } catch (error) {
          logger.error({ error }, "message_persist_failed");
          await queues.persistence.add("persist-message", { data }, { attempts: 5, backoff: { type: "exponential", delay: 1000 } });
          await redis.xack(streamKeys.chatMessages, consumerGroups.persistence, id);
        }
      }
    }
  }
};

const ensureAnalyticsGroup = async () => {
  try {
    await redis.xgroup("CREATE", streamKeys.analytics, consumerGroups.analytics, "$", "MKSTREAM");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
      throw error;
    }
  }
};

const analyticsConsumer = async () => {
  await ensureAnalyticsGroup();
  while (true) {
    const streams = await redis.xreadgroup(
      "GROUP",
      consumerGroups.analytics,
      "analytics-worker",
      "BLOCK",
      5000,
      "COUNT",
      10,
      "STREAMS",
      streamKeys.analytics,
      ">"
    );
    if (!streams) continue;
    for (const [, entries] of streams) {
      for (const [id, fields] of entries) {
        const data = parseFields(fields as string[]);
        await prisma.analyticsEvent.create({
          data: {
            websiteId: data.websiteId,
            type: data.type,
            payload: { sessionId: data.sessionId, senderType: data.senderType }
          }
        });
        await queues.analytics.add(
          "aggregate",
          { websiteId: data.websiteId, type: data.type },
          { removeOnComplete: true }
        );
        await redis.xack(streamKeys.analytics, consumerGroups.analytics, id);
      }
    }
  }
};

const setupWorkers = () => {
  new Worker(
    "email",
    async (job) => {
      if (job.name === "invite") {
        await emailService.sendInvite(job.data as { to: string; token: string; organizationId: string });
      }
    },
    { connection: redis.duplicate() }
  );

  new Worker(
    "persistence",
    async (job) => {
      const payload = job.data as { data: Record<string, string> };
      await persistMessage(payload.data);
    },
    { connection: redis.duplicate() }
  );

  new Worker(
    "billing",
    async () => {
      const organizations = await prisma.billingProfile.findMany({
        select: { organizationId: true, periodStart: true, periodEnd: true }
      });
      for (const org of organizations) {
        const usage = await redis.hgetall(`billing:usage:${org.organizationId}`);
        await prisma.usageSnapshot.create({
          data: {
            organizationId: org.organizationId,
            periodStart: org.periodStart,
            periodEnd: org.periodEnd,
            messagesCount: Number(usage.messages ?? 0),
            activeChats: Number(usage.activeChats ?? 0),
            aiInvocations: Number(usage.aiInvocations ?? 0)
          }
        });
      }
    },
    { connection: redis.duplicate() }
  );

  new Worker(
    "analytics",
    async (job) => {
      const payload = job.data as { websiteId: string; type: string };
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await prisma.analyticsAggregate.upsert({
        where: { websiteId_type_date: { websiteId: payload.websiteId, type: payload.type, date: today } },
        update: { count: { increment: 1 } },
        create: { websiteId: payload.websiteId, type: payload.type, date: today, count: 1 }
      });
    },
    { connection: redis.duplicate() }
  );

  new Worker(
    "webhook",
    async (job) => {
      const payload = job.data as { url: string; body: unknown; headers?: Record<string, string> };
      await fetch(payload.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(payload.headers ?? {}) },
        body: JSON.stringify(payload.body)
      });
    },
    { connection: redis.duplicate() }
  );
};

const scheduleBillingFlush = () => {
  setInterval(() => {
    queues.billing.add("flush", {}, { removeOnComplete: true });
  }, billingFlushIntervalSeconds * 1000);
};

const scheduleRetentionCleanup = () => {
  setInterval(async () => {
    const policies = await prisma.retentionPolicy.findMany();
    for (const policy of policies) {
      const messageCutoff = new Date(Date.now() - policy.messageRetentionDays * 24 * 60 * 60 * 1000);
      const sessionCutoff = new Date(Date.now() - policy.sessionRetentionDays * 24 * 60 * 60 * 1000);
      await prisma.message.updateMany({
        where: { website: { organizationId: policy.organizationId }, deletedAt: null, createdAt: { lt: messageCutoff } },
        data: { deletedAt: new Date() }
      });
      await prisma.session.updateMany({
        where: { website: { organizationId: policy.organizationId }, deletedAt: null, createdAt: { lt: sessionCutoff } },
        data: { deletedAt: new Date() }
      });
    }
  }, 24 * 60 * 60 * 1000);
};

streamConsumer().catch((error) => {
  logger.error({ error }, "stream_consumer_failed");
  process.exit(1);
});

analyticsConsumer().catch((error) => {
  logger.error({ error }, "analytics_consumer_failed");
  process.exit(1);
});

setupWorkers();
scheduleBillingFlush();
scheduleRetentionCleanup();
