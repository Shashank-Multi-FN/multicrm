"use server";

import { MembershipRole, Prisma } from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";
import {
  getDefaultCrmModuleConfigurations,
  getDefaultCrmNavigationItems,
} from "@/lib/crm/navigation";
import { provisionDefaultCrmFieldsAndForms } from "@/lib/crm/fields";
import { crmRoleForOrganizationRole } from "@/lib/crm/roles";

export type CrmInstanceFormState = {
  error?: string;
  success?: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createCrmInstance(
  _previousState: CrmInstanceFormState,
  formData: FormData,
): Promise<CrmInstanceFormState> {
  try {
    await requirePlatformAdmin();

    const organizationId = String(formData.get("organizationId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = normalizeSlug(String(formData.get("slug") ?? ""));

    if (!organizationId) {
      return { error: "Select an organization." };
    }

    if (name.length < 2 || name.length > 100) {
      return {
        error: "CRM instance name must be between 2 and 100 characters.",
      };
    }

    if (slug.length < 2 || slug.length > 100 || !SLUG_PATTERN.test(slug)) {
      return {
        error:
          "Slug must contain lowercase letters, numbers, and single hyphens only.",
      };
    }

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        memberships: {
          where: {
            role: {
              in: [MembershipRole.ORG_OWNER, MembershipRole.ORG_ADMIN],
            },
          },
          select: { userId: true, role: true },
        },
      },
    });

    if (!organization) {
      return { error: "Organization not found." };
    }
    if (organization.memberships.length === 0) {
      return {
        error:
          "Assign an organization owner or admin before creating a CRM instance.",
      };
    }

    await db.$transaction(async (transaction) => {
      const crmInstance = await transaction.crmInstance.create({
        data: {
          organizationId: organization.id,
          name,
          slug,
        },
        select: { id: true },
      });

      await transaction.crmModuleConfiguration.createMany({
        data: getDefaultCrmModuleConfigurations().map((module) => ({
          ...module,
          crmInstanceId: crmInstance.id,
        })),
      });

      await transaction.crmNavigationItem.createMany({
        data: getDefaultCrmNavigationItems().map((item) => ({
          ...item,
          crmInstanceId: crmInstance.id,
        })),
      });

      await provisionDefaultCrmFieldsAndForms(transaction, crmInstance.id);

      await transaction.crmMembership.createMany({
        data: organization.memberships.map((membership) => ({
          userId: membership.userId,
          crmInstanceId: crmInstance.id,
          role: crmRoleForOrganizationRole(membership.role),
        })),
      });
    });

    revalidatePath("/admin/crm-instances");
    revalidatePath(`/admin/organizations/${organization.id}`);

    return { success: "CRM instance created successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to create CRM instances." };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        error:
          "An organization already has a CRM instance with that slug.",
      };
    }

    console.error("CRM instance creation failed.", error);
    return { error: "Unable to create the CRM instance right now." };
  }
}
