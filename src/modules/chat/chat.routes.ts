import { Elysia } from "elysia";
import { chatController } from "./chat.controller";
import { sendMessageDto, assignDto, tagDto } from "./chat.dto";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { requireRole } from "../../middleware/rbac";
import { billingService } from "../billing/billing.service";

export const chatRoutes = new Elysia({ prefix: "/chat" })
  .post("/messages", async ({ body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: authUser.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    requireRole("AGENT", membership.role);
    await billingService.enforceLimits(authUser.organizationId);
    return chatController.sendAgentMessage({
      organizationId: authUser.organizationId,
      sessionId: body.sessionId,
      content: body.content,
      senderId: authUser.sub,
      visibility: body.visibility ?? "PUBLIC"
    });
  }, { body: sendMessageDto })
  .post("/assign", async ({ body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: authUser.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    requireRole("ADMIN", membership.role);
    return chatController.assignSession({
      organizationId: authUser.organizationId,
      sessionId: body.sessionId,
      agentId: body.agentId
    });
  }, { body: assignDto })
  .post("/tags", async ({ body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: authUser.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    requireRole("AGENT", membership.role);
    return chatController.addTag({
      organizationId: authUser.organizationId,
      sessionId: body.sessionId,
      tag: body.tag
    });
  }, { body: tagDto });
