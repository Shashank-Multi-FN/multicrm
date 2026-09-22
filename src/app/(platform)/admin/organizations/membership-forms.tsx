"use client";

import { useActionState } from "react";
import {
  addOrganizationMember,
  removeOrganizationMember,
  updateMembershipRole,
  type MembershipFormState,
} from "./membership-actions";

const initialState: MembershipFormState = {};

function Feedback({ state }: { state: MembershipFormState }) {
  return (
    <>
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
    </>
  );
}

export function AddMemberForm({
  organizationId,
  users,
}: {
  organizationId: string;
  users: { id: string; name: string; email: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    addOrganizationMember,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="organizationId" type="hidden" value={organizationId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          <span>User</span>
          <select
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            name="userId"
            required
          >
            <option value="">Select a user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>Role</span>
          <select
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
            defaultValue="ORG_MEMBER"
            name="role"
          >
            <option value="ORG_OWNER">Organization owner</option>
            <option value="ORG_ADMIN">Organization admin</option>
            <option value="ORG_MEMBER">Organization member</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || users.length === 0}
            type="submit"
          >
            {isPending ? "Adding..." : "Add member"}
          </button>
        </div>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function MembershipRow({
  organizationId,
  membership,
}: {
  organizationId: string;
  membership: {
    id: string;
    role: "ORG_OWNER" | "ORG_ADMIN" | "ORG_MEMBER";
    user: { name: string; email: string };
    createdAt: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(
    updateMembershipRole,
    initialState,
  );
  const [removeState, removeAction, isRemovePending] = useActionState(
    removeOrganizationMember,
    initialState,
  );

  return (
    <tr className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]">
      <td className="px-4 py-3">{membership.user.name}</td>
      <td className="px-4 py-3">{membership.user.email}</td>
      <td className="px-4 py-3">
        <form action={formAction} className="flex items-center gap-2">
          <input name="membershipId" type="hidden" value={membership.id} />
          <input name="organizationId" type="hidden" value={organizationId} />
          <select
            className="rounded-lg border border-black/15 bg-white px-2 py-1.5 dark:border-white/20 dark:bg-zinc-950"
            defaultValue={membership.role}
            name="role"
          >
            <option value="ORG_OWNER">ORG_OWNER</option>
            <option value="ORG_ADMIN">ORG_ADMIN</option>
            <option value="ORG_MEMBER">ORG_MEMBER</option>
          </select>
          <button
            className="text-sm font-medium hover:underline disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Save
          </button>
        </form>
        <Feedback state={state} />
      </td>
      <td className="px-4 py-3">
        {new Date(membership.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <form action={removeAction}>
          <input name="membershipId" type="hidden" value={membership.id} />
          <input name="organizationId" type="hidden" value={organizationId} />
          <button
            className="text-sm text-red-600 hover:underline dark:text-red-400"
            disabled={isRemovePending}
            type="submit"
          >
            {isRemovePending ? "Removing..." : "Remove"}
          </button>
        </form>
        <Feedback state={removeState} />
      </td>
    </tr>
  );
}
