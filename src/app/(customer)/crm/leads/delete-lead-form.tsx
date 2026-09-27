"use client";

import { useActionState } from "react";
import { deleteLead } from "./actions";

type FormState = {
  error?: string;
};

const initialState: FormState = {};

export default function DeleteLeadForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteLead,
    initialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={leadId} />

      {state.error && (
        <p className="mb-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete lead"}
      </button>
    </form>
  );
}