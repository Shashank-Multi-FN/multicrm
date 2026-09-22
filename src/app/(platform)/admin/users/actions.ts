"use server";

import { Prisma, PlatformRole } from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

export type UserFormState = {
  error?: string;
  success?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(
  _previousState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  try {
    await requirePlatformAdmin();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (name.length < 2 || name.length > 100) {
      return { error: "Name must be between 2 and 100 characters." };
    }

    if (!EMAIL_PATTERN.test(email)) {
      return { error: "Enter a valid email address." };
    }

    if (password.length < 8 || password.length > 200) {
      return { error: "Password must be between 8 and 200 characters." };
    }

    await db.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
      },
    });

    revalidatePath("/admin/users");
    return { success: "User created successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to create users." };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "A user with that email already exists." };
    }

    console.error("User creation failed.", error);
    return { error: "Unable to create the user right now." };
  }
}

export async function updatePlatformRole(
  _previousState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  try {
    const currentAdmin = await requirePlatformAdmin();
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("platformRole") ?? "");

    if (!userId || !Object.values(PlatformRole).includes(role as PlatformRole)) {
      return { error: "Invalid platform role selection." };
    }

    if (
      currentAdmin.id === userId &&
      role !== PlatformRole.PLATFORM_ADMIN
    ) {
      return { error: "You cannot remove your own platform administrator access." };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return { error: "User not found." };
    }

    await db.user.update({
      where: { id: userId },
      data: { platformRole: role as PlatformRole },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { success: "Platform role updated." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to update platform roles." };
    }

    console.error("Platform role update failed.", error);
    return { error: "Unable to update the platform role right now." };
  }
}
