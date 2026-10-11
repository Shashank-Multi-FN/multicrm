"use server";

import {
  CrmRole,
  MembershipRole,
  PlatformRole,
} from "@prisma/client/index";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  CRM_PERMISSION_DEFINITIONS,
  type CrmPermission,
  roleHasCrmPermission,
} from "@/lib/crm/permissions";

export type TenantContext = {
  userId: string;
  organizationId: string;
  organizationRole: MembershipRole;
  crmId: string;
  crmRole: CrmRole;
};

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthorizationError("Authentication required");
  }

  return user;
}

export async function requirePlatformAdmin() {
  const user = await requireAuthenticatedUser();

  if (user.platformRole !== PlatformRole.PLATFORM_ADMIN) {
    throw new AuthorizationError("Platform administrator access required");
  }

  return user;
}

export async function requireOrganizationMembership(organizationId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      role: true,
      createdAt: true,
    },
  });

  if (!membership) {
    throw new AuthorizationError("Organization membership required");
  }

  return membership;
}

export async function requireAnyOrganizationMembership() {
  const user = await requireAuthenticatedUser();
  const membership = await db.membership.findFirst({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      role: true,
      createdAt: true,
    },
  });

  if (!membership) {
    throw new AuthorizationError("Organization membership required");
  }

  return membership;
}

export async function requireCrmAccess(
  organizationId: string,
  crmId: string,
): Promise<TenantContext> {
  const membership = await requireOrganizationMembership(organizationId);
  const crmMembership = await db.crmMembership.findFirst({
    where: {
      userId: membership.userId,
      crmInstanceId: crmId,
      crmInstance: {
        organizationId,
      },
    },
    select: {
      crmInstance: {
        select: { id: true },
      },
      role: true,
    },
  });

  if (!crmMembership) {
    throw new AuthorizationError("CRM access required");
  }

  return {
    userId: membership.userId,
    organizationId: membership.organizationId,
    organizationRole: membership.role,
    crmId: crmMembership.crmInstance.id,
    crmRole: crmMembership.role,
  };
}

export async function requireCrmMembership(crmId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await db.crmMembership.findUnique({
    where: {
      userId_crmInstanceId: {
        userId: user.id,
        crmInstanceId: crmId,
      },
    },
    select: {
      id: true,
      userId: true,
      crmInstanceId: true,
      role: true,
      crmInstance: {
        select: {
          id: true,
          organizationId: true,
          organization: {
            select: {
              memberships: {
                where: { userId: user.id },
                select: {
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const organizationMembership = membership?.crmInstance.organization.memberships[0];
  if (!membership || !organizationMembership) {
    throw new AuthorizationError("CRM membership required");
  }

  return {
    userId: user.id,
    crmId: membership.crmInstanceId,
    organizationId: membership.crmInstance.organizationId,
    organizationRole: organizationMembership.role,
    crmRole: membership.role,
  };
}

export async function requireCrmRole(
  crmId: string,
  roles: readonly CrmRole[],
) {
  const membership = await requireCrmMembership(crmId);
  if (!roles.includes(membership.crmRole)) {
    throw new AuthorizationError("Required CRM role is missing");
  }
  return membership;
}

export async function assertCrmRolePermission(
  role: CrmRole,
  permission: CrmPermission,
): Promise<void> {
  if (!roleHasCrmPermission(role, permission)) {
    throw new AuthorizationError(
      `CRM role does not grant the ${permission} permission`,
    );
  }
}

export async function assertCrmModuleEnabled(
  crmId: string,
  permission: CrmPermission,
): Promise<void> {
  const { module } = CRM_PERMISSION_DEFINITIONS[permission];
  if (!module) {
    return;
  }

  const moduleConfiguration = await db.crmModuleConfiguration.findUnique({
    where: {
      crmInstanceId_moduleKey: {
        crmInstanceId: crmId,
        moduleKey: module,
      },
    },
    select: { enabled: true },
  });

  if (!moduleConfiguration?.enabled) {
    throw new AuthorizationError(`CRM module "${module}" is disabled`);
  }
}

export async function requireCrmPermission(
  crmId: string,
  permission: CrmPermission,
) {
  const membership = await requireCrmMembership(crmId);
  await assertCrmRolePermission(membership.crmRole, permission);
  await assertCrmModuleEnabled(crmId, permission);
  return membership;
}
