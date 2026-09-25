"use client";

import { useActionState } from "react";
import { deleteContact, type ContactFormState } from "./actions";

export default function DeleteContactForm({ contactId }: { contactId: string }) {
  const [state, formAction, isPending] = useActionState<ContactFormState, FormData>(
    deleteContact,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="contactId" type="hidden" value={contactId} />
      {state.error ? (
        <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      <button
        className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Deleting..." : "Delete contact"}
      </button>
    </form>
  );
}
