"use server";

import { Prisma } from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";

export type OrganizationFormState = {
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

export async function createOrganization(
  _previousState: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  try {
    await requirePlatformAdmin();

    const name = String(formData.get("name") ?? "").trim();
    const slug = normalizeSlug(String(formData.get("slug") ?? ""));

    if (name.length < 2 || name.length > 100) {
      return {
        error: "Organization name must be between 2 and 100 characters.",
      };
    }

    if (slug.length < 2 || slug.length > 100 || !SLUG_PATTERN.test(slug)) {
      return {
        error:
          "Slug must contain lowercase letters, numbers, and single hyphens only.",
      };
    }

    await db.organization.create({
      data: {
        name,
        slug,
      },
    });

    revalidatePath("/admin/organizations");

    return {
      success: "Organization created successfully.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to create organizations." };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "An organization with that slug already exists." };
    }

    console.error("Organization creation failed.", error);
    return { error: "Unable to create the organization right now." };
  }
}
