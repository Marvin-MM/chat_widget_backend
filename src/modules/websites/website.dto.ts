import { t } from "elysia";

export const widgetConfigDto = t.Object({
  themeColor: t.String({ minLength: 3 }),
  welcomeMessage: t.String({ minLength: 2 }),
  launcherIconUrl: t.Optional(t.String({ format: "uri" })),
  position: t.Union([t.Literal("left"), t.Literal("right")])
});

export const createWebsiteDto = t.Object({
  name: t.String({ minLength: 2 }),
  domains: t.Array(t.String({ minLength: 3 })),
  widgetConfig: widgetConfigDto,
  aiEnabled: t.Optional(t.Boolean())
});

export const updateWebsiteDto = t.Object({
  name: t.Optional(t.String({ minLength: 2 })),
  widgetConfig: t.Optional(widgetConfigDto),
  aiEnabled: t.Optional(t.Boolean())
});

export const domainDto = t.Object({
  domain: t.String({ minLength: 3 })
});
