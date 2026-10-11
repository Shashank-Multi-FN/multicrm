"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import {
  addFieldToForm,
  createConditionalRule,
  createCustomField,
  createFieldOption,
  createForm,
  deleteCustomField,
  deleteConditionalRule,
  deleteFieldOption,
  removeFieldFromForm,
  updateField,
  updateFieldOption,
  updateConditionalRule,
  updateForm,
  updateFormField,
  type ConfigurationActionState,
} from "./actions";

type FieldOption = {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
};

type Field = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  origin: "SYSTEM" | "CUSTOM";
  backingColumn: string | null;
  required: boolean;
  enabled: boolean;
  displayOrder: number;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  pattern: string | null;
  options: FieldOption[];
};

type FormField = {
  id: string;
  displayOrder: number;
  requiredOverride: boolean | null;
  field: Pick<Field, "id" | "key" | "label" | "fieldType" | "enabled">;
};

type CrmForm = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  conditionalRules: ConditionalRule[];
  formFields: FormField[];
};

type ConditionalRule = {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  operator: "EQUALS" | "NOT_EQUALS" | "IS_EMPTY" | "IS_NOT_EMPTY";
  comparisonValue: string | null;
  action: "SHOW" | "HIDE" | "REQUIRE" | "OPTIONAL" | "ENABLE" | "DISABLE";
  enabled: boolean;
  sortOrder: number;
  sourceField: Pick<Field, "id" | "key" | "label" | "fieldType">;
  targetField: Pick<Field, "id" | "key" | "label" | "fieldType">;
};

type StatefulAction = (
  previous: ConfigurationActionState,
  formData: FormData,
) => Promise<ConfigurationActionState>;

function Feedback({ state }: { state: ConfigurationActionState }) {
  return state.error || state.success ? (
    <p
      aria-live="polite"
      className={
        state.error
          ? "text-sm text-red-600 dark:text-red-400"
          : "text-sm text-green-700 dark:text-green-400"
      }
    >
      {state.error ?? state.success}
    </p>
  ) : null;
}

function ActionForm({
  action,
  moduleKey,
  children,
  className = "space-y-3",
}: {
  action: StatefulAction;
  moduleKey: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      <input name="moduleKey" type="hidden" value={moduleKey} />
      {children}
      <Feedback state={state} />
      <button
        className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function DeleteForm({
  action,
  moduleKey,
  idName,
  id,
  itemName,
  extraInputs,
}: {
  action: StatefulAction;
  moduleKey: string;
  idName: string;
  id: string;
  itemName: string;
  extraInputs?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${itemName}? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="moduleKey" type="hidden" value={moduleKey} />
      <input name={idName} type="hidden" value={id} />
      {extraInputs}
      <button
        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        disabled={pending}
        type="submit"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function ConditionalRuleForm({
  moduleKey,
  formId,
  fields,
  rule,
}: {
  moduleKey: string;
  formId: string;
  fields: Field[];
  rule?: ConditionalRule;
}) {
  const action = rule ? updateConditionalRule : createConditionalRule;
  const [state, formAction, pending] = useActionState(action, {});
  const [sourceFieldId, setSourceFieldId] = useState(
    rule?.sourceFieldId ?? fields[0]?.id ?? "",
  );
  const [operator, setOperator] = useState(rule?.operator ?? "EQUALS");
  const sourceField = fields.find((field) => field.id === sourceFieldId);
  const targetFields = fields.filter((field) => field.id !== sourceFieldId);

  function comparisonControl() {
    if (operator === "IS_EMPTY" || operator === "IS_NOT_EMPTY" || !sourceField) {
      return null;
    }
    if (sourceField.fieldType === "SELECT") {
      return (
        <label className="space-y-1 text-sm" key={sourceFieldId}>
          <span className="block font-medium">Option key</span>
          <select
            className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950"
            defaultValue={rule?.comparisonValue ?? ""}
            name="comparisonValue"
            required
          >
            <option value="">Choose an enabled option</option>
            {sourceField.options.filter((option) => option.enabled).map((option) => (
              <option key={option.id} value={option.key}>{option.key} · {option.label}</option>
            ))}
          </select>
        </label>
      );
    }
    if (sourceField.fieldType === "BOOLEAN") {
      return (
        <label className="space-y-1 text-sm" key={sourceFieldId}>
          <span className="block font-medium">Boolean value</span>
          <select
            className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950"
            defaultValue={rule?.comparisonValue ?? ""}
            name="comparisonValue"
            required
          >
            <option value="">Choose a value</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
      );
    }
    const inputType =
      sourceField.fieldType === "NUMBER"
        ? "number"
        : sourceField.fieldType === "DATE"
          ? "date"
          : sourceField.fieldType === "DATETIME"
            ? "datetime-local"
            : "text";
    return (
      <TextInput
        key={sourceFieldId}
        label="Comparison value"
        name="comparisonValue"
        defaultValue={rule?.comparisonValue}
        required
        step={inputType === "number" ? "any" : undefined}
        type={inputType}
      />
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/15">
      <input name="moduleKey" type="hidden" value={moduleKey} />
      <input name="formId" type="hidden" value={formId} />
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Source field</span>
        <select
          className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950"
          name="sourceFieldId"
          onChange={(event) => setSourceFieldId(event.target.value)}
          value={sourceFieldId}
        >
          {fields.map((field) => (
            <option key={field.id} value={field.id}>{field.label} ({field.key})</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Operator</span>
        <select
          className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950"
          name="operator"
          onChange={(event) => setOperator(event.target.value as ConditionalRule["operator"])}
          value={operator}
        >
          <option value="EQUALS">Equals</option>
          <option value="NOT_EQUALS">Does not equal</option>
          <option value="IS_EMPTY">Is empty</option>
          <option value="IS_NOT_EMPTY">Is not empty</option>
        </select>
      </label>
      {comparisonControl()}
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Target field</span>
        <select
          className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950"
          defaultValue={rule?.targetFieldId ?? targetFields[0]?.id ?? ""}
          name="targetFieldId"
          required
        >
          {targetFields.map((field) => (
            <option key={field.id} value={field.id}>{field.label} ({field.key})</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Action</span>
        <select
          className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950"
          defaultValue={rule?.action ?? "SHOW"}
          name="action"
        >
          <option value="SHOW">Show</option>
          <option value="HIDE">Hide</option>
          <option value="REQUIRE">Require</option>
          <option value="OPTIONAL">Optional</option>
          <option value="ENABLE">Enable</option>
          <option value="DISABLE">Disable</option>
        </select>
      </label>
      <TextInput label="Order" name="sortOrder" type="number" min={0} defaultValue={rule?.sortOrder ?? 0} />
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={rule?.enabled ?? true} name="enabled" type="checkbox" /> Enabled
      </label>
      <div className="space-y-2 sm:col-span-2">
        <button
          className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          disabled={pending || fields.length < 2}
          type="submit"
        >
          {pending ? "Saving..." : rule ? "Save rule" : "Create rule"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function TextInput({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  step,
  min,
  max,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  step?: number | "any";
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
        defaultValue={defaultValue ?? ""}
        max={max}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </label>
  );
}

export default function ConfigurationEditor({
  moduleKey,
  moduleLabel,
  fields,
  forms,
  canManage,
}: {
  moduleKey: string;
  moduleLabel: string;
  fields: Field[];
  forms: CrmForm[];
  canManage: boolean;
}) {
  const availableTypes = [
    "TEXT",
    "TEXTAREA",
    "NUMBER",
    "EMAIL",
    "PHONE",
    "DATE",
    "DATETIME",
    "BOOLEAN",
    "SELECT",
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">Fields</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Metadata only. These settings do not alter the existing CRM forms
            or activate runtime validation.
          </p>
        </div>

        {canManage ? (
          <details className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
            <summary className="cursor-pointer font-semibold">Add custom field</summary>
            <ActionForm
              action={createCustomField}
              className="mt-4 grid gap-4 sm:grid-cols-2"
              moduleKey={moduleKey}
            >
              <TextInput label="Stable key" name="key" placeholder="preferred_name" required />
              <TextInput label="Display label" name="label" required />
              <label className="space-y-1 text-sm">
                <span className="font-medium">Field type</span>
                <select
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
                  defaultValue="TEXT"
                  name="fieldType"
                >
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <TextInput label="Display order" name="displayOrder" type="number" min={0} defaultValue={fields.length} />
              <label className="flex items-center gap-2 text-sm">
                <input name="required" type="checkbox" /> Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input defaultChecked name="enabled" type="checkbox" /> Enabled
              </label>
              <TextInput label="Minimum length (text)" name="minLength" type="number" min={0} />
              <TextInput label="Maximum length (text)" name="maxLength" type="number" min={0} />
              <TextInput label="Minimum value (number)" name="minValue" type="number" />
              <TextInput label="Maximum value (number)" name="maxValue" type="number" />
              <TextInput label="Pattern (metadata only)" name="pattern" placeholder="Optional regular expression" />
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Initial SELECT options (one key|label per line)</span>
                <textarea
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
                  name="options"
                  placeholder={"north|North\nsouth|South"}
                  rows={3}
                />
              </label>
            </ActionForm>
          </details>
        ) : null}

        <div className="space-y-4">
          {fields.map((field) => (
            <article
              className="space-y-4 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]"
              key={field.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{field.label}</span>
                <span className="rounded-full border px-2 py-1 text-xs">{field.origin}</span>
                {field.origin === "SYSTEM" ? (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    Protected system field · {field.backingColumn}
                  </span>
                ) : null}
              </div>
              {canManage ? (
                <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                  <ActionForm
                    action={updateField}
                    className="grid gap-3 sm:grid-cols-2"
                    moduleKey={moduleKey}
                  >
                    <input name="fieldId" type="hidden" value={field.id} />
                    <div className="space-y-1 text-sm">
                      <span className="block font-medium">Stable key (immutable)</span>
                      <p className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/15">{field.key}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <span className="block font-medium">Type (immutable)</span>
                      <p className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/15">{field.fieldType}</p>
                    </div>
                    <TextInput label="Label" name="label" defaultValue={field.label} required />
                    <TextInput label="Display order" name="displayOrder" type="number" min={0} defaultValue={field.displayOrder} />
                    {field.origin === "SYSTEM" && field.required ? (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <input checked disabled type="checkbox" /> Required (protected by operational model)
                        </label>
                        <input name="required" type="hidden" value="on" />
                      </>
                    ) : (
                      <label className="flex items-center gap-2 text-sm">
                        <input defaultChecked={field.required} name="required" type="checkbox" /> Required
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input defaultChecked={field.enabled} name="enabled" type="checkbox" /> Enabled
                    </label>
                    <TextInput label="Minimum length" name="minLength" type="number" min={0} defaultValue={field.minLength} />
                    <TextInput label="Maximum length" name="maxLength" type="number" min={0} defaultValue={field.maxLength} />
                    <TextInput label="Minimum value" name="minValue" type="number" defaultValue={field.minValue} />
                    <TextInput label="Maximum value" name="maxValue" type="number" defaultValue={field.maxValue} />
                    <TextInput label="Pattern (metadata only)" name="pattern" defaultValue={field.pattern} />
                  </ActionForm>
                  {field.origin === "CUSTOM" ? (
                    <DeleteForm
                      action={deleteCustomField}
                      id={field.id}
                      idName="fieldId"
                      itemName={`custom field "${field.label}"`}
                      moduleKey={moduleKey}
                    />
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      System identity, type, and backing column cannot be changed or deleted.
                    </p>
                  )}
                </div>
              ) : (
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div><dt className="font-medium">Key</dt><dd>{field.key}</dd></div>
                  <div><dt className="font-medium">Type</dt><dd>{field.fieldType}</dd></div>
                  <div><dt className="font-medium">Enabled / required / order</dt><dd>{String(field.enabled)} / {String(field.required)} / {field.displayOrder}</dd></div>
                </dl>
              )}

              {field.fieldType === "SELECT" ? (
                <div className="space-y-3 border-t border-black/10 pt-4 dark:border-white/15">
                  <h3 className="font-medium">Select options</h3>
                  {field.options.map((option) => (
                    <div className="grid gap-3 rounded-lg bg-black/[.03] p-3 sm:grid-cols-[1fr_1fr_8rem_auto] dark:bg-white/[.04]" key={option.id}>
                      <p className="self-center text-sm"><strong>{option.key}</strong> (stable key)</p>
                      {canManage ? (
                        <>
                          <ActionForm action={updateFieldOption} className="contents" moduleKey={moduleKey}>
                            <input name="fieldId" type="hidden" value={field.id} />
                            <input name="optionId" type="hidden" value={option.id} />
                            <TextInput label="Label" name="label" defaultValue={option.label} required />
                            <div className="flex items-end gap-3">
                              <TextInput label="Order" name="sortOrder" type="number" min={0} defaultValue={option.sortOrder} />
                              <label className="flex items-center gap-1 pb-2 text-sm">
                                <input defaultChecked={option.enabled} name="enabled" type="checkbox" /> On
                              </label>
                            </div>
                          </ActionForm>
                          <DeleteForm
                            action={deleteFieldOption}
                            extraInputs={<input name="fieldId" type="hidden" value={field.id} />}
                            id={option.id}
                            idName="optionId"
                            itemName={`option "${option.label}"`}
                            moduleKey={moduleKey}
                          />
                        </>
                      ) : (
                        <p className="self-center text-sm">{option.label} · {option.enabled ? "Enabled" : "Disabled"} · Order {option.sortOrder}</p>
                      )}
                    </div>
                  ))}
                  {canManage ? (
                    <ActionForm action={createFieldOption} className="grid gap-3 sm:grid-cols-4" moduleKey={moduleKey}>
                      <input name="fieldId" type="hidden" value={field.id} />
                      <TextInput label="Option key" name="key" required />
                      <TextInput label="Option label" name="label" required />
                      <TextInput label="Order" name="sortOrder" type="number" min={0} defaultValue={field.options.length} />
                      <label className="flex items-center gap-2 text-sm"><input defaultChecked name="enabled" type="checkbox" /> Enabled</label>
                    </ActionForm>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5 border-t border-black/10 pt-8 dark:border-white/15">
        <div>
          <h2 className="text-2xl font-semibold">Forms</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Form definitions configure metadata only; they do not replace the current operational forms.
          </p>
        </div>
        {canManage ? (
          <details className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
            <summary className="cursor-pointer font-semibold">Create form</summary>
            <ActionForm action={createForm} className="mt-4 grid gap-3 sm:grid-cols-3" moduleKey={moduleKey}>
              <TextInput label="Stable key" name="key" placeholder={`${moduleKey}_quick_add`} required />
              <TextInput label="Name" name="name" required />
              <TextInput label="Description" name="description" />
              <label className="flex items-center gap-2 text-sm"><input defaultChecked name="enabled" type="checkbox" /> Enabled</label>
            </ActionForm>
          </details>
        ) : null}
        {forms.map((form) => {
          const attachedFieldIds = new Set(form.formFields.map((item) => item.field.id));
          const availableFields = fields.filter((field) => field.enabled && !attachedFieldIds.has(field.id));
          const conditionFields = form.formFields
            .map((item) => fields.find((field) => field.id === item.field.id))
            .filter((field): field is Field => Boolean(field?.enabled));
          return (
            <article className="space-y-4 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]" key={form.id}>
              <div>
                <h3 className="text-lg font-semibold">{form.name}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Key: {form.key} · Module: {moduleLabel} · {form.enabled ? "Enabled" : "Disabled"} · {form.formFields.length} fields
                </p>
                {form.enabled ? (
                  <Link
                    className="mt-2 inline-block text-sm font-medium underline"
                    href={`/crm/configuration/${moduleKey}/preview/${form.key}`}
                  >
                    Preview configured form
                  </Link>
                ) : null}
              </div>
              {canManage ? (
                <>
                  <ActionForm action={updateForm} className="grid gap-3 sm:grid-cols-3" moduleKey={moduleKey}>
                    <input name="formId" type="hidden" value={form.id} />
                    <TextInput label="Name" name="name" defaultValue={form.name} required />
                    <TextInput label="Description" name="description" defaultValue={form.description} />
                    <label className="flex items-center gap-2 text-sm"><input defaultChecked={form.enabled} name="enabled" type="checkbox" /> Enabled</label>
                  </ActionForm>
                  <div className="space-y-3">
                    {form.formFields.map((formField) => (
                      <div className="grid gap-3 rounded-lg bg-black/[.03] p-3 sm:grid-cols-[1fr_1fr_auto] dark:bg-white/[.04]" key={formField.id}>
                        <p className="self-center text-sm"><strong>{formField.field.label}</strong> ({formField.field.key} · {formField.field.fieldType})</p>
                        <ActionForm action={updateFormField} className="flex flex-wrap items-end gap-3" moduleKey={moduleKey}>
                          <input name="formFieldId" type="hidden" value={formField.id} />
                          <TextInput label="Display order" name="displayOrder" type="number" min={0} defaultValue={formField.displayOrder} />
                          <label className="space-y-1 text-sm"><span className="block font-medium">Required</span><select className="rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950" defaultValue={formField.requiredOverride === null ? "inherit" : formField.requiredOverride ? "required" : "optional"} name="requiredOverride"><option value="inherit">Inherit</option><option value="required">Required</option><option value="optional">Optional</option></select></label>
                          <button className="rounded-lg border px-3 py-2 text-sm" type="submit">Save</button>
                        </ActionForm>
                        <DeleteForm action={removeFieldFromForm} id={formField.id} idName="formFieldId" itemName={`field "${formField.field.label}" from this form`} moduleKey={moduleKey} />
                      </div>
                    ))}
                  </div>
                  {form.enabled && availableFields.length > 0 ? (
                    <ActionForm action={addFieldToForm} className="grid gap-3 sm:grid-cols-4" moduleKey={moduleKey}>
                      <input name="formId" type="hidden" value={form.id} />
                      <label className="space-y-1 text-sm"><span className="font-medium">Available field</span><select className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950" name="fieldId">{availableFields.map((field) => <option key={field.id} value={field.id}>{field.label} ({field.key})</option>)}</select></label>
                      <TextInput label="Display order" name="displayOrder" type="number" min={0} defaultValue={form.formFields.length} />
                      <label className="space-y-1 text-sm"><span className="font-medium">Required override</span><select className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950" defaultValue="inherit" name="requiredOverride"><option value="inherit">Inherit</option><option value="required">Required</option><option value="optional">Optional</option></select></label>
                    </ActionForm>
                  ) : null}
                </>
              ) : (
                <ul className="list-inside list-disc text-sm">{form.formFields.map((item) => <li key={item.id}>{item.field.label} · order {item.displayOrder}</li>)}</ul>
              )}
              <section className="space-y-3 border-t border-black/10 pt-4 dark:border-white/15">
                <div>
                  <h4 className="font-semibold">Conditional logic</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Rules affect this configured form preview and its server-side validation only.
                    Hidden or disabled fields reject submitted non-empty values.
                  </p>
                </div>
                {form.conditionalRules.map((rule) => {
                  const ruleFieldsAvailable =
                    conditionFields.some((field) => field.id === rule.sourceFieldId) &&
                    conditionFields.some((field) => field.id === rule.targetFieldId);
                  return (
                    <article className="space-y-3 rounded-lg bg-black/[.03] p-3 dark:bg-white/[.04]" key={rule.id}>
                      <p className="text-sm">
                        If <strong>{rule.sourceField.label}</strong> {rule.operator}
                        {rule.comparisonValue === null ? "" : ` ${rule.comparisonValue}`}
                        , then <strong>{rule.action}</strong> <strong>{rule.targetField.label}</strong>
                        {" · "}{rule.enabled ? "Enabled" : "Disabled"}
                      </p>
                      {canManage && ruleFieldsAvailable ? (
                        <ConditionalRuleForm
                          fields={conditionFields}
                          formId={form.id}
                          moduleKey={moduleKey}
                          rule={rule}
                        />
                      ) : null}
                      {canManage && !ruleFieldsAvailable ? (
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          This rule references a disabled or detached field; it cannot run until corrected.
                        </p>
                      ) : null}
                      {canManage ? (
                        <DeleteForm
                          action={deleteConditionalRule}
                          extraInputs={<input name="formId" type="hidden" value={form.id} />}
                          id={rule.id}
                          idName="ruleId"
                          itemName="conditional rule"
                          moduleKey={moduleKey}
                        />
                      ) : null}
                    </article>
                  );
                })}
                {canManage && form.enabled && conditionFields.length > 1 ? (
                  <ConditionalRuleForm
                    fields={conditionFields}
                    formId={form.id}
                    moduleKey={moduleKey}
                  />
                ) : null}
                {canManage && conditionFields.length < 2 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Attach at least two enabled fields to create a conditional rule.
                  </p>
                ) : null}
              </section>
            </article>
          );
        })}
      </section>
    </div>
  );
}
