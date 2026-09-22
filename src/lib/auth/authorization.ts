"use server";

import { MembershipRole, PlatformRole } from "@prisma/client/index";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/errors";

export type TenantContext = {
  userId: string;
  organizationId: string;
  organizationRole: MembershipRole;
  crmId: string;
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
  const crmInstance = await db.crmInstance.findFirst({
    where: {
      id: crmId,
      organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!crmInstance) {
    throw new AuthorizationError("CRM access required");
  }

  return {
    userId: membership.userId,
    organizationId: membership.organizationId,
    organizationRole: membership.role,
    crmId: crmInstance.id,
  };
}
