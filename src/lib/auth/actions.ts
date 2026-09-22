"use server";

import { redirect } from "next/navigation";
import { PlatformRole } from "@prisma/client/index";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteSession,
  getCurrentUser,
} from "@/lib/auth/session";

export type LoginState = {
  error?: string;
};

const INVALID_LOGIN_ERROR = "Unable to sign in with those credentials.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return { error: INVALID_LOGIN_ERROR };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      platformRole: true,
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: INVALID_LOGIN_ERROR };
  }

  await createSession(user.id);

  if (user.platformRole === PlatformRole.PLATFORM_ADMIN) {
    redirect("/admin");
  }

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  redirect(membership ? "/crm" : "/pending-access");
}

export async function logout(): Promise<never> {
  await deleteSession();
  redirect("/login");
}

export async function redirectAuthenticatedUser(): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  if (user.platformRole === PlatformRole.PLATFORM_ADMIN) {
    redirect("/admin");
  }

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  redirect(membership ? "/crm" : "/pending-access");
}
