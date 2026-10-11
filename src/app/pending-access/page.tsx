import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PendingAccessPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <section className="w-full max-w-lg space-y-3 text-center">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          GangLion.OS
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Access pending
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Your account is signed in, but it has not been assigned access to a
          CRM workspace yet.
        </p>
      </section>
    </main>
  );
}
