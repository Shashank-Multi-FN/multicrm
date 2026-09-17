import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/[.08] px-6 py-5 dark:border-white/[.145]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a className="text-xl font-semibold" href="/admin">
            MultiCRM Admin
          </a>
          <nav aria-label="Admin navigation" className="flex gap-4 text-sm">
            <a className="hover:underline" href="/admin/organizations">
              Organizations
            </a>
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
