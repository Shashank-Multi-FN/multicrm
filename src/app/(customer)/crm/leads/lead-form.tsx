"use client";

import { useActionState } from "react";
import { createLead, updateLead } from "./actions";

type CompanyOption = {
  id: string;
  name: string;
};

type LeadFormProps = {
  companies: CompanyOption[];
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    source: string | null;
    status: string | null;
    companyId: string | null;
  };
};

type FormState = {
  error?: string;
};

const initialState: FormState = {};

export default function LeadForm({ companies, lead }: LeadFormProps) {
  const action = lead ? updateLead : createLead;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {lead && <input type="hidden" name="id" value={lead.id} />}

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            defaultValue={lead?.firstName ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            defaultValue={lead?.lastName ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={lead?.email ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={lead?.phone ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="jobTitle" className="block text-sm font-medium">
            Job title
          </label>
          <input
            id="jobTitle"
            name="jobTitle"
            defaultValue={lead?.jobTitle ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="source" className="block text-sm font-medium">
            Source
          </label>
          <input
            id="source"
            name="source"
            placeholder="Website, referral, campaign..."
            defaultValue={lead?.source ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={lead?.status ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="">Select status</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>
        </div>

        <div>
          <label htmlFor="companyId" className="block text-sm font-medium">
            Company
          </label>
          <select
            id="companyId"
            name="companyId"
            defaultValue={lead?.companyId ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : lead ? "Update lead" : "Create lead"}
      </button>
    </form>
  );
}