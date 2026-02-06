import type { Role } from "@prisma/client";
import { forbidden } from "../lib/errors";

export const requireRole = (role: Role, userRole: Role) => {
  const hierarchy: Role[] = ["VIEWER", "AGENT", "ADMIN", "OWNER"];
  if (hierarchy.indexOf(userRole) < hierarchy.indexOf(role)) {
    throw forbidden("Insufficient permissions");
  }
};
