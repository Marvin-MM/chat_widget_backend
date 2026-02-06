import { t } from "elysia";

export const bootstrapDto = t.Object({
  websiteId: t.String(),
  domain: t.String(),
  externalVisitorId: t.Optional(t.String())
});
