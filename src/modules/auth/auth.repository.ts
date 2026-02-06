import { prisma } from "../../lib/prisma";

export const authRepository = {
  findUserByEmail: (email: string) =>
    prisma.user.findFirst({
      where: { email, deletedAt: null }
    }),
  createUserWithOrg: (data: { email: string; name: string; passwordHash: string; organizationName: string }) =>
    prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash
        }
      });
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          memberships: {
            create: {
              userId: user.id,
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
      });
      return { user, organization };
    }),
  getPrimaryMembership: (userId: string) =>
    prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" }
    }),
  getMembership: (userId: string, organizationId: string) =>
    prisma.membership.findFirst({
      where: { userId, organizationId }
    })
};
