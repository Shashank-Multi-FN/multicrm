# Phase 4C Workflow Foundation Hardening Report

## STATUS: PASS

The existing workflow foundation was extended with durable evaluation runs. No workflow actions were implemented.

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/20261006120000_add_crm_workflow_runs/migration.sql`
- `src/lib/crm/workflows.ts`
- `src/app/(customer)/crm/companies/actions.ts`
- `src/app/(customer)/crm/contacts/actions.ts`
- `src/app/(customer)/crm/leads/actions.ts`
- `src/app/(customer)/crm/tasks/actions.ts`
- `src/app/(customer)/crm/configuration/workflows/actions.ts`
- `scripts/workflows.test.cjs`
- `PHASE_4C_HARDENING_REPORT.md`

The working tree had extensive pre-existing changes before this task. Those unrelated files were left untouched.

## Migration

Created and applied exactly one additive migration: `20261006120000_add_crm_workflow_runs`. It adds the workflow-run status enum, table, indexes, unique idempotency constraint, and foreign keys. No reset, data deletion, or migration rewrite was performed.

## Workflow-run schema

`CrmWorkflowRun` stores `crmInstanceId`, `moduleKey`, `workflowId`, `eventId`, `recordId`, `triggerEvent`, constrained `status`, optional `evaluationError` limited to 2,000 characters, and `observedAt`. Status values are `MATCHED`, `NOT_MATCHED`, and `EVALUATION_FAILED`. It stores no record snapshots, request data, or secrets.

The run has a direct CRM foreign key and a composite `(crmInstanceId, moduleKey, workflowId)` foreign key to the workflow. This prevents recording a run against a workflow from another CRM or module. Workflow deletion is restricted once runs exist so history remains durable; the configuration action responds with guidance to disable the workflow instead.

## Idempotency

Each event ID is a SHA-256 hash of module, record ID, trigger event, and the captured record revision (`updatedAt`). Re-observing the same record revision and event yields the same ID, while a later update revision produces another ID. When no snapshot is available, a deterministic fallback ID is used for that record/module/event. A database unique constraint on CRM, module, workflow, and event ID plus `createMany(skipDuplicates: true)` prevents duplicate runs for the same workflow observation.

## Error handling

Evaluation remains outside the CRM mutation transaction. Successful evaluation writes one `MATCHED` or `NOT_MATCHED` run for each enabled workflow considered. Evaluation errors are caught, then a CRM/module/event-scoped lookup identifies affected workflows for `EVALUATION_FAILED` writes. The error text is truncated to 2,000 characters. Failures to persist either successful decisions or evaluation failures are logged and do not propagate into the already committed CRM mutation.

## Security and tenant isolation

Operational actions pass the server-resolved tenant context, module, record, trigger, and snapshots. No client-supplied CRM ID or workflow ID is accepted for run creation. Workflow candidates are loaded using the active CRM, module, trigger, enabled state, and enabled module configuration. Composite foreign keys enforce CRM/module/workflow integrity at the database layer.

## Tests added

Five focused tests were added, bringing `scripts/workflows.test.cjs` from 15 to 20 tests. They cover matched and not-matched run writes, idempotent duplicate observation, evaluation failure persistence without propagation, CREATE/UPDATE/DELETE run recording with DELETE using before values, stable event IDs across repeated observations and distinct revisions, and active CRM/module/workflow scoping. The original 15 tests remain passing.

## Validation results

- `npx prisma validate` — PASS
- `npx prisma migrate status` — PASS; database schema up to date (18 migrations)
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `node --test scripts/workflows.test.cjs` — PASS; 20 tests
- `git diff --check` — PASS (Git printed only its existing LF-to-CRLF working-copy warning for `prisma/schema.prisma`)

## Known limitations

- Run persistence is best effort when the database is unavailable; no database design can persist a failure while its database is unreachable. The observer logs persistence failures and still preserves the CRM mutation.
- If snapshot capture repeatedly fails for the same record/module/event, the deterministic fallback idempotency key collapses those same-type failures because no record revision is available to distinguish them.
- Run history has no UI surface yet.
- Run records are evaluation outcomes only. There is no action execution, email, notification, webhook, task creation, queue, worker, schedule, retry, or background job.

## Workflow actions

Confirmed: **NO workflow actions were implemented.**
