-- Initial schema migration with partial unique indexes for soft deletes

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Prisma migration placeholder; actual schema managed by prisma migrate.

-- Partial unique indexes for soft delete semantics
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_active" ON "User"("email") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_email_org_unique_active" ON "Invitation"("organizationId", "email") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "website_domain_unique_active" ON "WebsiteDomain"("websiteId", "domain") WHERE "deletedAt" IS NULL;
