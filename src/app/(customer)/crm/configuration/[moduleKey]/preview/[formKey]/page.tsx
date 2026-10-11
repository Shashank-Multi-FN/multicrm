import Link from "next/link";
import { notFound } from "next/navigation";
import { RuntimeFormUnavailableError, getCrmRuntimeForm } from "@/lib/crm/runtime-forms";
import RuntimePreviewForm from "../../../runtime-preview-form";
import { validateRuntimePreview } from "../../../runtime-preview-actions";

type RuntimeFormPreviewPageProps = {
  params: Promise<{ moduleKey: string; formKey: string }>;
};

export default async function RuntimeFormPreviewPage({
  params,
}: RuntimeFormPreviewPageProps) {
  const { moduleKey, formKey } = await params;
  let form;
  try {
    form = await getCrmRuntimeForm({ moduleKey, formKey });
  } catch (error) {
    if (error instanceof RuntimeFormUnavailableError) {
      notFound();
    }
    throw error;
  }

  const validateAction = validateRuntimePreview.bind(null, moduleKey, formKey);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-3">
        <Link
          className="text-sm hover:underline"
          href={`/crm/configuration/${moduleKey}`}
        >
          ← Back to {moduleKey} configuration
        </Link>
        <header>
          <h1 className="text-3xl font-semibold">Runtime form preview</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Preview and validate configured metadata only. Submitting this
            preview does not create or update CRM records.
          </p>
        </header>
      </div>
      <RuntimePreviewForm action={validateAction} form={form} />
    </div>
  );
}
