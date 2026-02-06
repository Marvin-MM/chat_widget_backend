import { prisma } from "../../lib/prisma";

export const websiteRepository = {
  createWebsite: (data: { organizationId: string; name: string; widgetConfig: object; aiEnabled: boolean; domains: string[] }) =>
    prisma.website.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        widgetConfig: data.widgetConfig,
        aiEnabled: data.aiEnabled,
        domains: {
          create: data.domains.map((domain) => ({ domain }))
        }
      }
    }),
  updateWebsite: (websiteId: string, organizationId: string, data: { name?: string; widgetConfig?: object; aiEnabled?: boolean }) =>
    prisma.website.update({
      where: { id: websiteId, organizationId },
      data
    }),
  addDomain: (websiteId: string, domain: string) =>
    prisma.websiteDomain.create({
      data: {
        websiteId,
        domain
      }
    }),
  getWebsite: (websiteId: string, organizationId: string) =>
    prisma.website.findFirst({
      where: { id: websiteId, organizationId, deletedAt: null },
      include: { domains: true }
    })
};
