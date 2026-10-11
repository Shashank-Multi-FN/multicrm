"use client";

import { useActionState } from "react";
import { CrmFieldType } from "@prisma/client/index";
import { createLead, updateLead } from "./actions";
import type { CustomFieldDisplayValue } from "@/lib/crm/custom-field-values";
import type { ConditionalFieldState } from "@/lib/crm/conditional-logic";
import type { RuntimeForm } from "@/lib/crm/runtime-forms";
import { useOperationalConditionalFields } from "@/lib/crm/use-operational-conditional-fields";

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
  customFieldErrors?: Record<string, string>;
};

const initialState: FormState = {};

function LeadCustomFieldControl({
  field,
  error,
  state,
}: {
  field: CustomFieldDisplayValue;
  error?: string;
  state: ConditionalFieldState;
}) {
  const name = `field:${field.key}`;
  const baseClass =
    "mt-1 w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black";

  switch (field.fieldType) {
    case CrmFieldType.SELECT:
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <select className={baseClass} defaultValue={field.optionKey ?? ""} disabled={!state.enabled || !state.visible} name={name} required={state.required}>
            <option value="">Select an option</option>
            {field.options.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.BOOLEAN:
      return (
        <div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input defaultChecked={Boolean(field.value)} className="size-4 rounded border-black/20" disabled={!state.enabled || !state.visible} name={name} required={state.required} type="checkbox" value="true" />
            <span>{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</span>
          </label>
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.DATE:
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "string" ? field.value : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} type="date" />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.DATETIME:
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "string" ? field.value.slice(0, 16) : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} type="datetime-local" />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.NUMBER:
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "number" ? String(field.value) : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} step="any" type="number" />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    default:
      return (
        <div>
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "string" ? field.value : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} type={field.fieldType === CrmFieldType.EMAIL ? "email" : field.fieldType === CrmFieldType.PHONE ? "tel" : "text"} />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
  }
}

export default function LeadForm({ companies, lead, customFields = [], conditionalForm }: LeadFormProps & { customFields?: CustomFieldDisplayValue[]; conditionalForm?: RuntimeForm | null }) {
  const action = lead ? updateLead : createLead;
  const [state, formAction, pending] = useActionState(action, initialState);
  const { getFieldState, onChange } = useOperationalConditionalFields({
    form: conditionalForm,
    customFields,
    systemValues: {
      firstName: lead?.firstName ?? "",
      lastName: lead?.lastName ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      jobTitle: lead?.jobTitle ?? "",
      source: lead?.source ?? "",
      status: lead?.status ?? "",
    },
  });

  return (
    <form action={formAction} className="space-y-6" onChange={onChange}>
      {lead && <input type="hidden" name="id" value={lead.id} />}

      {customFields.length > 0 ? (
        <div className="space-y-4 border-t border-black/10 pt-4 dark:border-white/10">
          <h3 className="text-lg font-semibold">Custom Fields</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((field) => {
              const conditionalState = getFieldState(field.key, field.required);
              return (
                <div hidden={!conditionalState.visible} key={field.id}>
                  <LeadCustomFieldControl
                    error={state.customFieldErrors?.[field.key]}
                    field={field}
                    state={conditionalState}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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