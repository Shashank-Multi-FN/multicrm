CREATE TYPE "CrmRole" AS ENUM ('CRM_OWNER', 'CRM_ADMIN', 'CRM_MEMBER');

CREATE TABLE "CrmMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crmInstanceId" TEXT NOT NULL,
    "role" "CrmRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmMembership_userId_idx"
    ON "CrmMembership"("userId");
CREATE INDEX "CrmMembership_crmInstanceId_idx"
    ON "CrmMembership"("crmInstanceId");
CREATE UNIQUE INDEX "CrmMembership_userId_crmInstanceId_key"
    ON "CrmMembership"("userId", "crmInstanceId");

ALTER TABLE "CrmMembership"
    ADD CONSTRAINT "CrmMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmMembership"
    ADD CONSTRAINT "CrmMembership_crmInstanceId_fkey"
    FOREIGN KEY ("crmInstanceId") REFERENCES "CrmInstance"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CrmMembership"
    ("id", "userId", "crmInstanceId", "role", "createdAt", "updatedAt")
SELECT
    'crm_member_' || md5(membership."userId" || ':' || instance."id"),
    membership."userId",
    instance."id",
    CASE membership."role"
        WHEN 'ORG_OWNER' THEN 'CRM_OWNER'::"CrmRole"
        WHEN 'ORG_ADMIN' THEN 'CRM_ADMIN'::"CrmRole"
        WHEN 'ORG_MEMBER' THEN 'CRM_MEMBER'::"CrmRole"
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Membership" AS membership
JOIN "CrmInstance" AS instance
    ON instance."organizationId" = membership."organizationId";
