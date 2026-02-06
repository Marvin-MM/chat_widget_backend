import { organizationRepository } from "./organization.repository";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden } from "../../lib/errors";
import { auditService } from "../audit/audit.service";
import type { Role } from "@prisma/client";
import { queues } from "../../lib/queues";
import { hashPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";

export const organizationService = {
  createOrganization: async (input: { name: string; iconUrl?: string | null; ownerId: string }) => {
    const org = await organizationRepository.createOrganization(input);
    await auditService.log({
      action: "ORG_CREATE",
      organizationId: org.id,
      userId: input.ownerId,
      metadata: { name: org.name }
    });
    return org;
  },
  inviteMember: async (input: { organizationId: string; inviterRole: Role; email: string; role: Role }) => {
    if (input.inviterRole !== "OWNER" && input.inviterRole !== "ADMIN") {
      throw forbidden("Only owners or admins can invite members");
    }
    await prisma.invitation.updateMany({
      where: { organizationId: input.organizationId, email: input.email, deletedAt: null },
      data: { deletedAt: new Date() }
    });
    const token = crypto.randomUUID();
    const invite = await organizationRepository.createInvitation({
      organizationId: input.organizationId,
      email: input.email,
      role: input.role,
      token
    });
    await queues.email.add("invite", {
      to: input.email,
      token,
      organizationId: input.organizationId
    });
    await auditService.log({
      action: "ORG_INVITE",
      organizationId: input.organizationId,
      metadata: { email: input.email, role: input.role }
    });
    return invite;
  },
  assignRole: async (input: { organizationId: string; actorRole: Role; userId: string; role: Role }) => {
    if (input.actorRole !== "OWNER" && input.actorRole !== "ADMIN") {
      throw forbidden("Insufficient permissions");
    }
    return organizationRepository.updateMembershipRole(input.organizationId, input.userId, input.role);
  },
  removeMember: async (input: { organizationId: string; actorRole: Role; userId: string }) => {
    if (input.actorRole !== "OWNER" && input.actorRole !== "ADMIN") {
      throw forbidden("Insufficient permissions");
    }
    await organizationRepository.removeMembership(input.organizationId, input.userId);
    await auditService.log({
      action: "ORG_MEMBER_REMOVE",
      organizationId: input.organizationId,
      metadata: { userId: input.userId }
    });
    return { removed: true };
  },
  updateBranding: async (input: { organizationId: string; actorRole: Role; name?: string; iconUrl?: string | null }) => {
    if (input.actorRole !== "OWNER" && input.actorRole !== "ADMIN") {
      throw forbidden("Insufficient permissions");
    }
    if (!input.name && !input.iconUrl) {
      throw badRequest("No branding fields provided");
    }
    return organizationRepository.updateOrganization(input.organizationId, {
      name: input.name,
      iconUrl: input.iconUrl
    });
  },
  acceptInvitation: async (input: { token: string; name: string; password: string }) => {
    const invitation = await organizationRepository.findInvitationByToken(input.token);
    if (!invitation) {
      throw badRequest("Invitation not found");
    }
    const existingUser = await prisma.user.findFirst({ where: { email: invitation.email, deletedAt: null } });
    const user =
      existingUser ??
      (await organizationRepository.createUser({
        email: invitation.email,
        name: input.name,
        passwordHash: await hashPassword(input.password)
      }));
    await organizationRepository.createMembership(invitation.organizationId, user.id, invitation.role);
    await organizationRepository.acceptInvitation(invitation.id);
    await auditService.log({
      action: "ORG_INVITE",
      organizationId: invitation.organizationId,
      userId: user.id,
      metadata: { accepted: true }
    });
    return { organizationId: invitation.organizationId, userId: user.id };
  }
};
