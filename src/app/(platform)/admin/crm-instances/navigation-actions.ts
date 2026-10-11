"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";

class NavigationValidationError extends Error {}

export type CrmNavigationFormState = {
  error?: string;
  success?: string;
};

export async function updateCrmNavigation(
  _previousState: CrmNavigationFormState,
  formData: FormData,
): Promise<CrmNavigationFormState> {
  try {
    await requirePlatformAdmin();

    const crmInstanceId = String(formData.get("crmInstanceId") ?? "").trim();
    if (!crmInstanceId) {
      return { error: "CRM instance could not be identified." };
    }

    const crmInstance = await db.crmInstance.findUnique({
      where: { id: crmInstanceId },
      select: { id: true },
    });
    if (!crmInstance) {
      return { error: "CRM instance could not be found." };
    }

    const modules = await db.crmModuleConfiguration.findMany({
      where: { crmInstanceId },
      select: {
        moduleKey: true,
        label: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { moduleKey: "asc" }],
    });

    if (modules.length === 0) {
      return { error: "CRM instance has no configured modules." };
    }

    const updates = modules.map(({ moduleKey }) => {
      const label = String(formData.get(`label_${moduleKey}`) ?? "").trim();
      const sortOrderValue = String(
        formData.get(`sortOrder_${moduleKey}`) ?? "",
      ).trim();
      const sortOrder = Number(sortOrderValue);

      if (label.length < 1 || label.length > 40) {
        throw new NavigationValidationError(
          `The ${moduleKey} label must be 1 to 40 characters.`,
        );
      }
      if (
        sortOrderValue.length === 0 ||
        !Number.isInteger(sortOrder) ||
        sortOrder < 0 ||
        sortOrder > 1000
      ) {
        throw new NavigationValidationError(
          "Navigation order must be a whole number from 0 to 1000.",
        );
      }

      return {
        moduleKey,
        label,
        sortOrder,
        enabled: formData.get(`enabled_${moduleKey}`) === "on",
      };
    });

    await db.$transaction(
      updates.map((item) =>
        db.crmNavigationItem.upsert({
          where: {
            crmInstanceId_moduleKey: {
              crmInstanceId,
              moduleKey: item.moduleKey,
            },
          },
          create: {
            crmInstanceId,
            moduleKey: item.moduleKey,
            label: item.label,
            sortOrder: item.sortOrder,
            enabled: item.enabled,
          },
          update: {
            label: item.label,
            sortOrder: item.sortOrder,
            enabled: item.enabled,
          },
        }),
      ),
    );

    revalidatePath(`/admin/crm-instances/${crmInstanceId}`);
    revalidatePath("/crm");
    return { success: "CRM navigation updated successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to update CRM navigation." };
    }
    if (error instanceof NavigationValidationError) {
      return { error: error.message };
    }

    console.error("CRM navigation update failed.", error);
    return { error: "Unable to update CRM navigation right now." };
  }
}
