import { Elysia } from "elysia";
import type { ServerWebSocket } from "bun";
import { verifyJwt, type AccessPayload, type WidgetPayload } from "../lib/jwt";
import { logger } from "../lib/logger";
import { redis, redisSubscriber } from "../lib/redis";
import { streamKeys } from "../lib/streams";
import { metrics } from "../lib/metrics";
import { prisma } from "../lib/prisma";
import { chatService } from "../modules/chat/chat.service";
import { billingService } from "../modules/billing/billing.service";

interface WsSession {
  websiteId: string;
  sessionId?: string;
  userId: string;
  role: "agent" | "widget";
}

const connections = new Map<string, Set<ServerWebSocket<WsSession>>>();

const countConnections = () => {
  let total = 0;
  for (const set of connections.values()) {
    total += set.size;
  }
  return total;
};

const addConnection = (websiteId: string, ws: ServerWebSocket<WsSession>) => {
  const set = connections.get(websiteId) ?? new Set();
  set.add(ws);
  connections.set(websiteId, set);
  metrics.wsConnections.set(countConnections());
};

const removeConnection = (websiteId: string, ws: ServerWebSocket<WsSession>) => {
  const set = connections.get(websiteId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    connections.delete(websiteId);
  }
  metrics.wsConnections.set(countConnections());
};

const broadcast = (websiteId: string, payload: object) => {
  const set = connections.get(websiteId);
  if (!set) return;
  for (const ws of set) {
    ws.send(JSON.stringify(payload));
  }
};

const parseFields = (fields: string[]) => {
  const result: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    result[fields[i]] = fields[i + 1];
  }
  return result;
};

const streamFanout = async () => {
  let lastId = "$";
  while (true) {
    const streams = await redisSubscriber.xread("BLOCK", 5000, "STREAMS", streamKeys.chatMessages, lastId);
    if (!streams) continue;
    for (const [, entries] of streams) {
      for (const [id, fields] of entries) {
        lastId = id;
        const data = parseFields(fields as string[]);
        const set = connections.get(data.websiteId);
        if (!set) continue;
        for (const ws of set) {
          const session = ws.data as WsSession | undefined;
          if (!session) continue;
          if (data.visibility === "INTERNAL" && session.role === "widget") {
            continue;
          }
          ws.send(
            JSON.stringify({
              type: "message",
              sessionId: data.sessionId,
              senderType: data.senderType,
              senderId: data.senderId,
              content: data.content,
              visibility: data.visibility
            })
          );
        }
      }
    }
  }
};

const parseToken = async (token: string, type: string, websiteId?: string): Promise<WsSession> => {
  if (type === "widget") {
    const payload = await verifyJwt<WidgetPayload>("widget", token);
    return { websiteId: payload.websiteId, sessionId: payload.sessionId, userId: payload.sub, role: "widget" };
  }
  const payload = await verifyJwt<AccessPayload>("access", token);
  if (!websiteId) {
    throw new Error("websiteId is required");
  }
  const website = await prisma.website.findFirst({
    where: { id: websiteId, organizationId: payload.organizationId }
  });
  if (!website) {
    throw new Error("website_not_found");
  }
  return { websiteId: website.id, userId: payload.sub, role: "agent" };
};

const app = new Elysia().ws("/ws", {
  open: async (ws, context) => {
    const token = context.query.token;
    const type = context.query.type;
    const websiteId = context.query.websiteId;
    if (!token || !type) {
      ws.close();
      return;
    }
    try {
      const session = await parseToken(token, type, websiteId);
      ws.data = session;
      addConnection(session.websiteId, ws);
      await redis.hset(`presence:${session.websiteId}`, session.userId, "online");
      broadcast(session.websiteId, { type: "presence", userId: session.userId, status: "online" });
    } catch (error) {
      logger.warn({ error }, "ws_auth_failed");
      ws.close();
    }
  },
  close: async (ws) => {
    const data = ws.data as WsSession | undefined;
    if (!data) return;
    removeConnection(data.websiteId, ws);
    await redis.hdel(`presence:${data.websiteId}`, data.userId);
    broadcast(data.websiteId, { type: "presence", userId: data.userId, status: "offline" });
  },
  message: async (ws, message) => {
    const data = ws.data as WsSession | undefined;
    if (!data) {
      ws.send(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    const payload = typeof message === "string" ? JSON.parse(message) : message;
    if (payload.type === "typing") {
      broadcast(data.websiteId, { type: "typing", userId: data.userId, sessionId: data.sessionId });
      return;
    }
    if (payload.type === "message") {
      if (!data.sessionId) {
        ws.send(JSON.stringify({ error: "missing_session" }));
        return;
      }
      const visibility = payload.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC";
      const senderType = data.role === "widget" ? "VISITOR" : "AGENT";
      chatService.enforceNoVisitorInternalNote(visibility, senderType);
      const website = await prisma.website.findFirst({
        where: { id: data.websiteId },
        select: { organizationId: true, aiEnabled: true }
      });
      if (website) {
        await billingService.enforceLimits(website.organizationId);
      }
      await chatService.publishVisitorMessage({
        websiteId: data.websiteId,
        sessionId: data.sessionId,
        senderId: data.userId,
        content: payload.content,
        senderType,
        visibility
      });
      metrics.messageRate.inc();
      if (website?.aiEnabled && senderType === "VISITOR") {
        await redis.xadd(
          streamKeys.aiTasks,
          "*",
          "websiteId",
          data.websiteId,
          "sessionId",
          data.sessionId,
          "content",
          payload.content
        );
      }
    }
  }
});

streamFanout().catch((error) => {
  logger.error({ error }, "ws_fanout_failed");
});

app.listen(3001);
logger.info({ port: 3001 }, "ws_listening");
