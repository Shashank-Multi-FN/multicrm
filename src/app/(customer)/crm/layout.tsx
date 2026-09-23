import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redirectAuthenticatedUser } from "@/lib/auth/actions";
import { requireAnyOrganizationMembership } from "@/lib/auth/authorization";
import { AuthorizationError } from "@/lib/auth/errors";

export default async function CrmLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireAnyOrganizationMembership();
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
          <Link className="text-xl font-semibold" href="/crm">
            GangLion.OS
          </Link>

          <nav
            aria-label="Customer CRM navigation"
            className="flex flex-wrap gap-4 text-sm"
          >
            <Link className="hover:underline" href="/crm">
              Dashboard
            </Link>

            <Link className="hover:underline" href="/crm/leads">
              Leads
            </Link>

            <Link className="hover:underline" href="/crm/contacts">
              Contacts
            </Link>

            <Link className="hover:underline" href="/crm/companies">
              Companies
            </Link>

            <Link className="hover:underline" href="/crm/tasks">
              Tasks
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        {children}
      </main>
    </div>
  );
}