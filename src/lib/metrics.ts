import client from "prom-client";
import { env } from "../config/env";

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: `${env.PROMETHEUS_PREFIX}_` });

export const metrics = {
  wsConnections: new client.Gauge({
    name: `${env.PROMETHEUS_PREFIX}_ws_connections`,
    help: "Active websocket connections",
    registers: [register]
  }),
  messageRate: new client.Counter({
    name: `${env.PROMETHEUS_PREFIX}_messages_total`,
    help: "Total chat messages",
    registers: [register]
  }),
  aiLatency: new client.Histogram({
    name: `${env.PROMETHEUS_PREFIX}_ai_latency_ms`,
    help: "AI response latency in ms",
    registers: [register],
    buckets: [50, 100, 250, 500, 1000, 2000, 5000]
  })
};

export const metricsRegistry = register;
