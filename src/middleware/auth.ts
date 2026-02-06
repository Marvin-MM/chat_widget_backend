import { Elysia } from "elysia";
import { verifyJwt, type AccessPayload } from "../lib/jwt";
import { unauthorized } from "../lib/errors";

export const authPlugin = new Elysia({ name: "auth" }).derive(async ({ headers }) => {
  const authorization = headers["authorization"];
  if (!authorization) {
    return { authUser: null } as const;
  }
  const token = authorization.replace("Bearer ", "");
  try {
    const payload = await verifyJwt<AccessPayload>("access", token);
    return { authUser: payload } as const;
  } catch {
    return { authUser: null } as const;
  }
});

export const requireAuth = (authUser: AccessPayload | null) => {
  if (!authUser) {
    throw unauthorized("Authentication required");
  }
};
