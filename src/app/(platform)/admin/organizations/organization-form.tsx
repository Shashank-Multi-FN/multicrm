"use client";

import { useActionState } from "react";
import {
  createOrganization,
  type OrganizationFormState,
} from "./actions";

const initialState: OrganizationFormState = {};

export default function OrganizationForm() {
  const [state, formAction, isPending] = useActionState(
    createOrganization,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]"
    >
      <div>
        <h2 className="text-lg font-semibold">Create organization</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Organizations start without members or CRM instances.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          <span>Name</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white"
            name="name"
            required
            type="text"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Slug</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white"
            name="slug"
            placeholder="acme"
            required
            type="text"
          />
        </label>
      </div>

      {state.error ? (
        <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p aria-live="polite" className="text-sm text-green-700 dark:text-green-400">
          {state.success}
        </p>
      ) : null}

      <button
        className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
