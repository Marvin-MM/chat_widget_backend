import { t } from "elysia";

export const registerDto = t.Object({
  email: t.String({ format: "email" }),
  name: t.String({ minLength: 2 }),
  password: t.String({ minLength: 8 }),
  organizationName: t.String({ minLength: 2 })
});

export const loginDto = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 })
});

export const refreshDto = t.Object({
  refreshToken: t.String()
});

export const switchOrgDto = t.Object({
  organizationId: t.String()
});
