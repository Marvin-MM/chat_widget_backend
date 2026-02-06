import { prisma } from "../../lib/prisma";
import type { Role } from "@prisma/client";

export const organizationRepository = {
  createOrganization: (data: { name: string; iconUrl?: string | null; ownerId: string }) =>
    prisma.organization.create({
      data: {
        name: data.name,
        iconUrl: data.iconUrl ?? null,
        memberships: {
          create: {
            userId: data.ownerId,
            role: "OWNER"
          }
        },
        billing: {
          create: {
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        },
        retentionPolicy: {
          create: {}
        }
      }
    }),
  createInvitation: (data: { organizationId: string; email: string; role: Role; token: string }) =>
    prisma.invitation.create({
      data: {
        organizationId: data.organizationId,
        email: data.email,
        role: data.role,
        token: data.token
      }
    }),
  updateMembershipRole: (organizationId: string, userId: string, role: Role) =>
    prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role }
    }),
  removeMembership: (organizationId: string, userId: string) =>
    prisma.membership.delete({
      where: { userId_organizationId: { userId, organizationId } }
    }),
  updateOrganization: (organizationId: string, data: { name?: string; iconUrl?: string | null }) =>
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: data.name,
        iconUrl: data.iconUrl
      }
    }),
  findInvitationByToken: (token: string) =>
    prisma.invitation.findFirst({
      where: { token, acceptedAt: null, deletedAt: null }
    }),
  acceptInvitation: (invitationId: string) =>
    prisma.invitation.update({
      where: { id: invitationId },
      data: { acceptedAt: new Date() }
    }),
  createUser: (data: { email: string; name: string; passwordHash: string }) =>
    prisma.user.create({
      data
    }),
  createMembership: (organizationId: string, userId: string, role: Role) =>
    prisma.membership.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      update: { role },
      create: { organizationId, userId, role }
    })
};
