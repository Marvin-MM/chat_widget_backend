import { widgetRepository } from "./widget.repository";
import { badRequest, notFound } from "../../lib/errors";
import { signJwt, widgetTokenTtl, type WidgetPayload } from "../../lib/jwt";
import { redis } from "../../lib/redis";
import { streamKeys } from "../../lib/streams";
import { billingService } from "../billing/billing.service";

const normalizeDomain = (domain: string) => domain.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();

export const widgetService = {
  bootstrap: async (input: { websiteId: string; domain: string; externalVisitorId?: string }) => {
    const website = await widgetRepository.getWebsiteWithDomains(input.websiteId);
    if (!website) {
      throw notFound("Website not found");
    }
    const normalized = normalizeDomain(input.domain);
    const allowed = website.domains.some((entry) => normalizeDomain(entry.domain) === normalized && !entry.deletedAt);
    if (!allowed) {
      throw badRequest("Domain not allowed");
    }
    const externalId = input.externalVisitorId ?? crypto.randomUUID();
    const visitor = (await widgetRepository.findVisitor(website.id, externalId)) ??
      (await widgetRepository.createVisitor(website.id, externalId));
    await billingService.enforceLimits(website.organizationId);
    const session = await widgetRepository.createSession(website.id, visitor.id);
    await billingService.incrementUsage(website.organizationId, "activeChats", 1);
    await redis.xadd(streamKeys.chatSessions, "*", "websiteId", website.id, "sessionId", session.id, "visitorId", visitor.id);
    const token = await signJwt<WidgetPayload>(
      "widget",
      { sub: visitor.id, websiteId: website.id, sessionId: session.id },
      widgetTokenTtl
    );
    return {
      websiteId: website.id,
      sessionId: session.id,
      visitorId: visitor.id,
      widgetConfig: website.widgetConfig,
      aiEnabled: website.aiEnabled,
      token
    };
  }
};
