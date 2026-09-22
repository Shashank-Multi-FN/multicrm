import { redirectAuthenticatedUser } from "@/lib/auth/actions";
import LoginForm from "./login-form";

export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <section className="w-full max-w-md space-y-8 rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            GangLion.OS
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign in to your account
          </h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
