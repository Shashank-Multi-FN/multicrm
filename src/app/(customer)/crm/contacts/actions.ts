"use server";

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

export type ContactFormState = {
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

function validateContactFields(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = readOptionalField(formData, "email");
  const phone = readOptionalField(formData, "phone");
  const jobTitle = readOptionalField(formData, "jobTitle");
  const status = readOptionalField(formData, "status");
  const companyId = readOptionalField(formData, "companyId");

  if (firstName.length < 1 || firstName.length > FIELD_LIMIT) {
    return { error: "First name must be between 1 and 200 characters." };
  }

  if (lastName.length < 1 || lastName.length > FIELD_LIMIT) {
    return { error: "Last name must be between 1 and 200 characters." };
  }

  if (email && (email.length > FIELD_LIMIT || !EMAIL_PATTERN.test(email))) {
    return { error: "Enter a valid email address." };
  }

  for (const [label, value] of [
    ["Phone", phone],
    ["Job title", jobTitle],
    ["Status", status],
  ] as const) {
    if (value && value.length > FIELD_LIMIT) {
      return { error: `${label} must be 200 characters or fewer.` };
    }
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      status,
      companyId,
    },
  };
}

async function verifyCompany(
  companyId: string | null,
  crmInstanceId: string,
): Promise<boolean> {
  if (!companyId) {
    return true;
  }

  const company = await db.company.findFirst({
    where: {
      id: companyId,
      crmInstanceId,
    },
    select: { id: true },
  });

  return Boolean(company);
}

function genericDatabaseError(action: string, error: unknown): ContactFormState {
  console.error(`Contact ${action} failed.`, error);
  return { error: `Unable to ${action} the contact right now.` };
}

export async function createContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.CONTACTS_CREATE);
    const fields = validateContactFields(formData);

    if ("error" in fields) {
      return fields;
    }

    if (!(await verifyCompany(fields.data.companyId, tenant.crmId))) {
      return { error: "Selected company could not be found." };
    }

    const conditionalForm = await getCrmOperationalForm({
      tenant,
      moduleKey: "contacts",
      operation: "create",
    });
    const customFields = await resolveCustomFieldValuesForModule({
      tenant,
      moduleKey: "contacts",
      formData,
      conditionalForm,
      systemValues: fields.data,
    });
    if (!customFields.valid) {
      return {
        error: "Please correct the highlighted custom fields.",
        customFieldErrors: customFields.errors,
      };
    }

    const contact = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          crmInstanceId: tenant.crmId,
          ...fields.data,
        },
      });

      for (const field of customFields.fields) {
        const value = normalizeCustomFieldInputValue(customFields.values[field.key]);
        const payload = buildCustomFieldPayloadForModule({
          moduleKey: "contacts",
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
          const existing = await tx.customContactFieldValue.findUnique({
            where: {
              crmInstanceId_moduleKey_recordId_fieldId: {
                crmInstanceId: tenant.crmId,
                moduleKey: "contacts",
                recordId: created.id,
                fieldId: field.id,
              },
            },
          });
          if (existing) {
            await tx.customContactFieldValue.delete({
              where: { id: existing.id },
            });
          }
          continue;
        }

        await tx.customContactFieldValue.upsert({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "contacts",
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
      moduleKey: "contacts",
      recordId: contact.id,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "contacts",
      recordId: contact.id,
      eventType: "RECORD_CREATED",
      snapshot: workflowAfter,
    });
    await observeWorkflowEvent({
      tenant,
      moduleKey: "contacts",
      eventType: "RECORD_CREATED",
      recordId: contact.id,
      eventId: workflowEventId,
      before: null,
      after: workflowAfter,
    });

    revalidatePath("/crm/contacts");
    if (fields.data.companyId) {
      revalidatePath(`/crm/companies/${fields.data.companyId}`);
    }
    revalidatePath(`/crm/contacts/${contact.id}`);
    return { success: "Contact created successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to create contacts." };
    }

    return genericDatabaseError("create", error);
  }
}

export async function updateContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.CONTACTS_UPDATE);
    const contactId = String(formData.get("contactId") ?? "").trim();
    const fields = validateContactFields(formData);

    if (!contactId) {
      return { error: "Contact could not be identified." };
    }

    if ("error" in fields) {
      return fields;
    }

    const existingContact = await db.contact.findFirst({
      where: {
        id: contactId,
        crmInstanceId: tenant.crmId,
      },
      select: {
        companyId: true,
      },
    });

    if (!existingContact) {
      return { error: "Contact could not be found." };
    }

    if (!(await verifyCompany(fields.data.companyId, tenant.crmId))) {
      return { error: "Selected company could not be found." };
    }

    const conditionalForm = await getCrmOperationalForm({
      tenant,
      moduleKey: "contacts",
      operation: "edit",
    });
    const customFields = await resolveCustomFieldValuesForModule({
      tenant,
      moduleKey: "contacts",
      formData,
      conditionalForm,
      systemValues: fields.data,
    });
    if (!customFields.valid) {
      return {
        error: "Please correct the highlighted custom fields.",
        customFieldErrors: customFields.errors,
      };
    }

    const workflowBefore = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "contacts",
      recordId: contactId,
    });
    await db.$transaction(async (tx) => {
      const updateResult = await tx.contact.updateMany({
        where: {
          id: contactId,
          crmInstanceId: tenant.crmId,
        },
        data: fields.data,
      });

      if (updateResult.count !== 1) {
        throw new Error("Contact could not be found.");
      }

      for (const field of customFields.fields) {
        const value = normalizeCustomFieldInputValue(customFields.values[field.key]);
        const payload = buildCustomFieldPayloadForModule({
          moduleKey: "contacts",
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
          recordId: contactId,
          crmInstanceId: tenant.crmId,
        });

        if (payload === null) {
          const existing = await tx.customContactFieldValue.findUnique({
            where: {
              crmInstanceId_moduleKey_recordId_fieldId: {
                crmInstanceId: tenant.crmId,
                moduleKey: "contacts",
                recordId: contactId,
                fieldId: field.id,
              },
            },
          });
          if (existing) {
            await tx.customContactFieldValue.delete({
              where: { id: existing.id },
            });
          }
          continue;
        }

        await tx.customContactFieldValue.upsert({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "contacts",
              recordId: contactId,
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
      moduleKey: "contacts",
      recordId: contactId,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "contacts",
      recordId: contactId,
      eventType: "RECORD_UPDATED",
      snapshot: workflowAfter,
    });
    await observeWorkflowEvent({
      tenant,
      moduleKey: "contacts",
      eventType: "RECORD_UPDATED",
      recordId: contactId,
      eventId: workflowEventId,
      before: workflowBefore,
      after: workflowAfter,
    });

    revalidatePath("/crm/contacts");
    revalidatePath(`/crm/contacts/${contactId}`);
    for (const companyId of [existingContact.companyId, fields.data.companyId]) {
      if (companyId) {
        revalidatePath(`/crm/companies/${companyId}`);
      }
    }
    return { success: "Contact updated successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to update contacts." };
    }
    if (error instanceof Error && error.message === "Contact could not be found.") {
      return { error: "Contact could not be found." };
    }

    return genericDatabaseError("update", error);
  }
}

export async function deleteContact(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.CONTACTS_DELETE);
    const contactId = String(formData.get("contactId") ?? "").trim();

    if (!contactId) {
      return { error: "Contact could not be identified." };
    }

    const contact = await db.contact.findFirst({
      where: {
        id: contactId,
        crmInstanceId: tenant.crmId,
      },
      select: {
        companyId: true,
      },
    });

    if (!contact) {
      return { error: "Contact could not be found." };
    }

    const workflowBefore = await captureWorkflowRecordSnapshotSafely({
      tenant,
      moduleKey: "contacts",
      recordId: contactId,
    });
    const workflowEventId = createWorkflowObservationId({
      moduleKey: "contacts",
      recordId: contactId,
      eventType: "RECORD_DELETED",
      snapshot: workflowBefore,
    });
    await db.contact.delete({
      where: { id: contactId },
    });

    await observeWorkflowEvent({
      tenant,
      moduleKey: "contacts",
      eventType: "RECORD_DELETED",
      recordId: contactId,
      eventId: workflowEventId,
      before: workflowBefore,
      after: null,
    });

    revalidatePath("/crm/contacts");
    revalidatePath(`/crm/contacts/${contactId}`);
    if (contact.companyId) {
      revalidatePath(`/crm/companies/${contact.companyId}`);
    }
    return { success: "Contact deleted successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to delete contacts." };
    }

    return genericDatabaseError("delete", error);
  }
}
