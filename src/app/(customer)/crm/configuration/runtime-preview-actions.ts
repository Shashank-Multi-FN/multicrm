"use server";

import { AuthorizationError } from "@/lib/auth/errors";
import {
  getCrmRuntimeForm,
  RuntimeFormUnavailableError,
} from "@/lib/crm/runtime-forms";
import {
  validateCrmRuntimeForm,
  type RuntimeFormErrors,
} from "@/lib/crm/runtime-validation";

export type RuntimePreviewState = {
  errors?: RuntimeFormErrors;
  message?: string;
  normalizedValues?: Record<string, string | number | boolean | null>;
};

export async function validateRuntimePreview(
  moduleKey: string,
  formKey: string,
  _previous: RuntimePreviewState,
  formData: FormData,
): Promise<RuntimePreviewState> {
  try {
    const form = await getCrmRuntimeForm({ moduleKey, formKey });
    const values: Record<string, unknown> = {};
    let unexpectedEntry = 0;

    for (const [name, value] of formData.entries()) {
      if (!name.startsWith("field:")) {
        values[`__unexpected_submission_${unexpectedEntry++}`] = value;
        continue;
      }
      const key = name.slice("field:".length);
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        values[key] = [values[key], value];
      } else {
        values[key] = value;
      }
    }

    const result = validateCrmRuntimeForm(form, values);
    if (!result.valid) {
      return {
        errors: result.errors,
        message: "Please correct the highlighted fields. Nothing was saved.",
      };
    }

    return {
      errors: {},
      message: "Metadata validation passed. Nothing was saved.",
      normalizedValues: result.values,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { message: "You are not authorized to preview this CRM form." };
    }
    if (error instanceof RuntimeFormUnavailableError) {
      return { message: "This CRM form is unavailable." };
    }
    console.error("CRM runtime form preview validation failed.", error);
    return { message: "Unable to validate this preview right now." };
  }
}
