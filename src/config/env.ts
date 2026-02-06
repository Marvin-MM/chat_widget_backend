import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  WIDGET_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("900"),
  REFRESH_TOKEN_TTL: z.string().default("604800"),
  WIDGET_TOKEN_TTL: z.string().default("300"),
  AI_PROVIDER: z.string().default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  LOG_LEVEL: z.string().default("info"),
  PROMETHEUS_PREFIX: z.string().default("chat_widget"),
  BILLING_FLUSH_INTERVAL_SECONDS: z.string().default("60"),
  EMAIL_FROM: z.string().email(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional()
});

export const env = envSchema.parse(process.env);

export const tokenTtls = {
  access: Number(env.ACCESS_TOKEN_TTL),
  refresh: Number(env.REFRESH_TOKEN_TTL),
  widget: Number(env.WIDGET_TOKEN_TTL)
};

export const billingFlushIntervalSeconds = Number(env.BILLING_FLUSH_INTERVAL_SECONDS);
