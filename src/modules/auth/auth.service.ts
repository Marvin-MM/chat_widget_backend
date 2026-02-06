import { authRepository } from "./auth.repository";
import { badRequest, unauthorized } from "../../lib/errors";
import { hashPassword, verifyPassword } from "../../lib/password";
import { accessTokenTtl, refreshTokenTtl, signJwt, verifyJwt, type AccessPayload } from "../../lib/jwt";
import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { auditService } from "../audit/audit.service";

const refreshKey = (userId: string, jti: string) => `refresh:${userId}:${jti}`;

export const authService = {
  register: async (input: { email: string; name: string; password: string; organizationName: string }) => {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw badRequest("Email already in use");
    }
    const passwordHash = await hashPassword(input.password);
    const { user, organization } = await authRepository.createUserWithOrg({
      email: input.email,
      name: input.name,
      passwordHash,
      organizationName: input.organizationName
    });
    logger.info({ userId: user.id, organizationId: organization.id }, "user_registered");
    await auditService.log({
      action: "USER_REGISTER",
      organizationId: organization.id,
      userId: user.id,
      metadata: { email: user.email }
    });
    const tokens = await authService.issueTokens({
      userId: user.id,
      organizationId: organization.id,
      role: "OWNER"
    });
    return { user, organization, tokens };
  },
  login: async (input: { email: string; password: string }) => {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw unauthorized("Invalid credentials");
    }
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw unauthorized("Invalid credentials");
    }
    const membership = await authRepository.getPrimaryMembership(user.id);
    if (!membership) {
      throw badRequest("No organization membership found");
    }
    const tokens = await authService.issueTokens({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role
    });
    await auditService.log({
      action: "USER_LOGIN",
      organizationId: membership.organizationId,
      userId: user.id,
      metadata: { email: user.email }
    });
    return { user, tokens };
  },
  refresh: async (refreshToken: string) => {
    const payload = await verifyJwt<{ sub: string; jti: string }>("refresh", refreshToken);
    const exists = await redis.get(refreshKey(payload.sub, payload.jti));
    if (!exists) {
      throw unauthorized("Refresh token expired");
    }
    await redis.del(refreshKey(payload.sub, payload.jti));
    const membership = await authRepository.getMembership(payload.sub, exists);
    if (!membership) {
      throw unauthorized("No membership for refresh token");
    }
    return authService.issueTokens({
      userId: payload.sub,
      organizationId: membership.organizationId,
      role: membership.role
    });
  },
  switchOrganization: async (userId: string, organizationId: string) => {
    const membership = await authRepository.getMembership(userId, organizationId);
    if (!membership) {
      throw unauthorized("User is not a member of the organization");
    }
    const access = await signJwt<AccessPayload>(
      "access",
      { sub: userId, organizationId, role: membership.role },
      accessTokenTtl
    );
    return { accessToken: access };
  },
  issueTokens: async (input: { userId: string; organizationId: string; role: string }) => {
    const access = await signJwt<AccessPayload>(
      "access",
      { sub: input.userId, organizationId: input.organizationId, role: input.role },
      accessTokenTtl
    );
    const jti = crypto.randomUUID();
    const refresh = await signJwt("refresh", { sub: input.userId, jti }, refreshTokenTtl);
    await redis.set(refreshKey(input.userId, jti), input.organizationId, "EX", refreshTokenTtl);
    return { accessToken: access, refreshToken: refresh };
  }
};
