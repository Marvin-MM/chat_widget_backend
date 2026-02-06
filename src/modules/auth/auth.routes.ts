import { Elysia } from "elysia";
import { authController } from "./auth.controller";
import { loginDto, refreshDto, registerDto, switchOrgDto } from "./auth.dto";
import { requireAuth } from "../../middleware/auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/register", async ({ body }) => authController.register(body), { body: registerDto })
  .post("/login", async ({ body }) => authController.login(body), { body: loginDto })
  .post("/refresh", async ({ body }) => authController.refresh(body.refreshToken), { body: refreshDto })
  .post(
    "/switch-org",
    async ({ body, authUser }) => {
      requireAuth(authUser);
      return authController.switchOrganization(authUser.sub, body.organizationId);
    },
    { body: switchOrgDto }
  );
