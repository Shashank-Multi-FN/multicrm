"use client";

import { useActionState } from "react";
import { CrmRole, MembershipRole } from "@prisma/client/index";
import {
  updateCrmMembership,
  type CrmMembershipFormState,
} from "./crm-membership-actions";

const initialState: CrmMembershipFormState = {};

const ROLE_LABELS: Record<CrmRole, string> = {
  [CrmRole.CRM_OWNER]: "CRM owner",
  [CrmRole.CRM_ADMIN]: "CRM admin",
  [CrmRole.CRM_MEMBER]: "CRM member",
};

type OrganizationUser = {
  userId: string;
  name: string;
  email: string;
  organizationRole: MembershipRole;
  crmRole: CrmRole | null;
};

function CrmMembershipRow({
  crmInstanceId,
  member,
}: {
  crmInstanceId: string;
  member: OrganizationUser;
}) {
  const [state, formAction, isPending] = useActionState(
    updateCrmMembership,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 border-t p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <input name="crmInstanceId" type="hidden" value={crmInstanceId} />
      <input name="userId" type="hidden" value={member.userId} />
      <div>
        <p className="font-medium">{member.name}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {member.email} · Organization {member.organizationRole}
        </p>
        {state.error ? (
          <p aria-live="polite" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p aria-live="polite" className="mt-1 text-sm text-green-700 dark:text-green-400">
            {state.success}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`crm-role-${member.userId}`}>
          CRM role for {member.name}
        </label>
        <select
          className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-950"
          defaultValue={member.crmRole ?? ""}
          id={`crm-role-${member.userId}`}
          name="role"
        >
          <option value="">No CRM access</option>
          {Object.values(CrmRole).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <button
          className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          Save
        </button>
      </div>
    </form>
  );
}

export default function CrmMembershipForm({
  crmInstanceId,
  members,
}: {
  crmInstanceId: string;
  members: OrganizationUser[];
}) {
  return (
    <section className="space-y-2 rounded-xl border border-black/[.08] dark:border-white/[.145]">
      <div className="p-5">
        <h2 className="text-xl font-semibold">CRM access</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Organization membership alone does not grant access to this CRM.
        </p>
      </div>
      {members.length ? (
        members.map((member) => (
          <CrmMembershipRow
            key={member.userId}
            crmInstanceId={crmInstanceId}
            member={member}
          />
        ))
      ) : (
        <p className="border-t p-5 text-sm text-zinc-600 dark:text-zinc-400">
          This organization has no members. The CRM is currently platform-managed.
        </p>
      )}
    </section>
  );
}
