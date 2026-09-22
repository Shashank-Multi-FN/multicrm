"use client";

import { useActionState } from "react";
import { updatePlatformRole, type UserFormState } from "./actions";

const initialState: UserFormState = {};

export default function RoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: "NONE" | "PLATFORM_ADMIN";
}) {
  const [state, formAction, isPending] = useActionState(
    updatePlatformRole,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="userId" type="hidden" value={userId} />
      <label className="block space-y-2 text-sm font-medium">
        <span>Platform role</span>
        <select
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
          defaultValue={currentRole}
          name="platformRole"
        >
          <option value="NONE">None</option>
          <option value="PLATFORM_ADMIN">Platform administrator</option>
        </select>
      </label>
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
        className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/[.08]"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : "Save role"}
      </button>
    </form>
  );
}
