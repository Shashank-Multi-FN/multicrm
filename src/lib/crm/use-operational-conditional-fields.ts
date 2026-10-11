"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  evaluateConditionalFieldStates,
  type ConditionalFieldState,
} from "@/lib/crm/conditional-logic";
import type { CustomFieldDisplayValue } from "@/lib/crm/custom-field-values";
import type { RuntimeForm } from "@/lib/crm/runtime-forms";

function formValue(value: unknown, fieldType: string): unknown {
  if (value instanceof Date) {
    return fieldType === "DATE"
      ? value.toISOString().slice(0, 10)
      : value.toISOString().slice(0, 16);
  }
  return value;
}

export function useOperationalConditionalFields({
  form,
  customFields,
  systemValues,
}: {
  form?: RuntimeForm | null;
  customFields: CustomFieldDisplayValue[];
  systemValues: Record<string, unknown>;
}) {
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    if (!form) return values;
    const customFieldsByKey = new Map(
      customFields.map((field) => [field.key, field]),
    );

    for (const field of form.fields) {
      if (field.origin === "CUSTOM") {
        const customField = customFieldsByKey.get(field.key);
        values[field.key] =
          field.fieldType === "SELECT"
            ? customField?.optionKey ?? null
            : field.fieldType === "BOOLEAN"
              ? customField?.value ?? false
            : customField?.value ?? null;
      } else if (field.backingColumn) {
        values[field.key] = formValue(
          systemValues[field.backingColumn],
          field.fieldType,
        );
      }
      if (field.fieldType === "BOOLEAN" && values[field.key] === undefined) {
        values[field.key] = false;
      }
    }
    return values;
  }, [customFields, form, systemValues]);

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);

  const fieldStates = useMemo(() => {
    if (!form) return {};
    return evaluateConditionalFieldStates(form.fields, form.rules, values);
  }, [form, values]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLFormElement>) => {
      if (!form) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
        return;
      }

      const changedField = form.fields.find((field) =>
        field.origin === "CUSTOM"
          ? target.name === `field:${field.key}`
          : target.name === field.backingColumn,
      );
      if (!changedField) return;

      const nextValue =
        changedField.fieldType === "BOOLEAN" &&
        target instanceof HTMLInputElement
          ? target.checked
          : target.value;
      setValues((current) => ({
        ...current,
        [changedField.key]: nextValue,
      }));
    },
    [form],
  );

  const getFieldState = useCallback(
    (key: string, required: boolean): ConditionalFieldState =>
      fieldStates[key] ?? {
        visible: true,
        enabled: true,
        required,
        conditionallyRequired: false,
      },
    [fieldStates],
  );

  return { getFieldState, onChange };
}
