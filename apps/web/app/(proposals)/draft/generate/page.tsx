"use client";

import type { JSX, FormEvent } from "react";
import { useState, useEffect, useTransition, useCallback } from "react";
import {
  loadCaseStudiesAction,
  generateDraftAction,
  listDraftsAction,
  deleteDraftAction,
  type CaseStudy,
  type ProposalDraft,
} from "@/lib/proposals/draft-generator";

type Tab = "generate" | "history";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function draftToHtml(draft: ProposalDraft): string {
  const sectionsHtml = draft.sections
    .map(
      (s) =>
        `<h2>${s.title}</h2>\n<p>${s.content.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${draft.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; color: #1a1a2e; }
    p { margin: 0.75rem 0; }
    @media print { body { margin: 0; padding: 1rem; } }
  </style>
</head>
<body>
  <h1>${draft.title}</h1>
  <p><em>Generated ${formatDate(draft.createdAt)}</em></p>
  ${sectionsHtml}
</body>
</html>`;
}

function triggerHtmlDownload(draft: ProposalDraft): void {
  const html = draftToHtml(draft);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = draft.title.replace(/[^a-z0-9\s-]/gi, "").trim().replace(/\s+/g, "_") + ".html";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function DraftGeneratePage(): JSX.Element {
  const [tab, setTab] = useState<Tab>("generate");
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [drafts, setDrafts] = useState<ProposalDraft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<ProposalDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rfpContext, setRfpContext] = useState("");
  const [companyProfile, setCompanyProfile] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [studiesResult, draftsResult] = await Promise.all([
        loadCaseStudiesAction(),
        listDraftsAction(),
      ]);
      if (!("error" in studiesResult)) setCaseStudies(studiesResult);
      if (!("error" in draftsResult)) setDrafts(draftsResult);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleCaseStudy(id: string): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleGenerate(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    selectedIds.forEach((id) => formData.append("caseStudyIds", id));
    startTransition(async () => {
      const result = await generateDraftAction(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        setCurrentDraft(result);
        setDrafts((prev) => [result, ...prev.filter((d) => d.id !== result.id)]);
        setError(null);
      }
    });
  }

  function handleDeleteDraft(draftId: string): void {
    startTransition(async () => {
      const result = await deleteDraftAction(draftId);
      if ("success" in result) {
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        if (currentDraft?.id === draftId) setCurrentDraft(null);
      }
    });
  }

  function handleViewDraft(draft: ProposalDraft): void {
    setCurrentDraft(draft);
    setTab("generate");
  }

  function handlePrint(): void {
    window.print();
  }

  function handleExportForGoogleDocs(): void {
    if (!currentDraft) return;
    triggerHtmlDownload(currentDraft);
  }

  return (
    <main>
      <h1>Generate Proposal Draft</h1>
      <p>
        Combine RFP requirements, your case studies, and company profile to generate a
        tailored, professional proposal draft. Drafts are editable inline and exportable
        to PDF or Google Docs.
      </p>

      <nav style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          type="button"
          className={tab === "generate" ? "btn" : "btn secondary"}
          onClick={() => setTab("generate")}
        >
          Generate Draft
        </button>
        <button
          type="button"
          className={tab === "history" ? "btn" : "btn secondary"}
          onClick={() => setTab("history")}
        >
          Draft History ({drafts.length})
        </button>
      </nav>

      {tab === "generate" && (
        <section>
          {!currentDraft && (
            <form onSubmit={handleGenerate}>
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="proposalTitle">Proposal Title</label>
                <input
                  id="proposalTitle"
                  name="proposalTitle"
                  type="text"
                  placeholder="e.g. Cloud Migration Proposal — Acme Corp"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  maxLength={255}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="rfpContext">
                  RFP Requirements{" "}
                  <span className="muted">(required)</span>
                </label>
                <textarea
                  id="rfpContext"
                  name="rfpContext"
                  rows={8}
                  required
                  placeholder="Paste the RFP requirements, scope of work, or evaluation criteria here…"
                  value={rfpContext}
                  onChange={(e) => setRfpContext(e.target.value)}
                  style={{ width: "100%", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="companyProfile">
                  Company Profile{" "}
                  <span className="muted">(required)</span>
                </label>
                <textarea
                  id="companyProfile"
                  name="companyProfile"
                  rows={5}
                  required
                  placeholder="Describe your company, core capabilities, key differentiators, and relevant expertise…"
                  value={companyProfile}
                  onChange={(e) => setCompanyProfile(e.target.value)}
                  style={{ width: "100%", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>

              {caseStudies.length > 0 && (
                <fieldset
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                  }}
                >
                  <legend>Case Studies to Include</legend>
                  <p className="muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                    Select the case studies most relevant to this RFP. If none are selected,
                    the first three will be included automatically.
                  </p>
                  {caseStudies.map((cs) => (
                    <div key={cs.id} style={{ marginBottom: "0.6rem" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cs.id)}
                          onChange={() => toggleCaseStudy(cs.id)}
                          style={{ marginTop: "0.15rem", flexShrink: 0 }}
                        />
                        <span>
                          <strong>{cs.title}</strong>
                          <span
                            className="muted"
                            style={{ display: "block", fontSize: "0.85em", marginTop: "0.1rem" }}
                          >
                            {cs.excerpt.slice(0, 120).replace(/\s+/g, " ")}&hellip;
                          </span>
                        </span>
                      </label>
                    </div>
                  ))}
                </fieldset>
              )}

              {caseStudies.length === 0 && !isPending && (
                <p className="muted" style={{ marginBottom: "1rem" }}>
                  No case studies uploaded yet.{" "}
                  <a href="/case-studies/upload" className="btn secondary">
                    Upload case studies
                  </a>{" "}
                  to strengthen your proposals with real-world evidence.
                </p>
              )}

              {error && (
                <div
                  role="alert"
                  style={{ color: "var(--color-error, #b91c1c)", marginBottom: "1rem" }}
                >
                  {error}
                </div>
              )}

              <button type="submit" disabled={isPending}>
                {isPending ? "Generating draft\u2026" : "Generate Proposal Draft"}
              </button>
            </form>
          )}

          {currentDraft && (
            <section style={{ marginTop: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <h2 style={{ margin: 0 }}>{currentDraft.title}</h2>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setCurrentDraft(null)}
                  >
                    New Draft
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handlePrint}
                  >
                    Print / Save as PDF
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleExportForGoogleDocs}
                  >
                    Export for Google Docs
                  </button>
                </div>
              </div>
              <p className="muted" style={{ marginBottom: "1.25rem" }}>
                Generated {formatDate(currentDraft.createdAt)}&nbsp;&middot;&nbsp;
                {currentDraft.sections.length} sections&nbsp;&middot;&nbsp;
                Click any section body to edit inline.
              </p>

              {currentDraft.sections.map((section, idx) => (
                <div key={idx} className="card" style={{ marginBottom: "1rem" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>{section.title}</h3>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      minHeight: "3rem",
                      outline: "none",
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.6",
                    }}
                  >
                    {section.content}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setCurrentDraft(null)}
                >
                  Generate Another Draft
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      {tab === "history" && (
        <section>
          {drafts.length === 0 ? (
            <div className="empty">
              <p>
                No drafts generated yet. Use the{" "}
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setTab("generate")}
                >
                  Generate Draft
                </button>{" "}
                tab to create your first proposal.
              </p>
            </div>
          ) : (
            <>
              <p className="muted">
                Your {drafts.length} most recent proposal draft{drafts.length !== 1 ? "s" : ""}.
                Click a draft to view and edit it.
              </p>
              {drafts.map((draft) => (
                <div key={draft.id} className="card" style={{ marginBottom: "1rem" }}>
                  <strong>{draft.title}</strong>
                  <p className="muted" style={{ margin: "0.25rem 0" }}>
                    {formatDate(draft.createdAt)}&nbsp;&middot;&nbsp;
                    {draft.sections.length} section{draft.sections.length !== 1 ? "s" : ""}
                    {draft.caseStudyIds.length > 0 &&
                      `\u00a0\u00b7\u00a0${draft.caseStudyIds.length} case stud${draft.caseStudyIds.length !== 1 ? "ies" : "y"}`}
                  </p>
                  {draft.rfpContext.length > 0 && (
                    <p
                      className="muted"
                      style={{ fontSize: "0.85em", marginTop: "0.35rem" }}
                    >
                      {draft.rfpContext.slice(0, 160).replace(/\s+/g, " ")}&hellip;
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => handleViewDraft(draft)}
                    >
                      View &amp; Edit
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        setCurrentDraft(draft);
                        triggerHtmlDownload(draft);
                      }}
                    >
                      Export HTML
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => handleDeleteDraft(draft.id)}
                      disabled={isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}
    </main>
  );
}
