import { prisma } from "../../lib/prisma";
import type { AuditAction } from "@prisma/client";

export const auditService = {
  log: (input: { action: AuditAction; organizationId?: string; userId?: string; metadata: Record<string, unknown> }) =>
    prisma.auditLog.create({
      data: {
        action: input.action,
        organizationId: input.organizationId,
        userId: input.userId,
        metadata: input.metadata
      }
    })
};
