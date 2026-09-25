"use client";

import { useActionState } from "react";
import {
  createContact,
  updateContact,
  type ContactFormState,
} from "./actions";

type ContactValues = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  status?: string | null;
  companyId?: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
};

export default function ContactForm({
  contact,
  companies,
}: {
  contact?: ContactValues;
  companies: CompanyOption[];
}) {
  const action = contact ? updateContact : createContact;
  const [state, formAction, isPending] = useActionState<ContactFormState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]"
    >
      {contact?.id ? (
        <input name="contactId" type="hidden" value={contact.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          <span>First name</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.firstName ?? ""}
            name="firstName"
            required
            type="text"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Last name</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.lastName ?? ""}
            name="lastName"
            required
            type="text"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Email</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.email ?? ""}
            name="email"
            type="email"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Phone</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.phone ?? ""}
            name="phone"
            type="tel"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Job title</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.jobTitle ?? ""}
            name="jobTitle"
            type="text"
          />
        </label>

        <label className="space-y-2 text-sm font-medium">
          <span>Status</span>
          <input
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.status ?? ""}
            name="status"
            type="text"
          />
        </label>

        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          <span>Company</span>
          <select
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={contact?.companyId ?? ""}
            name="companyId"
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
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
        {isPending ? "Saving..." : contact ? "Save changes" : "Create contact"}
      </button>
    </form>
  );
}
