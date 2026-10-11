"use server";

import { Prisma, MembershipRole, CrmRole } from "@prisma/client/index";
import { redirect } from "next/navigation";
import { PlatformRole } from "@prisma/client/index";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
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
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type RegisterState = {
  error?: string;
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formString(formData, "email").trim().toLowerCase();
  const password = formString(formData, "password");

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

  const membership = await db.crmMembership.findFirst({
    where: {
      userId: user.id,
      crmInstance: {
        organization: {
          memberships: {
            some: { userId: user.id },
          },
        },
      },
    },
    select: { id: true },
  });

  redirect(membership ? "/crm" : "/pending-access");
}

export async function register(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = formString(formData, "name").trim();
  const email = formString(formData, "email").trim().toLowerCase();
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");
  const organizationName = `${name}'s Organization`;

  if (name.length < 2 || name.length > 100) {
    return { error: "Name must be between 2 and 100 characters." };
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < 8 || password.length > 200) {
    return { error: "Password must be between 8 and 200 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return { error: "A user with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const baseSlug =
    normalizeSlug(organizationName).slice(0, 100).replace(/-+$/g, "") ||
    "organization";
  let userId: string;

  try {
    userId = await db.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
        select: { id: true },
      });

      let organizationSlug = baseSlug;
      let suffix = 2;

      while (
        await transaction.organization.findUnique({
          where: { slug: organizationSlug },
          select: { id: true },
        })
      ) {
        const suffixText = `-${suffix}`;
        const slugPrefix = baseSlug
          .slice(0, 100 - suffixText.length)
          .replace(/-+$/g, "");
        organizationSlug = `${slugPrefix}${suffixText}`;
        suffix += 1;
      }

      if (!SLUG_PATTERN.test(organizationSlug)) {
        throw new Error("Unable to generate a valid organization slug.");
      }

      const organization = await transaction.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
        },
        select: { id: true },
      });

      await transaction.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: MembershipRole.ORG_OWNER,
        },
      });

      const crmInstance = await transaction.crmInstance.create({
        data: {
          organizationId: organization.id,
          name: `${organizationName} CRM`,
          slug: "main",
        },
        select: { id: true },
      });

      await transaction.crmMembership.create({
        data: {
          userId: user.id,
          crmInstanceId: crmInstance.id,
          role: CrmRole.CRM_OWNER,
        },
      });

      return user.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      if (
        target === "email" ||
        (Array.isArray(target) && target.includes("email"))
      ) {
        return { error: "A user with that email already exists." };
      }
    }

    console.error("Account registration failed.", error);
    return { error: "Unable to create your account right now. Please try again." };
  }

  await createSession(userId);
  redirect("/crm");
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

  const membership = await db.crmMembership.findFirst({
    where: {
      userId: user.id,
      crmInstance: {
        organization: {
          memberships: {
            some: { userId: user.id },
          },
        },
      },
    },
    select: { id: true },
  });

  redirect(membership ? "/crm" : "/pending-access");
}
