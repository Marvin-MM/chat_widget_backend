import { Queue } from "bullmq";
import { redis } from "./redis";

const connection = redis.duplicate();

export const queues = {
  email: new Queue("email", { connection }),
  analytics: new Queue("analytics", { connection }),
  persistence: new Queue("persistence", { connection }),
  billing: new Queue("billing", { connection }),
  webhook: new Queue("webhook", { connection })
};
