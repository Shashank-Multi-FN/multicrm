import { CrmFieldType } from "@prisma/client/index";
import { evaluateConditionalFieldStates } from "@/lib/crm/conditional-logic";
import type { RuntimeForm } from "@/lib/crm/runtime-forms";

export type RuntimeFormValues = Record<string, unknown>;
export type RuntimeFormErrors = Record<string, string>;
export type RuntimeValidationResult = {
  valid: boolean;
  errors: RuntimeFormErrors;
  values: Record<string, string | number | boolean | null>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

function isValidDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidDateTime(value: string) {
  if (!ISO_DATETIME_PATTERN.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function addFieldError(errors: RuntimeFormErrors, key: string, message: string) {
  errors[key] = errors[key] ? `${errors[key]} ${message}` : message;
}

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

export function validateCrmRuntimeForm(
  form: RuntimeForm,
  values: RuntimeFormValues,
): RuntimeValidationResult {
  const errors: RuntimeFormErrors = {};
  const normalizedValues: RuntimeValidationResult["values"] = {};
  const fieldsByKey = new Map(form.fields.map((field) => [field.key, field]));
  const acceptedKeys = new Set([
    ...fieldsByKey.keys(),
    ...(form.conditionFields ?? []).map((field) => field.key),
  ]);
  const disabledKeys = new Set(form.disabledFieldKeys);
  const fieldStates = evaluateConditionalFieldStates(
    [...form.fields, ...(form.conditionFields ?? [])],
    form.rules,
    values,
  );

  for (const key of Object.keys(values)) {
    if (disabledKeys.has(key)) {
      errors[key] = "This field is disabled.";
    } else if (!acceptedKeys.has(key)) {
      errors[key] = "This field is not part of the configured form.";
    }
  }

  for (const field of form.fields) {
    const submitted = values[field.key];
    const wasSubmitted = Object.prototype.hasOwnProperty.call(values, field.key);
    const rawValue =
      field.fieldType === CrmFieldType.BOOLEAN && submitted === undefined
        ? false
        : submitted;
    const state = fieldStates[field.key];

    if (!state.visible || !state.enabled) {
      if (wasSubmitted && !isEmpty(rawValue)) {
        errors[field.key] = state.visible
          ? "This field is disabled by conditional logic."
          : "This field is hidden by conditional logic.";
      }
      normalizedValues[field.key] = null;
      continue;
    }

    const empty =
      rawValue === undefined ||
      rawValue === null ||
      (typeof rawValue === "string" && rawValue.trim().length === 0);

    if (
      state.conditionallyRequired &&
      field.fieldType === CrmFieldType.BOOLEAN &&
      rawValue !== true &&
      rawValue !== "true"
    ) {
      errors[field.key] = `${field.label} must be checked.`;
    }

    if (empty) {
      normalizedValues[field.key] = null;
      if (state.required) errors[field.key] = `${field.label} is required.`;
      continue;
    }

    switch (field.fieldType) {
      case CrmFieldType.TEXT:
      case CrmFieldType.TEXTAREA:
      case CrmFieldType.EMAIL:
      case CrmFieldType.PHONE: {
        if (typeof rawValue !== "string") {
          errors[field.key] = `${field.label} must be text.`;
          break;
        }
        normalizedValues[field.key] = rawValue;
        if (
          (field.fieldType === CrmFieldType.TEXT ||
            field.fieldType === CrmFieldType.TEXTAREA) &&
          field.validation.minLength !== null &&
          rawValue.length < field.validation.minLength
        ) {
          errors[field.key] = `${field.label} must be at least ${field.validation.minLength} characters.`;
        } else if (
          (field.fieldType === CrmFieldType.TEXT ||
            field.fieldType === CrmFieldType.TEXTAREA) &&
          field.validation.maxLength !== null &&
          rawValue.length > field.validation.maxLength
        ) {
          errors[field.key] = `${field.label} must be ${field.validation.maxLength} characters or fewer.`;
        }
        if (
          !errors[field.key] &&
          field.fieldType === CrmFieldType.EMAIL &&
          !EMAIL_PATTERN.test(rawValue)
        ) {
          errors[field.key] = `${field.label} must be a valid email address.`;
        }
        break;
      }
      case CrmFieldType.NUMBER: {
        if (
          (typeof rawValue !== "string" && typeof rawValue !== "number") ||
          (typeof rawValue === "string" && rawValue.trim() === "")
        ) {
          errors[field.key] = `${field.label} must be a number.`;
          break;
        }
        const numberValue =
          typeof rawValue === "number" ? rawValue : Number(rawValue);
        if (!Number.isFinite(numberValue)) {
          errors[field.key] = `${field.label} must be a valid number.`;
          break;
        }
        normalizedValues[field.key] = numberValue;
        if (
          field.validation.minValue !== null &&
          numberValue < field.validation.minValue
        ) {
          errors[field.key] = `${field.label} must be at least ${field.validation.minValue}.`;
        } else if (
          field.validation.maxValue !== null &&
          numberValue > field.validation.maxValue
        ) {
          errors[field.key] = `${field.label} must be no more than ${field.validation.maxValue}.`;
        }
        break;
      }
      case CrmFieldType.DATE:
        if (typeof rawValue !== "string" || !isValidDate(rawValue)) {
          errors[field.key] = `${field.label} must be a valid date.`;
        } else {
          normalizedValues[field.key] = rawValue;
        }
        break;
      case CrmFieldType.DATETIME:
        if (typeof rawValue !== "string" || !isValidDateTime(rawValue)) {
          errors[field.key] = `${field.label} must be a valid date and time.`;
        } else {
          normalizedValues[field.key] = rawValue;
        }
        break;
      case CrmFieldType.BOOLEAN:
        if (typeof rawValue === "boolean") {
          normalizedValues[field.key] = rawValue;
        } else if (rawValue === "true" || rawValue === "false") {
          normalizedValues[field.key] = rawValue === "true";
        } else {
          errors[field.key] = `${field.label} must be true or false.`;
        }
        break;
      case CrmFieldType.SELECT:
        if (typeof rawValue !== "string") {
          errors[field.key] = `${field.label} must be a valid option.`;
          break;
        }
        if (!field.options.some((option) => option.key === rawValue)) {
          errors[field.key] = `${field.label} has an invalid or disabled option.`;
          break;
        }
        normalizedValues[field.key] = rawValue;
        break;
      default:
        errors[field.key] = `${field.label} has an unsupported field type.`;
    }

    if (field.validation.pattern && typeof rawValue === "string") {
      try {
        if (!new RegExp(field.validation.pattern).test(rawValue)) {
          addFieldError(errors, field.key, `${field.label} has an invalid format.`);
        }
      } catch {
        addFieldError(
          errors,
          field.key,
          `${field.label} has invalid validation configuration.`,
        );
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: normalizedValues,
  };
}
