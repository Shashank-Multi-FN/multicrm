"use client";

import { useActionState } from "react";
import {
  updateCrmNavigation,
  type CrmNavigationFormState,
} from "./navigation-actions";

const initialState: CrmNavigationFormState = {};

type ModuleConfiguration = {
  moduleKey: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  routePath: string;
  navigationItem: {
    label: string;
    enabled: boolean;
    sortOrder: number;
  } | null;
};

export default function CrmNavigationForm({
  crmInstanceId,
  modules,
}: {
  crmInstanceId: string;
  modules: ModuleConfiguration[];
}) {
  const [state, formAction, isPending] = useActionState(
    updateCrmNavigation,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]"
    >
      <div>
        <h2 className="text-xl font-semibold">CRM navigation</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Configure labels, visibility, and order for the modules currently
          available in this CRM.
        </p>
      </div>
      <input name="crmInstanceId" type="hidden" value={crmInstanceId} />
      <div className="space-y-3">
        {modules.map((module) => {
          const navigationItem = module.navigationItem;
          return (
            <div
              className="grid gap-3 rounded-lg border border-black/[.08] p-4 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end dark:border-white/[.145]"
              key={module.moduleKey}
            >
              <label className="space-y-2 text-sm font-medium">
                <span>{module.label} label</span>
                <input
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
                  maxLength={40}
                  name={`label_${module.moduleKey}`}
                  required
                  defaultValue={navigationItem?.label ?? module.label}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Order</span>
                <input
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
                  max={1000}
                  min={0}
                  name={`sortOrder_${module.moduleKey}`}
                  required
                  type="number"
                  defaultValue={navigationItem?.sortOrder ?? module.sortOrder}
                />
              </label>
              <span className="pb-2 text-sm text-zinc-600 dark:text-zinc-400">
                Route: {module.routePath}
              </span>
              <label className="flex items-center gap-2 pb-2 text-sm font-medium">
                <input
                  defaultChecked={navigationItem?.enabled ?? true}
                  name={`enabled_${module.moduleKey}`}
                  type="checkbox"
                />
                Visible
              </label>
            </div>
          );
        })}
      </div>
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
        {isPending ? "Saving..." : "Save navigation"}
      </button>
    </form>
  );
}
