import { chatRepository } from "./chat.repository";
import { notFound, forbidden } from "../../lib/errors";
import { redis } from "../../lib/redis";
import { streamKeys } from "../../lib/streams";
import type { MessageVisibility, SenderType } from "@prisma/client";
import { auditService } from "../audit/audit.service";

export const chatService = {
  sendAgentMessage: async (input: {
    organizationId: string;
    sessionId: string;
    content: string;
    senderId: string;
    visibility: MessageVisibility;
  }) => {
    const session = await chatRepository.getSessionScoped(input.organizationId, input.sessionId);
    if (!session) {
      throw notFound("Session not found");
    }
    if (input.visibility === "INTERNAL") {
      await auditService.log({
        action: "MESSAGE_INTERNAL_NOTE",
        organizationId: session.website.organizationId,
        userId: input.senderId,
        metadata: { sessionId: session.id }
      });
    }
    await redis.xadd(
      streamKeys.chatMessages,
      "*",
      "websiteId",
      session.websiteId,
      "sessionId",
      session.id,
      "senderType",
      "AGENT",
      "senderId",
      input.senderId,
      "content",
      input.content,
      "visibility",
      input.visibility
    );
    return { queued: true };
  },
  addTag: async (input: { organizationId: string; sessionId: string; tag: string }) => {
    const session = await chatRepository.getSessionScoped(input.organizationId, input.sessionId);
    if (!session) {
      throw notFound("Session not found");
    }
    const tag = await chatRepository.upsertTag(session.websiteId, input.tag);
    await chatRepository.addTagToSession(session.id, tag.id);
    return { tagged: true };
  },
  assignSession: async (input: { organizationId: string; sessionId: string; agentId: string }) => {
    const session = await chatRepository.getSessionScoped(input.organizationId, input.sessionId);
    if (!session) {
      throw notFound("Session not found");
    }
    await chatRepository.assignSession(session.id, input.agentId);
    return { assigned: true };
  },
  publishVisitorMessage: async (input: {
    websiteId: string;
    sessionId: string;
    senderId: string;
    content: string;
    senderType: SenderType;
    visibility: MessageVisibility;
  }) => {
    await redis.xadd(
      streamKeys.chatMessages,
      "*",
      "websiteId",
      input.websiteId,
      "sessionId",
      input.sessionId,
      "senderType",
      input.senderType,
      "senderId",
      input.senderId,
      "content",
      input.content,
      "visibility",
      input.visibility
    );
    return { queued: true };
  },
  enforceNoVisitorInternalNote: (visibility: MessageVisibility, senderType: SenderType) => {
    if (visibility === "INTERNAL" && senderType !== "AGENT") {
      throw forbidden("Internal messages are restricted to agents");
    }
  }
};
