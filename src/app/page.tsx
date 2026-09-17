export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">MultiCRM</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Business CRM infrastructure for independent organizations.
        </p>
      </div>

      <nav className="flex flex-col gap-3 sm:flex-row">
        <a
          className="rounded-full bg-foreground px-5 py-3 font-medium text-background transition-colors hover:opacity-80"
          href="/admin"
        >
          Platform Admin
        </a>
        <a
          className="rounded-full border border-black/[.08] px-5 py-3 font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
          href="/crm"
        >
          Customer CRM
        </a>
      </nav>
    </main>
  );
}
