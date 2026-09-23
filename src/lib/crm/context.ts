"use server";

import { db } from "@/lib/db";
import { requireAnyOrganizationMembership } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";

export type CrmTenantContext = {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationRole: string;
  crmId: string;
  crmName: string;
  crmSlug: string;
};

export async function getCrmTenantContext(): Promise<CrmTenantContext> {
  const membership = await requireAnyOrganizationMembership();

  const [user, organization, crmInstance] = await Promise.all([
    db.user.findUnique({
      where: {
        id: membership.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),

    db.organization.findUnique({
      where: {
        id: membership.organizationId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),

    db.crmInstance.findFirst({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  if (!user) {
    throw new AuthorizationError("Authenticated user could not be resolved");
  }

  if (!organization) {
    throw new AuthorizationError("Organization could not be resolved");
  }

  if (!crmInstance) {
    throw new AuthorizationError(
      "No CRM instance is available for this organization",
    );
  }

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    organizationRole: membership.role,
    crmId: crmInstance.id,
    crmName: crmInstance.name,
    crmSlug: crmInstance.slug,
  };
}