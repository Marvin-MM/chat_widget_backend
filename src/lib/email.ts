import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    })
  : null;

export const emailService = {
  sendInvite: async (input: { to: string; token: string; organizationId: string }) => {
    if (!transporter) {
      throw new Error("SMTP is not configured");
    }
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: "You're invited to join an organization",
      text: `Use this invitation token to join: ${input.token} (Organization: ${input.organizationId})`
    });
  }
};
