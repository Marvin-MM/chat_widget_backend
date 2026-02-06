import { websiteService } from "./website.service";

export const websiteController = {
  createWebsite: websiteService.createWebsite,
  updateWebsite: websiteService.updateWebsite,
  addDomain: websiteService.addDomain,
  getWebsite: websiteService.getWebsite
};
