import { prisma } from "../../lib/prisma";

export const widgetRepository = {
  getWebsiteWithDomains: (websiteId: string) =>
    prisma.website.findFirst({
      where: { id: websiteId, deletedAt: null },
      include: { domains: true }
    }),
  findVisitor: (websiteId: string, externalId: string) =>
    prisma.visitor.findFirst({
      where: { websiteId, externalId, deletedAt: null }
    }),
  createVisitor: (websiteId: string, externalId: string) =>
    prisma.visitor.create({
      data: { websiteId, externalId }
    }),
  createSession: (websiteId: string, visitorId: string) =>
    prisma.session.create({
      data: { websiteId, visitorId }
    })
};
