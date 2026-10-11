"use server";

import { cookies } from "next/headers";
import { CrmRole } from "@prisma/client/index";
import { db } from "@/lib/db";
import {
  assertCrmModuleEnabled,
  assertCrmRolePermission,
  requireAuthenticatedUser,
} from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { CRM_WORKSPACE_COOKIE_NAME } from "@/lib/crm/constants";
import type { CrmPermission } from "@/lib/crm/permissions";

export type CrmTenantContext = {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationRole: string;
  crmRole: CrmRole;
  crmId: string;
  crmName: string;
  crmSlug: string;
  availableCrmInstances: {
    id: string;
    name: string;
    slug: string;
  }[];
};

export async function getCrmTenantContext(
  requiredPermission?: CrmPermission,
): Promise<CrmTenantContext> {
  const user = await requireAuthenticatedUser();
  const crmInstances = await db.crmInstance.findMany({
    where: {
      crmMemberships: {
        some: {
          userId: user.id,
        },
      },
      organization: {
        memberships: {
          some: {
            userId: user.id,
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      organizationId: true,
      crmMemberships: {
        where: { userId: user.id },
        select: { role: true },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          memberships: {
            where: { userId: user.id },
            select: { role: true },
          },
        },
      },
    },
  });

  if (crmInstances.length === 0) {
    throw new AuthorizationError(
      "No CRM instance is available for the user's organizations",
    );
  }

  const cookieStore = await cookies();
  const selectedCrmId = cookieStore.get(CRM_WORKSPACE_COOKIE_NAME)?.value;
  const crmInstance =
    crmInstances.find((instance) => instance.id === selectedCrmId) ??
    crmInstances[0];
  const membership = crmInstance.organization.memberships[0];
  const crmMembership = crmInstance.crmMemberships[0];

  if (!membership || !crmMembership) {
    throw new AuthorizationError("CRM and organization membership are required");
  }

  if (requiredPermission) {
    await assertCrmRolePermission(crmMembership.role, requiredPermission);
    await assertCrmModuleEnabled(crmInstance.id, requiredPermission);
  }

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    organizationId: crmInstance.organizationId,
    organizationName: crmInstance.organization.name,
    organizationSlug: crmInstance.organization.slug,
    organizationRole: membership.role,
    crmRole: crmMembership.role,
    crmId: crmInstance.id,
    crmName: crmInstance.name,
    crmSlug: crmInstance.slug,
    availableCrmInstances: crmInstances.map(({ id, name, slug }) => ({
      id,
      name,
      slug,
    })),
  };
}