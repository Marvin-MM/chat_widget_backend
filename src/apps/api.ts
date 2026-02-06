import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authPlugin } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { metricsRegistry } from "../lib/metrics";
import { AppError } from "../lib/errors";
import { authRoutes } from "../modules/auth/auth.routes";
import { organizationRoutes } from "../modules/organizations/organization.routes";
import { websiteRoutes } from "../modules/websites/website.routes";
import { widgetRoutes } from "../modules/widget/widget.routes";
import { chatRoutes } from "../modules/chat/chat.routes";

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(authPlugin)
  .derive(() => ({ prisma, redis, logger }))
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return { error: error.code, message: error.message };
    }
    set.status = 500;
    return { error: "internal_error", message: "Unexpected error" };
  })
  .get("/health", () => ({ status: "ok" }))
  .get("/metrics", async () => metricsRegistry.metrics())
  .use(authRoutes)
  .use(organizationRoutes)
  .use(websiteRoutes)
  .use(widgetRoutes)
  .use(chatRoutes);

app.listen(3000);
logger.info({ port: 3000 }, "api_listening");
