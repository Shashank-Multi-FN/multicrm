"use server";

import type { CrmFieldType } from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { getCrmTenantContext } from "@/lib/crm/context";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import {
  buildCustomFieldPayloadForModule,
  normalizeCustomFieldInputValue,
  resolveCustomFieldValuesForModule,
} from "@/lib/crm/custom-field-values";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import {
  captureWorkflowRecordSnapshotSafely,
  createWorkflowObservationId,
  observeWorkflowEvent,
} from "@/lib/crm/workflows";

export type CompanyFormState = {
  error?: string;
  success?: string;
  customFieldErrors?: Record<string, string>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_LIMIT = 200;

function readOptionalField(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value.length > 0 ? value : null;
}

function validateCompanyFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = readOptionalField(formData, "email");
  const phone = readOptionalField(formData, "phone");
  const website = readOptionalField(formData, "website");
  const industry = readOptionalField(formData, "industry");
  const status = readOptionalField(formData, "status");

  if (name.length < 2 || name.length > FIELD_LIMIT) {
    return { error: "Company name must be between 2 and 200 characters." };
  }

  if (email && (email.length > FIELD_LIMIT || !EMAIL_PATTERN.test(email))) {
    return { error: "Enter a valid email address." };
  }

  for (const [label, value] of [
    ["Phone", phone],
    ["Website", website],
    ["Industry", industry],
    ["Status", status],
  ] as const) {
    if (value && value.length > FIELD_LIMIT) {
      return { error: `${label} must be 200 characters or fewer.` };
    }
  }

  return {
    data: {
      name,
      email,
      phone,
      website,
      industry,
      status,
    },
  };
}

async function resolveCompanyCustomFields(
  tenant: Awaited<ReturnType<typeof getCrmTenantContext>>,
  formData: FormData,
  conditionalForm: Awaited<ReturnType<typeof getCrmOperationalForm>>,
  systemValues: Record<string, unknown>,
) {
  return resolveCustomFieldValuesForModule({
    tenant,
    moduleKey: "companies",
    formData,
    conditionalForm,
    systemValues,
  });
}

function buildCompanyCustomFieldPayload({
  field,
  value,
  recordId,
  crmInstanceId,
}: {
  field: { id: string; key: string; fieldType: CrmFieldType; options: { id: string; key: string }[] };
  value: string | number | boolean | null;
  recordId: string;
  crmInstanceId: string;
}) {
  return buildCustomFieldPayloadForModule({
    moduleKey: "companies",
    field,
    value,
    recordId,
    crmInstanceId,
  });
}

function genericDatabaseError(action: string, error: unknown): CompanyFormState {
  console.error(`Company ${action} failed.`, error);
  return { error: `Unable to ${action} the company right now.` };
}

export async function createCompany(
  _previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.COMPANIES_CREATE);
    const fields = validateCompanyFields(formData);

    if ("error" in fields) {
      return fields;
    }

    const conditionalForm = await getCrmOperationalForm({
      tenant,
      moduleKey: "companies",
      operation: "create",
    });
    const customFields = await resolveCompanyCustomFields(
      tenant,
      formData,
      conditionalForm,
      fields.data,
    );
    if (!customFields.valid) {
      return {
        error: "Please correct the highlighted custom fields.",
        customFieldErrors: customFields.errors,
      };
    }

    const company = await db.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          crmInstanceId: tenant.crmId,
          ...fields.data,
        },
      });

      for (const field of customFields.fields) {
        const value = normalizeCustomFieldInputValue(
          customFields.values[field.key],
        );
        const payload = buildCompanyCustomFieldPayload({
          field: {
            id: field.id,
            key: field.key,
            fieldType: field.fieldType,
            options: field.options.map((option) => ({
              id: option.id,
              key: option.key,
            })),
          },
          value,
          recordId: created.id,
          crmInstanceId: tenant.crmId,
        });

        if (payload === null) {
          const existing = await tx.customCompanyFieldValue.findUnique({
            where: {
              crmInstanceId_moduleKey_recordId_fieldId: {
                crmInstanceId: tenant.crmId,
                moduleKey: "companies",
                recordId: created.id,
                fieldId: field.id,
              },
            },
          });
          if (existing) {
            await tx.customCompanyFieldValue.delete({
              where: { id: existing.id },
            });
          }
          continue;
        }

        await tx.customCompanyFieldValue.upsert({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "companies",
              recordId: created.id,
              fieldId: field.id,
            },
          },
          create: payload,
          update: payload,
        });
      }

      return created;
    });

    const workflowAfter = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "companies",
      recordId: company.id,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "companies",
      recordId: company.id,
      eventType: "RECORD_CREATED",
      snapshot: workflowAfter,
    });
    await observeWorkflowEvent({
      tenant,
      moduleKey: "companies",
      eventType: "RECORD_CREATED",
      recordId: company.id,
      eventId: workflowEventId,
      before: null,
      after: workflowAfter,
    });

    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${company.id}`);
    return { success: "Company created successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to create companies." };
    }

    return genericDatabaseError("create", error);
  }
}

export async function updateCompany(
  _previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.COMPANIES_UPDATE);
    const companyId = String(formData.get("companyId") ?? "").trim();

    if (!companyId) {
      return { error: "Company could not be identified." };
    }

    const fields = validateCompanyFields(formData);

    if ("error" in fields) {
      return fields;
    }

    const conditionalForm = await getCrmOperationalForm({
      tenant,
      moduleKey: "companies",
      operation: "edit",
    });
    const customFields = await resolveCompanyCustomFields(
      tenant,
      formData,
      conditionalForm,
      fields.data,
    );
    if (!customFields.valid) {
      return {
        error: "Please correct the highlighted custom fields.",
        customFieldErrors: customFields.errors,
      };
    }

    const workflowBefore = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "companies",
      recordId: companyId,
    });
    const result = await db.$transaction(async (tx) => {
      const updateResult = await tx.company.updateMany({
        where: {
          id: companyId,
          crmInstanceId: tenant.crmId,
        },
        data: fields.data,
      });

      if (updateResult.count !== 1) {
        throw new Error("Company could not be found.");
      }

      for (const field of customFields.fields) {
        const value = normalizeCustomFieldInputValue(
          customFields.values[field.key],
        );
        const payload = buildCompanyCustomFieldPayload({
          field: {
            id: field.id,
            key: field.key,
            fieldType: field.fieldType,
            options: field.options.map((option) => ({
              id: option.id,
              key: option.key,
            })),
          },
          value,
          recordId: companyId,
          crmInstanceId: tenant.crmId,
        });

        if (payload === null) {
          const existing = await tx.customCompanyFieldValue.findUnique({
            where: {
              crmInstanceId_moduleKey_recordId_fieldId: {
                crmInstanceId: tenant.crmId,
                moduleKey: "companies",
                recordId: companyId,
                fieldId: field.id,
              },
            },
          });
          if (existing) {
            await tx.customCompanyFieldValue.delete({
              where: { id: existing.id },
            });
          }
          continue;
        }

        await tx.customCompanyFieldValue.upsert({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "companies",
              recordId: companyId,
              fieldId: field.id,
            },
          },
          create: payload,
          update: payload,
        });
      }

      return { count: updateResult.count };
    });

    if (result.count !== 1) {
      return { error: "Company could not be found." };
    }

    const workflowAfter = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "companies",
      recordId: companyId,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "companies",
      recordId: companyId,
      eventType: "RECORD_UPDATED",
      snapshot: workflowAfter,
    });
    await observeWorkflowEvent({
      tenant,
      moduleKey: "companies",
      eventType: "RECORD_UPDATED",
      recordId: companyId,
      eventId: workflowEventId,
      before: workflowBefore,
      after: workflowAfter,
    });

    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${companyId}`);
    return { success: "Company updated successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to update companies." };
    }
    if (error instanceof Error && error.message === "Company could not be found.") {
      return { error: "Company could not be found." };
    }

    return genericDatabaseError("update", error);
  }
}

export async function deleteCompany(
  _previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.COMPANIES_DELETE);
    const companyId = String(formData.get("companyId") ?? "").trim();

    if (!companyId) {
      return { error: "Company could not be identified." };
    }

    const workflowBefore = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "companies",
      recordId: companyId,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "companies",
      recordId: companyId,
      eventType: "RECORD_DELETED",
      snapshot: workflowBefore,
    });
    const result = await db.company.deleteMany({
      where: {
        id: companyId,
        crmInstanceId: tenant.crmId,
      },
    });

    if (result.count !== 1) {
      return { error: "Company could not be found." };
    }

    await observeWorkflowEvent({
      tenant,
      moduleKey: "companies",
      eventType: "RECORD_DELETED",
      recordId: companyId,
      eventId: workflowEventId,
      before: workflowBefore,
      after: null,
    });

    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${companyId}`);
    return { success: "Company deleted successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to delete companies." };
    }

    return genericDatabaseError("delete", error);
  }
}
