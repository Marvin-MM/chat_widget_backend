import { organizationService } from "./organization.service";

export const organizationController = {
  createOrganization: organizationService.createOrganization,
  inviteMember: organizationService.inviteMember,
  assignRole: organizationService.assignRole,
  removeMember: organizationService.removeMember,
  updateBranding: organizationService.updateBranding,
  acceptInvitation: organizationService.acceptInvitation
};
