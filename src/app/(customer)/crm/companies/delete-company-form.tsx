"use client";

import { useActionState } from "react";
import { deleteCompany, type CompanyFormState } from "./actions";

export default function DeleteCompanyForm({ companyId }: { companyId: string }) {
  const [state, formAction, isPending] = useActionState<CompanyFormState, FormData>(
    deleteCompany,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="companyId" type="hidden" value={companyId} />
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
        {isPending ? "Deleting..." : "Delete company"}
      </button>
    </form>
  );
}
