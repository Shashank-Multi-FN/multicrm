"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";
import { CRM_WORKSPACE_COOKIE_NAME } from "@/lib/crm/constants";

export async function selectCrmWorkspace(formData: FormData): Promise<void> {
  const user = await requireAuthenticatedUser();
  const crmInstanceId = String(formData.get("crmInstanceId") ?? "").trim();

  if (!crmInstanceId) {
    throw new AuthorizationError("CRM workspace selection is required");
  }

  const crmInstance = await db.crmInstance.findFirst({
    where: {
      id: crmInstanceId,
      crmMemberships: {
        some: { userId: user.id },
      },
      organization: {
        memberships: {
          some: {
            userId: user.id,
          },
        },
      },
    },
    select: { id: true },
  });

  if (!crmInstance) {
    throw new AuthorizationError("CRM workspace access is required");
  }

  const cookieStore = await cookies();
  cookieStore.set(CRM_WORKSPACE_COOKIE_NAME, crmInstance.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  redirect("/crm");
}
