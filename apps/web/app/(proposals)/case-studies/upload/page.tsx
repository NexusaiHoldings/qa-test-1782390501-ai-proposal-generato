import type { JSX } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  listCaseStudies,
  addCaseStudy,
  removeCaseStudy,
  formatBytes,
  type CaseStudy,
} from "@/lib/proposals/case-study-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX = 10;

async function handleUpload(formData: FormData): Promise<void> {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const file = formData.get("file");

  if (!title) {
    redirect("/case-studies/upload?error=Please+enter+a+title.");
  }
  if (!(file instanceof File) || file.size === 0) {
    redirect("/case-studies/upload?error=Please+select+a+document+to+upload.");
  }

  let excerpt = "";
  try {
    const bytes = await file.arrayBuffer();
    excerpt = Buffer.from(bytes).toString("utf-8").slice(0, 4096);
  } catch {
    // binary file — no text excerpt
  }

  try {
    await addCaseStudy(user.id, title, file.name, file.size, file.type || "application/octet-stream", excerpt);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Upload failed.");
    redirect(`/case-studies/upload?error=${msg}`);
  }

  redirect("/case-studies/upload?success=1");
}

async function handleDelete(formData: FormData): Promise<void> {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/case-studies/upload");
  }

  try {
    await removeCaseStudy(user.id, id);
  } catch {
    redirect("/case-studies/upload?error=Could+not+delete+case+study.");
  }

  redirect("/case-studies/upload?success=deleted");
}

export default async function CaseStudyUploadPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const studies = await listCaseStudies(user.id);
  const atLimit = studies.length >= MAX;

  const rawError = searchParams.error;
  const errorMsg = typeof rawError === "string" ? decodeURIComponent(rawError) : null;
  const rawSuccess = searchParams.success;
  const successMsg = typeof rawSuccess === "string" ? rawSuccess : null;

  return (
    <main>
      <h1>Case Study Library</h1>
      <p>
        Upload and manage up to {MAX} case studies. These documents are used for
        semantic matching when generating tailored proposals.
      </p>

      {errorMsg && (
        <div role="alert" style={{ color: "var(--color-error, #b91c1c)", marginBottom: "1rem" }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" style={{ color: "var(--color-success, #15803d)", marginBottom: "1rem" }}>
          {successMsg === "deleted" ? "Case study removed successfully." : "Case study uploaded successfully."}
        </div>
      )}

      {!atLimit && (
        <section>
          <h2>Upload a New Case Study</h2>
          <form action={handleUpload} encType="multipart/form-data" method="POST">
            <div>
              <label htmlFor="cs-title">Title</label>
              <input
                id="cs-title"
                name="title"
                type="text"
                required
                placeholder="e.g. Healthcare CRM Migration — 2024"
                maxLength={255}
              />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label htmlFor="cs-file">Document</label>
              <input
                id="cs-file"
                name="file"
                type="file"
                required
                accept=".txt,.md,.pdf,.docx,.doc"
              />
              <span className="muted" style={{ display: "block", marginTop: "0.25rem" }}>
                Accepted formats: TXT, Markdown, PDF, Word. Max size: 10 MB.
              </span>
            </div>
            <button type="submit" style={{ marginTop: "1rem" }}>Upload Case Study</button>
          </form>
        </section>
      )}

      {atLimit && (
        <p>
          You have reached the maximum of {MAX} case studies. Delete an existing
          document to upload a new one.
        </p>
      )}

      {studies.length === 0 ? (
        <div className="empty" style={{ marginTop: "2rem" }}>
          <p>No case studies uploaded yet. Add your first document above.</p>
        </div>
      ) : (
        <section style={{ marginTop: "2rem" }}>
          <h2>Your Case Studies ({studies.length}&nbsp;/&nbsp;{MAX})</h2>
          {studies.map((study: CaseStudy) => (
            <div key={study.id} className="card" style={{ marginBottom: "1rem" }}>
              <strong>{study.title}</strong>
              <p className="muted">
                {study.fileName}&nbsp;&middot;&nbsp;{formatBytes(study.fileSize)}&nbsp;&middot;&nbsp;
                {new Date(study.createdAt).toLocaleDateString()}
              </p>
              {study.excerpt.length > 0 && (
                <p className="muted" style={{ fontSize: "0.85em", marginTop: "0.5rem" }}>
                  {study.excerpt.slice(0, 240).replace(/\s+/g, " ")}&hellip;
                </p>
              )}
              <form action={handleDelete} style={{ marginTop: "0.75rem" }}>
                <input type="hidden" name="id" value={study.id} />
                <button type="submit" className="btn secondary">Delete</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
