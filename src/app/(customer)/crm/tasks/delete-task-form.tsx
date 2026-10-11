"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { deleteTask } from "./actions";

export default function DeleteTaskForm({
  taskId,
}: {
  taskId: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async () => {
      try {
        await deleteTask(taskId);
        router.push("/crm/tasks");
        return {};
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Unable to delete task",
        };
      }
    },
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (!window.confirm("Delete this task? This action cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete task"}
      </button>
    </form>
  );
}