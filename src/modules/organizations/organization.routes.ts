import { Elysia } from "elysia";
import { organizationController } from "./organization.controller";
import { createOrgDto, inviteDto, assignRoleDto, removeMemberDto, brandingDto, acceptInviteDto } from "./organization.dto";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";

export const organizationRoutes = new Elysia({ prefix: "/organizations" })
  .post("/", async ({ body, authUser }) => {
    requireAuth(authUser);
    return organizationController.createOrganization({
      name: body.name,
      iconUrl: body.iconUrl ?? null,
      ownerId: authUser.sub
    });
  }, { body: createOrgDto })
  .post("/:organizationId/invite", async ({ params, body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: params.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    return organizationController.inviteMember({
      organizationId: params.organizationId,
      inviterRole: membership.role,
      email: body.email,
      role: body.role
    });
  }, { body: inviteDto })
  .post("/:organizationId/roles", async ({ params, body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: params.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    return organizationController.assignRole({
      organizationId: params.organizationId,
      actorRole: membership.role,
      userId: body.userId,
      role: body.role
    });
  }, { body: assignRoleDto })
  .delete("/:organizationId/members", async ({ params, body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: params.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    return organizationController.removeMember({
      organizationId: params.organizationId,
      actorRole: membership.role,
      userId: body.userId
    });
  }, { body: removeMemberDto })
  .patch("/:organizationId/branding", async ({ params, body, authUser }) => {
    requireAuth(authUser);
    const membership = await prisma.membership.findFirst({
      where: { userId: authUser.sub, organizationId: params.organizationId }
    });
    if (!membership) {
      throw notFound("Organization not found");
    }
    return organizationController.updateBranding({
      organizationId: params.organizationId,
      actorRole: membership.role,
      name: body.name,
      iconUrl: body.iconUrl ?? null
    });
  }, { body: brandingDto })
  .post("/invitations/accept", async ({ body }) => organizationController.acceptInvitation(body), { body: acceptInviteDto });
