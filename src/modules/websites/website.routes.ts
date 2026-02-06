import { Elysia } from "elysia";
import { websiteController } from "./website.controller";
import { createWebsiteDto, updateWebsiteDto, domainDto } from "./website.dto";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { requireRole } from "../../middleware/rbac";

export const websiteRoutes = new Elysia({ prefix: "/websites" })
  .post("/", async ({ body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: authUser.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    requireRole("ADMIN", membership.role);
    return websiteController.createWebsite({
      organizationId: authUser.organizationId,
      name: body.name,
      widgetConfig: body.widgetConfig,
      aiEnabled: body.aiEnabled ?? true,
      domains: body.domains,
      userId: authUser.sub
    });
  }, { body: createWebsiteDto })
  .patch("/:websiteId", async ({ params, body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: authUser.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    requireRole("ADMIN", membership.role);
    return websiteController.updateWebsite({
      organizationId: authUser.organizationId,
      websiteId: params.websiteId,
      name: body.name,
      widgetConfig: body.widgetConfig,
      aiEnabled: body.aiEnabled
    });
  }, { body: updateWebsiteDto })
  .post("/:websiteId/domains", async ({ params, body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: authUser.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    requireRole("ADMIN", membership.role);
    return websiteController.addDomain({
      organizationId: authUser.organizationId,
      websiteId: params.websiteId,
      domain: body.domain
    });
  }, { body: domainDto });
