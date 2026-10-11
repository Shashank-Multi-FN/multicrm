"use client";

import { useActionState } from "react";
import { CrmFieldType } from "@prisma/client/index";
import {
  createContact,
  updateContact,
  type ContactFormState,
} from "./actions";
import type { CustomFieldDisplayValue } from "@/lib/crm/custom-field-values";
import type { ConditionalFieldState } from "@/lib/crm/conditional-logic";
import type { RuntimeForm } from "@/lib/crm/runtime-forms";
import { useOperationalConditionalFields } from "@/lib/crm/use-operational-conditional-fields";

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

function ContactCustomFieldControl({
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
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950";

  switch (field.fieldType) {
    case CrmFieldType.SELECT:
      return (
        <label className="space-y-2 text-sm font-medium">
          <span>
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </span>
          <select
            className={baseClass}
            defaultValue={field.optionKey ?? ""}
            disabled={!state.enabled || !state.visible}
            name={name}
            required={state.required}
          >
            <option value="">Select an option</option>
            {field.options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {error ? (
            <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </label>
      );
    case CrmFieldType.BOOLEAN:
      return (
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            defaultChecked={Boolean(field.value)}
            className="size-4 rounded border-black/20"
            disabled={!state.enabled || !state.visible}
            name={name}
            type="checkbox"
            value="true"
          />
          <span>
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </span>
          {error ? (
            <span className="ml-1 text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </label>
      );
    case CrmFieldType.DATE:
      return (
        <label className="space-y-2 text-sm font-medium">
          <span>
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </span>
          <input
            className={baseClass}
            defaultValue={typeof field.value === "string" ? field.value : ""}
            disabled={!state.enabled || !state.visible}
            name={name}
            required={state.required}
            type="date"
          />
          {error ? (
            <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </label>
      );
    case CrmFieldType.DATETIME:
      return (
        <label className="space-y-2 text-sm font-medium">
          <span>
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </span>
          <input
            className={baseClass}
            defaultValue={typeof field.value === "string" ? field.value.slice(0, 16) : ""}
            disabled={!state.enabled || !state.visible}
            name={name}
            required={state.required}
            type="datetime-local"
          />
          {error ? (
            <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </label>
      );
    case CrmFieldType.NUMBER:
      return (
        <label className="space-y-2 text-sm font-medium">
          <span>
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </span>
          <input
            className={baseClass}
            defaultValue={typeof field.value === "number" ? String(field.value) : ""}
            disabled={!state.enabled || !state.visible}
            name={name}
            required={state.required}
            step="any"
            type="number"
          />
          {error ? (
            <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </label>
      );
    default:
      return (
        <label className="space-y-2 text-sm font-medium">
          <span>
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </span>
          <input
            className={baseClass}
            defaultValue={typeof field.value === "string" ? field.value : ""}
            disabled={!state.enabled || !state.visible}
            name={name}
            required={state.required}
            type={field.fieldType === CrmFieldType.EMAIL ? "email" : field.fieldType === CrmFieldType.PHONE ? "tel" : "text"}
          />
          {error ? (
            <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </label>
      );
  }
}

export default function ContactForm({
  contact,
  companies,
  customFields = [],
  conditionalForm,
}: {
  contact?: ContactValues;
  companies: CompanyOption[];
  customFields?: CustomFieldDisplayValue[];
  conditionalForm?: RuntimeForm | null;
}) {
  const action = contact ? updateContact : createContact;
  const [state, formAction, isPending] = useActionState<ContactFormState, FormData>(
    action,
    {},
  );
  const { getFieldState, onChange } = useOperationalConditionalFields({
    form: conditionalForm,
    customFields,
    systemValues: {
      firstName: contact?.firstName ?? "",
      lastName: contact?.lastName ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      jobTitle: contact?.jobTitle ?? "",
      status: contact?.status ?? "",
    },
  });

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]"
      onChange={onChange}
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

      {customFields.length > 0 ? (
        <div className="space-y-4 border-t border-black/[.08] pt-5 dark:border-white/[.145]">
          <div>
            <h3 className="text-lg font-semibold">Custom Fields</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {customFields.map((field) => {
              const conditionalState = getFieldState(field.key, field.required);
              return (
                <div hidden={!conditionalState.visible} key={field.id}>
                  <ContactCustomFieldControl
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
