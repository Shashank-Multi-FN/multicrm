"use client";

import { useActionState } from "react";
import { useState } from "react";
import { evaluateConditionalFieldStates } from "@/lib/crm/conditional-logic";
import type { RuntimeForm } from "@/lib/crm/runtime-forms";
import type { RuntimePreviewState } from "./runtime-preview-actions";

type RuntimePreviewAction = (
  previous: RuntimePreviewState,
  formData: FormData,
) => Promise<RuntimePreviewState>;

const CONTROL_CLASS =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950";

function RuntimeFieldControl({
  field,
  error,
  state,
  value,
  onValueChange,
}: {
  field: RuntimeForm["fields"][number];
  error?: string;
  state: ReturnType<typeof evaluateConditionalFieldStates>[string];
  value: unknown;
  onValueChange: (value: string | boolean) => void;
}) {
  const id = `runtime-field-${field.key}`;
  const errorId = `${id}-error`;
  const common = {
    "aria-describedby": error ? errorId : undefined,
    "aria-invalid": error ? true : undefined,
    className: CONTROL_CLASS,
    disabled: !state.enabled || !state.visible,
    id,
    name: `field:${field.key}`,
    required: state.required,
  };

  let control;
  switch (field.fieldType) {
    case "TEXTAREA":
      control = (
        <textarea
          {...common}
          onChange={(event) => onValueChange(event.target.value)}
          rows={4}
          value={typeof value === "string" ? value : ""}
        />
      );
      break;
    case "BOOLEAN":
      control = (
        <input
          aria-describedby={common["aria-describedby"]}
          aria-invalid={common["aria-invalid"]}
          className="size-4 rounded border-black/20"
          checked={value === true || value === "true"}
          disabled={common.disabled}
          id={id}
          name={common.name}
          onChange={(event) => onValueChange(event.target.checked)}
          required={common.required}
          type="checkbox"
          value="true"
        />
      );
      break;
    case "SELECT":
      control = (
        <select
          {...common}
          onChange={(event) => onValueChange(event.target.value)}
          value={typeof value === "string" ? value : ""}
        >
          <option value="">Select an option</option>
          {field.options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    default: {
      const inputType =
        field.fieldType === "NUMBER"
          ? "number"
          : field.fieldType === "EMAIL"
            ? "email"
            : field.fieldType === "PHONE"
              ? "tel"
              : field.fieldType === "DATE"
                ? "date"
                : field.fieldType === "DATETIME"
                  ? "datetime-local"
                  : "text";
      control = (
        <input
          {...common}
          onChange={(event) => onValueChange(event.target.value)}
          max={field.validation.maxValue ?? undefined}
          maxLength={field.validation.maxLength ?? undefined}
          min={field.validation.minValue ?? undefined}
          minLength={field.validation.minLength ?? undefined}
          step={field.fieldType === "NUMBER" ? "any" : undefined}
          type={inputType}
          value={typeof value === "string" || typeof value === "number" ? value : ""}
        />
      );
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={id}>
        {field.label}
        {state.required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-red-600">
              *
            </span>
            <span className="sr-only"> required</span>
          </>
        ) : null}
      </label>
      {control}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function RuntimePreviewForm({
  form,
  action,
}: {
  form: RuntimeForm;
  action: RuntimePreviewAction;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const fieldStates = evaluateConditionalFieldStates(
    form.fields,
    form.rules,
    values,
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{form.name}</h2>
          {form.description ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {form.description}
            </p>
          ) : null}
        </div>
        {form.fields.map((field) => {
          const fieldState = fieldStates[field.key];
          return (
            <div hidden={!fieldState.visible} key={field.id}>
              <RuntimeFieldControl
                error={state.errors?.[field.key]}
                field={field}
                onValueChange={(value) => {
                  setValues((current) => ({ ...current, [field.key]: value }));
                }}
                state={fieldState}
                value={values[field.key]}
              />
            </div>
          );
        })}
        {state.message ? (
          <p aria-live="polite" className="text-sm text-zinc-700 dark:text-zinc-300">
            {state.message}
          </p>
        ) : null}
        <button
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Validating..." : "Validate preview (nothing is saved)"}
        </button>
      </form>
      {state.normalizedValues ? (
        <section className="space-y-2 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
          <h3 className="font-semibold">Validated values (preview only)</h3>
          <pre className="overflow-auto whitespace-pre-wrap text-sm">
            {JSON.stringify(state.normalizedValues, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
