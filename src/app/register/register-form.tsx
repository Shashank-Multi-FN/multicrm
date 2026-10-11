"use client";

import { useActionState } from "react";
import { register, type RegisterState } from "@/lib/auth/actions";

const initialState: RegisterState = {};

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="name">
          Your name
        </label>
        <input
          autoComplete="name"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white dark:focus:ring-white/10"
          id="name"
          maxLength={100}
          minLength={2}
          name="name"
          required
          type="text"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white dark:focus:ring-white/10"
          id="email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="new-password"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white dark:focus:ring-white/10"
          id="password"
          maxLength={200}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          autoComplete="new-password"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white"
          id="confirmPassword"
          maxLength={200}
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        className="w-full rounded-lg bg-foreground px-4 py-2.5 font-medium text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
