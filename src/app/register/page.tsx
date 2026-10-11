import Link from "next/link";
import { redirectAuthenticatedUser } from "@/lib/auth/actions";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  await redirectAuthenticatedUser();

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <section className="w-full max-w-md space-y-8 rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            GangLion.OS
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create your account
          </h1>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
