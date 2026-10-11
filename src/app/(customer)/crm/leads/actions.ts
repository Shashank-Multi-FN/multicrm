"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCrmTenantContext } from "@/lib/crm/context";
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

type FormState = {
  error?: string;
  customFieldErrors?: Record<string, string>;
};

function getValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export async function createLead(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.LEADS_CREATE);

    const firstName = getValue(formData, "firstName");
    const lastName = getValue(formData, "lastName");
    const email = getValue(formData, "email");
    const phone = getValue(formData, "phone");
    const jobTitle = getValue(formData, "jobTitle");
    const source = getValue(formData, "source");
    const status = getValue(formData, "status");
    const companyId = getValue(formData, "companyId");

    if (!firstName || !lastName) {
      return {
        error: "First name and last name are required.",
      };
    }

    if (companyId) {
      const company = await db.company.findFirst({
        where: {
          id: companyId,
          crmInstanceId: tenant.crmId,
        },
        select: {
          id: true,
        },
      });

      if (!company) {
        return {
          error: "Selected company was not found.",
        };
      }
    }

    const conditionalForm = await getCrmOperationalForm({
      tenant,
      moduleKey: "leads",
      operation: "create",
    });
    const customFields = await resolveCustomFieldValuesForModule({
      tenant,
      moduleKey: "leads",
      formData,
      conditionalForm,
      systemValues: {
        firstName,
        lastName,
        email,
        phone,
        jobTitle,
        source,
        status,
      },
    });
    if (!customFields.valid) {
      return {
        error: "Please correct the highlighted custom fields.",
        customFieldErrors: customFields.errors,
      };
    }

    const lead = await db.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          crmInstanceId: tenant.crmId,
          companyId: companyId || null,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          jobTitle: jobTitle || null,
          source: source || null,
          status: status || null,
        },
      });

      for (const field of customFields.fields) {
        const value = normalizeCustomFieldInputValue(customFields.values[field.key]);
        const payload = buildCustomFieldPayloadForModule({
          moduleKey: "leads",
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
          const existing = await tx.customLeadFieldValue.findUnique({
            where: {
              crmInstanceId_moduleKey_recordId_fieldId: {
                crmInstanceId: tenant.crmId,
                moduleKey: "leads",
                recordId: created.id,
                fieldId: field.id,
              },
            },
          });
          if (existing) {
            await tx.customLeadFieldValue.delete({ where: { id: existing.id } });
          }
          continue;
        }

        await tx.customLeadFieldValue.upsert({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "leads",
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
      moduleKey: "leads",
      recordId: lead.id,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "leads",
      recordId: lead.id,
      eventType: "RECORD_CREATED",
      snapshot: workflowAfter,
    });
    await observeWorkflowEvent({
      tenant,
      moduleKey: "leads",
      eventType: "RECORD_CREATED",
      recordId: lead.id,
      eventId: workflowEventId,
      before: null,
      after: workflowAfter,
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${lead.id}`);
  } catch {
    return {
      error: "Unable to create lead.",
    };
  }

  redirect("/crm/leads");
}

export async function updateLead(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.LEADS_UPDATE);

    const id = getValue(formData, "id");
    const firstName = getValue(formData, "firstName");
    const lastName = getValue(formData, "lastName");
    const email = getValue(formData, "email");
    const phone = getValue(formData, "phone");
    const jobTitle = getValue(formData, "jobTitle");
    const source = getValue(formData, "source");
    const status = getValue(formData, "status");
    const companyId = getValue(formData, "companyId");

    if (!id) {
      return {
        error: "Lead ID is required.",
      };
    }

    if (!firstName || !lastName) {
      return {
        error: "First name and last name are required.",
      };
    }

    const existingLead = await db.lead.findFirst({
      where: {
        id,
        crmInstanceId: tenant.crmId,
      },
      select: {
        id: true,
      },
    });

    if (!existingLead) {
      return {
        error: "Lead not found.",
      };
    }

    if (companyId) {
      const company = await db.company.findFirst({
        where: {
          id: companyId,
          crmInstanceId: tenant.crmId,
        },
        select: {
          id: true,
        },
      });

      if (!company) {
        return {
          error: "Selected company was not found.",
        };
      }
    }

    const conditionalForm = await getCrmOperationalForm({
      tenant,
      moduleKey: "leads",
      operation: "edit",
    });
    const customFields = await resolveCustomFieldValuesForModule({
      tenant,
      moduleKey: "leads",
      formData,
      conditionalForm,
      systemValues: {
        firstName,
        lastName,
        email,
        phone,
        jobTitle,
        source,
        status,
      },
    });
    if (!customFields.valid) {
      return {
        error: "Please correct the highlighted custom fields.",
        customFieldErrors: customFields.errors,
      };
    }

    const workflowBefore = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "leads",
      recordId: id,
    });
    await db.$transaction(async (tx) => {
      const updateResult = await tx.lead.updateMany({
        where: {
          id,
          crmInstanceId: tenant.crmId,
        },
        data: {
          companyId: companyId || null,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          jobTitle: jobTitle || null,
          source: source || null,
          status: status || null,
        },
      });

      if (updateResult.count !== 1) {
        throw new Error("Lead not found.");
      }

      for (const field of customFields.fields) {
        const value = normalizeCustomFieldInputValue(customFields.values[field.key]);
        const payload = buildCustomFieldPayloadForModule({
          moduleKey: "leads",
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
          recordId: id,
          crmInstanceId: tenant.crmId,
        });

        if (payload === null) {
          const existing = await tx.customLeadFieldValue.findUnique({
            where: {
              crmInstanceId_moduleKey_recordId_fieldId: {
                crmInstanceId: tenant.crmId,
                moduleKey: "leads",
                recordId: id,
                fieldId: field.id,
              },
            },
          });
          if (existing) {
            await tx.customLeadFieldValue.delete({ where: { id: existing.id } });
          }
          continue;
        }

        await tx.customLeadFieldValue.upsert({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "leads",
              recordId: id,
              fieldId: field.id,
            },
          },
          create: payload,
          update: payload,
        });
      }
    });

    const workflowAfter = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "leads",
      recordId: id,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "leads",
      recordId: id,
      eventType: "RECORD_UPDATED",
      snapshot: workflowAfter,
    });
    await observeWorkflowEvent({
      tenant,
      moduleKey: "leads",
      eventType: "RECORD_UPDATED",
      recordId: id,
      eventId: workflowEventId,
      before: workflowBefore,
      after: workflowAfter,
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${id}`);
  } catch {
    return {
      error: "Unable to update lead.",
    };
  }

  redirect("/crm/leads");
}

export async function deleteLead(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.LEADS_DELETE);
    const { crmId } = tenant;

    const id = getValue(formData, "id");

    if (!id) {
      return {
        error: "Lead ID is required.",
      };
    }

    const existingLead = await db.lead.findFirst({
      where: {
        id,
        crmInstanceId: crmId,
      },
      select: {
        id: true,
      },
    });

    if (!existingLead) {
      return {
        error: "Lead not found.",
      };
    }

    const workflowBefore = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "leads",
      recordId: id,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "leads",
      recordId: id,
      eventType: "RECORD_DELETED",
      snapshot: workflowBefore,
    });
    await db.lead.delete({
      where: {
        id: existingLead.id,
      },
    });

    await observeWorkflowEvent({
      tenant,
      moduleKey: "leads",
      eventType: "RECORD_DELETED",
      recordId: id,
      eventId: workflowEventId,
      before: workflowBefore,
      after: null,
    });

    revalidatePath("/crm/leads");
  } catch {
    return {
      error: "Unable to delete lead.",
    };
  }

  redirect("/crm/leads");
}
