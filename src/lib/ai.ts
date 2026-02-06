import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { env } from "../config/env";

export const aiClient = {
  generate: async (prompt: string, context: string[]) => {
    if (env.AI_PROVIDER !== "openai") {
      throw new Error(`Unsupported AI provider: ${env.AI_PROVIDER}`);
    }
    const messages = [
      { role: "system", content: prompt },
      ...context.map((content) => ({ role: "user", content }))
    ] as const;
    const { text } = await generateText({
      model: openai(env.AI_MODEL),
      messages
    });
    return text;
  }
};
