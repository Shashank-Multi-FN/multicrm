import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { redirectAuthenticatedUser } from "@/lib/auth/actions";
import { requirePlatformAdmin } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      throw error;
    }

    await redirectAuthenticatedUser();
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/[.08] px-6 py-5 dark:border-white/[.145]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a className="text-xl font-semibold" href="/admin">
            MultiCRM Admin
          </a>
          <nav aria-label="Admin navigation" className="flex gap-4 text-sm">
            <Link className="hover:underline" href="/admin/organizations">
              Organizations
            </Link>
            <a className="hover:underline" href="/admin/crm-instances">
              CRM Instances
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        {children}
      </main>
    </div>
  );
}
