import { redis } from "../lib/redis";
import { streamKeys, consumerGroups } from "../lib/streams";
import { prisma } from "../lib/prisma";
import { aiClient } from "../lib/ai";
import { logger } from "../lib/logger";
import { metrics } from "../lib/metrics";
import { billingService } from "../modules/billing/billing.service";

const ensureGroup = async () => {
  try {
    await redis.xgroup("CREATE", streamKeys.aiTasks, consumerGroups.ai, "$", "MKSTREAM");
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

const handler = async () => {
  await ensureGroup();
  while (true) {
    const streams = await redis.xreadgroup(
      "GROUP",
      consumerGroups.ai,
      "ai-worker",
      "BLOCK",
      5000,
      "COUNT",
      10,
      "STREAMS",
      streamKeys.aiTasks,
      ">"
    );
    if (!streams) continue;
    for (const [, entries] of streams) {
      for (const [id, fields] of entries) {
        const data = parseFields(fields as string[]);
        const website = await prisma.website.findFirst({ where: { id: data.websiteId } });
        if (!website) {
          await redis.xack(streamKeys.aiTasks, consumerGroups.ai, id);
          continue;
        }
        const recentMessages = await prisma.message.findMany({
          where: { sessionId: data.sessionId, visibility: "PUBLIC", deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10
        });
        const context = recentMessages.reverse().map((message) => message.content);
        const prompt =
          "You are an AI assistant for a customer support chat. Decide whether to reply, ask clarification, or escalate to a human. Return strict JSON with keys action (reply|clarify|escalate) and message.";
        const timer = metrics.aiLatency.startTimer();
        const response = await aiClient.generate(prompt, [data.content, ...context]);
        timer();
        let action = "reply";
        let message = response;
        try {
          const parsed = JSON.parse(response) as { action?: string; message?: string };
          if (parsed.action && parsed.message) {
            action = parsed.action;
            message = parsed.message;
          }
        } catch {
          // fallback to raw response
        }
        if (action === "escalate") {
          await redis.xadd(
            streamKeys.chatMessages,
            "*",
            "websiteId",
            data.websiteId,
            "sessionId",
            data.sessionId,
            "senderType",
            "SYSTEM",
            "senderId",
            "",
            "content",
            "AI requested human escalation",
            "visibility",
            "INTERNAL"
          );
        } else {
          await redis.xadd(
            streamKeys.chatMessages,
            "*",
            "websiteId",
            data.websiteId,
            "sessionId",
            data.sessionId,
            "senderType",
            "AI",
            "senderId",
            "",
            "content",
            message,
            "visibility",
            "PUBLIC"
          );
        }
        await billingService.incrementUsage(website.organizationId, "aiInvocations", 1);
        await redis.xack(streamKeys.aiTasks, consumerGroups.ai, id);
      }
    }
  }
};

handler().catch((error) => {
  logger.error({ error }, "ai_worker_failed");
  process.exit(1);
});
