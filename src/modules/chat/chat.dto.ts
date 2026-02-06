import { t } from "elysia";

export const sendMessageDto = t.Object({
  sessionId: t.String(),
  content: t.String({ minLength: 1 }),
  visibility: t.Optional(t.Union([t.Literal("PUBLIC"), t.Literal("INTERNAL")]))
});

export const assignDto = t.Object({
  sessionId: t.String(),
  agentId: t.String()
});

export const tagDto = t.Object({
  sessionId: t.String(),
  tag: t.String({ minLength: 2 })
});
