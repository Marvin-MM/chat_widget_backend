import { websiteRepository } from "./website.repository";
import { notFound } from "../../lib/errors";
import { auditService } from "../audit/audit.service";

export const websiteService = {
  createWebsite: async (input: {
    organizationId: string;
    name: string;
    widgetConfig: object;
    aiEnabled: boolean;
    domains: string[];
    userId: string;
  }) => {
    const website = await websiteRepository.createWebsite({
      organizationId: input.organizationId,
      name: input.name,
      widgetConfig: input.widgetConfig,
      aiEnabled: input.aiEnabled,
      domains: input.domains
    });
    await auditService.log({
      action: "WEBSITE_CREATE",
      organizationId: input.organizationId,
      userId: input.userId,
      metadata: { websiteId: website.id }
    });
    return website;
  },
  updateWebsite: async (input: {
    organizationId: string;
    websiteId: string;
    name?: string;
    widgetConfig?: object;
    aiEnabled?: boolean;
  }) => {
    const website = await websiteRepository.updateWebsite(input.websiteId, input.organizationId, {
      name: input.name,
      widgetConfig: input.widgetConfig,
      aiEnabled: input.aiEnabled
    });
    if (!website) {
      throw notFound("Website not found");
    }
    return website;
  },
  addDomain: async (input: { organizationId: string; websiteId: string; domain: string }) => {
    const website = await websiteRepository.getWebsite(input.websiteId, input.organizationId);
    if (!website) {
      throw notFound("Website not found");
    }
    return websiteRepository.addDomain(input.websiteId, input.domain);
  },
  getWebsite: (organizationId: string, websiteId: string) => websiteRepository.getWebsite(websiteId, organizationId)
};
