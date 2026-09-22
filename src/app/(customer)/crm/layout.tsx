import type { ReactNode } from "react";
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
          <a className="text-xl font-semibold" href="/crm">
            Customer CRM
          </a>
          <nav aria-label="Customer CRM navigation" className="flex flex-wrap gap-4 text-sm">
            <a className="hover:underline" href="/crm">
              Dashboard
            </a>
            <a className="hover:underline" href="/crm/leads">
              Leads
            </a>
            <a className="hover:underline" href="/crm/contacts">
              Contacts
            </a>
            <a className="hover:underline" href="/crm/companies">
              Companies
            </a>
            <a className="hover:underline" href="/crm/tasks">
              Tasks
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
