"use server";

import { CrmRole } from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";

export type CrmMembershipFormState = {
  error?: string;
  success?: string;
};

function isCrmRole(value: string): value is CrmRole {
  return Object.values(CrmRole).some((role) => role === value);
}

function parseCrmRole(value: string): CrmRole | null | undefined {
  if (!value) {
    return null;
  }
  return isCrmRole(value) ? value : undefined;
}

export async function updateCrmMembership(
  _previousState: CrmMembershipFormState,
  formData: FormData,
): Promise<CrmMembershipFormState> {
  try {
    await requirePlatformAdmin();

    const crmInstanceId = String(formData.get("crmInstanceId") ?? "").trim();
    const userId = String(formData.get("userId") ?? "").trim();
    const roleValue = String(formData.get("role") ?? "").trim();
    const role = parseCrmRole(roleValue);

    if (!crmInstanceId || !userId || role === undefined) {
      return { error: "Select a valid CRM role." };
    }

    const crmInstance = await db.crmInstance.findFirst({
      where: {
        id: crmInstanceId,
        organization: {
          memberships: {
            some: { userId },
          },
        },
      },
      select: { id: true },
    });

    if (!crmInstance) {
      return {
        error: "The user must belong to the CRM instance's organization.",
      };
    }

    if (role) {
      await db.crmMembership.upsert({
        where: {
          userId_crmInstanceId: { userId, crmInstanceId },
        },
        create: { userId, crmInstanceId, role },
        update: { role },
      });
    } else {
      await db.crmMembership.deleteMany({
        where: { userId, crmInstanceId },
      });
    }

    revalidatePath(`/admin/crm-instances/${crmInstanceId}`);
    revalidatePath("/crm");
    return {
      success: role ? "CRM membership updated." : "CRM access removed.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to manage CRM memberships." };
    }

    console.error("CRM membership update failed.", error);
    return { error: "Unable to update this CRM membership right now." };
  }
}
