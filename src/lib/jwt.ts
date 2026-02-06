import { SignJWT, jwtVerify } from "jose";
import { env, tokenTtls } from "../config/env";

const encoder = new TextEncoder();

export type JwtType = "access" | "refresh" | "widget";

const secrets: Record<JwtType, Uint8Array> = {
  access: encoder.encode(env.JWT_ACCESS_SECRET),
  refresh: encoder.encode(env.JWT_REFRESH_SECRET),
  widget: encoder.encode(env.WIDGET_SECRET)
};

export interface AccessPayload {
  sub: string;
  organizationId: string;
  role: string;
}

export interface WidgetPayload {
  sub: string;
  websiteId: string;
  sessionId: string;
}

export const signJwt = async <T extends object>(type: JwtType, payload: T, expiresInSeconds: number) => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secrets[type]);
};

export const verifyJwt = async <T>(type: JwtType, token: string) => {
  const result = await jwtVerify<T>(token, secrets[type]);
  return result.payload;
};

export const accessTokenTtl = tokenTtls.access;
export const refreshTokenTtl = tokenTtls.refresh;
export const widgetTokenTtl = tokenTtls.widget;
