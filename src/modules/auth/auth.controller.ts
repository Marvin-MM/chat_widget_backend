import { authService } from "./auth.service";

export const authController = {
  register: authService.register,
  login: authService.login,
  refresh: (refreshToken: string) => authService.refresh(refreshToken),
  switchOrganization: (userId: string, organizationId: string) => authService.switchOrganization(userId, organizationId)
};
