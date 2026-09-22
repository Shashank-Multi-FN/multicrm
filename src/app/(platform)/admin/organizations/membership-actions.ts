"use server";

import { MembershipRole, Prisma } from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";

export type MembershipFormState = {
  error?: string;
  success?: string;
};

function isMembershipRole(value: string): value is MembershipRole {
  return Object.values(MembershipRole).includes(value as MembershipRole);
}

async function ensureOrganization(organizationId: string) {
  return db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
}

export async function addOrganizationMember(
  _previousState: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  try {
    await requirePlatformAdmin();
    const organizationId = String(formData.get("organizationId") ?? "");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "");

    if (!organizationId || !userId || !isMembershipRole(role)) {
      return { error: "Select a valid user and organization role." };
    }

    if (!(await ensureOrganization(organizationId))) {
      return { error: "Organization not found." };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return { error: "User not found." };
    }

    await db.membership.create({
      data: {
        organizationId,
        userId,
        role,
      },
    });

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath(`/admin/users/${userId}`);
    return { success: "Member added successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to manage memberships." };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "That user is already a member of this organization." };
    }

    console.error("Membership creation failed.", error);
    return { error: "Unable to add the member right now." };
  }
}

export async function updateMembershipRole(
  _previousState: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  try {
    await requirePlatformAdmin();
    const membershipId = String(formData.get("membershipId") ?? "");
    const organizationId = String(formData.get("organizationId") ?? "");
    const role = String(formData.get("role") ?? "");

    if (!membershipId || !organizationId || !isMembershipRole(role)) {
      return { error: "Select a valid organization role." };
    }

    const membership = await db.membership.findFirst({
      where: { id: membershipId, organizationId },
      select: { userId: true },
    });

    if (!membership) {
      return { error: "Membership not found." };
    }

    await db.membership.update({
      where: { id: membershipId },
      data: { role },
    });

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath(`/admin/users/${membership.userId}`);
    return { success: "Membership role updated." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to manage memberships." };
    }

    console.error("Membership role update failed.", error);
    return { error: "Unable to update the membership role right now." };
  }
}

export async function removeOrganizationMember(
  _previousState: MembershipFormState,
  formData: FormData,
): Promise<MembershipFormState> {
  try {
    await requirePlatformAdmin();
    const membershipId = String(formData.get("membershipId") ?? "");
    const organizationId = String(formData.get("organizationId") ?? "");

    if (!membershipId || !organizationId) {
      return { error: "Membership not found." };
    }

    const membership = await db.membership.findFirst({
      where: { id: membershipId, organizationId },
      select: { userId: true },
    });

    if (!membership) {
      return { error: "Membership not found." };
    }

    await db.membership.delete({ where: { id: membershipId } });
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath(`/admin/users/${membership.userId}`);
    return { success: "Member removed successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to manage memberships." };
    }

    console.error("Membership removal failed.", error);
    return { error: "Unable to remove the member right now." };
  }
}
