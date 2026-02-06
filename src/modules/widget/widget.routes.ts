import { Elysia } from "elysia";
import { widgetController } from "./widget.controller";
import { bootstrapDto } from "./widget.dto";

export const widgetRoutes = new Elysia({ prefix: "/widget" })
  .post("/bootstrap", async ({ body }) => widgetController.bootstrap(body), { body: bootstrapDto });
