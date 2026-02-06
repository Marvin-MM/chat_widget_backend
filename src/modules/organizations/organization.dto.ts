import { t } from "elysia";

export const createOrgDto = t.Object({
  name: t.String({ minLength: 2 }),
  iconUrl: t.Optional(t.String({ format: "uri" }))
});

export const inviteDto = t.Object({
  email: t.String({ format: "email" }),
  role: t.Union([t.Literal("OWNER"), t.Literal("ADMIN"), t.Literal("AGENT"), t.Literal("VIEWER")])
});

export const assignRoleDto = t.Object({
  userId: t.String(),
  role: t.Union([t.Literal("OWNER"), t.Literal("ADMIN"), t.Literal("AGENT"), t.Literal("VIEWER")])
});

export const removeMemberDto = t.Object({
  userId: t.String()
});

export const brandingDto = t.Object({
  name: t.Optional(t.String({ minLength: 2 })),
  iconUrl: t.Optional(t.String({ format: "uri" }))
});

export const acceptInviteDto = t.Object({
  token: t.String(),
  name: t.String({ minLength: 2 }),
  password: t.String({ minLength: 8 })
});
