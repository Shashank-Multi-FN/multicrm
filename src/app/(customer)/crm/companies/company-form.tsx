"use client";

import { useActionState } from "react";
import {
  createCompany,
  updateCompany,
  type CompanyFormState,
} from "./actions";

type CompanyValues = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  status?: string | null;
};

export default function CompanyForm({
  company,
}: {
  company?: CompanyValues;
}) {
  const action = company ? updateCompany : createCompany;
  const [state, formAction, isPending] = useActionState<CompanyFormState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]"
    >
      {company?.id ? <input name="companyId" type="hidden" value={company.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          <span>Name</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={company?.name ?? ""}
            name="name"
            required
            type="text"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Email</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={company?.email ?? ""}
            name="email"
            type="email"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Phone</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={company?.phone ?? ""}
            name="phone"
            type="tel"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Website</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={company?.website ?? ""}
            name="website"
            type="url"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Industry</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={company?.industry ?? ""}
            name="industry"
            type="text"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Status</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={company?.status ?? ""}
            name="status"
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
        {isPending ? "Saving..." : company ? "Save changes" : "Create company"}
      </button>
    </form>
  );
}
