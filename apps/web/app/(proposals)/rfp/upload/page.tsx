"use client";

/**
 * RFP Upload page — allows consultants to upload PDF/DOCX RFP documents and
 * automatically extracts evaluation criteria, budget signals, and mandatory
 * requirements via server action.
 */

import { type JSX, type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { parseRfpAction } from "@/lib/proposals/rfp-parser";
import type {
  ParsedRfp,
  EvaluationCriterion,
  BudgetSignal,
  MandatoryRequirement,
} from "@/lib/proposals/rfp-parser";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "parsing" }
  | { status: "done"; result: ParsedRfp; filename: string }
  | { status: "error"; message: string };

async function uploadAndParseRfp(file: File): Promise<ParsedRfp> {
  const formData = new FormData();
  formData.append("file", file);
  const result = await parseRfpAction(formData);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

function CriteriaTable({ criteria }: { criteria: EvaluationCriterion[] }): JSX.Element {
  if (criteria.length === 0) {
    return <p className="muted">No evaluation criteria detected.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Criterion</th>
          <th>Weight</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {criteria.map((c, idx) => (
          <tr key={idx}>
            <td>
              <strong>{c.label}</strong>
            </td>
            <td>{c.weight ?? "—"}</td>
            <td className="muted">{c.description.slice(0, 120)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BudgetList({ signals }: { signals: BudgetSignal[] }): JSX.Element {
  if (signals.length === 0) {
    return <p className="muted">No budget signals detected.</p>;
  }
  return (
    <ul>
      {signals.map((s, idx) => (
        <li key={idx}>
          <strong>{s.text}</strong>
          {s.amount && s.amount !== s.text && (
            <span className="muted"> ({s.amount})</span>
          )}
          <br />
          <span className="muted" style={{ fontSize: "0.875rem" }}>
            …{s.context.slice(0, 140)}…
          </span>
        </li>
      ))}
    </ul>
  );
}

function RequirementsList({ requirements }: { requirements: MandatoryRequirement[] }): JSX.Element {
  if (requirements.length === 0) {
    return <p className="muted">No mandatory requirements detected.</p>;
  }

  const byCategory = new Map<string, MandatoryRequirement[]>();
  for (const req of requirements) {
    const group = byCategory.get(req.category) ?? [];
    group.push(req);
    byCategory.set(req.category, group);
  }

  return (
    <>
      {Array.from(byCategory.entries()).map(([category, reqs]) => (
        <div key={category} style={{ marginBottom: "1rem" }}>
          <p>
            <strong>{category}</strong>{" "}
            <span className="muted">({reqs.length})</span>
          </p>
          <ul>
            {reqs.slice(0, 5).map((req, idx) => (
              <li key={idx}>{req.text.slice(0, 200)}</li>
            ))}
            {reqs.length > 5 && (
              <li className="muted">…and {reqs.length - 5} more</li>
            )}
          </ul>
        </div>
      ))}
    </>
  );
}

function ResultsPanel({ result, filename }: { result: ParsedRfp; filename: string }): JSX.Element {
  const [activeTab, setActiveTab] = useState<"criteria" | "budget" | "requirements" | "sections">(
    "criteria"
  );

  return (
    <div className="card" style={{ marginTop: "2rem" }}>
      <h2>Analysis: {filename}</h2>
      <p className="muted">
        {result.pageCount} page{result.pageCount !== 1 ? "s" : ""} ·{" "}
        {result.wordCount.toLocaleString()} words ·{" "}
        {result.evaluationCriteria.length} criteria ·{" "}
        {result.budgetSignals.length} budget signals ·{" "}
        {result.mandatoryRequirements.length} requirements
      </p>

      <div className="toolbar" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        {(
          [
            { key: "criteria", label: `Evaluation Criteria (${result.evaluationCriteria.length})` },
            { key: "budget", label: `Budget Signals (${result.budgetSignals.length})` },
            { key: "requirements", label: `Mandatory Req. (${result.mandatoryRequirements.length})` },
            { key: "sections", label: `Sections (${result.sections.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? "btn" : "btn secondary"}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "criteria" && <CriteriaTable criteria={result.evaluationCriteria} />}
      {activeTab === "budget" && <BudgetList signals={result.budgetSignals} />}
      {activeTab === "requirements" && (
        <RequirementsList requirements={result.mandatoryRequirements} />
      )}
      {activeTab === "sections" && (
        <ul>
          {result.sections.map((section, idx) => (
            <li key={idx}>
              <strong>{section.title}</strong>
              <span className="muted">
                {" "}
                — {section.content.slice(0, 80)}
                {section.content.length > 80 ? "…" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RfpUploadPage(): JSX.Element {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File): Promise<void> => {
    const accepted = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!accepted.includes(file.type) && ext !== "pdf" && ext !== "docx" && ext !== "doc") {
      setState({ status: "error", message: "Only PDF and DOCX files are supported." });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setState({ status: "error", message: "File must be under 50 MB." });
      return;
    }

    setState({ status: "uploading", progress: 0 });

    const progressInterval = setInterval(() => {
      setState((prev) =>
        prev.status === "uploading" && prev.progress < 80
          ? { status: "uploading", progress: prev.progress + 10 }
          : prev
      );
    }, 200);

    try {
      setState({ status: "parsing" });
      clearInterval(progressInterval);
      const result = await uploadAndParseRfp(file);
      setState({ status: "done", result, filename: file.name });
    } catch (err) {
      clearInterval(progressInterval);
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed. Please try again.",
      });
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (): void => {
    setDragOver(false);
  };

  const handleReset = (): void => {
    setState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main>
      <h1>RFP Upload &amp; Analysis</h1>
      <p>
        Upload a PDF or DOCX Request for Proposal to automatically extract evaluation
        criteria, budget signals, and mandatory requirements.
      </p>

      {state.status !== "done" && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${dragOver ? "#2563eb" : "#d1d5db"}`,
            borderRadius: "0.5rem",
            padding: "3rem 2rem",
            textAlign: "center",
            background: dragOver ? "rgba(37,99,235,0.04)" : "transparent",
            transition: "border-color 0.15s, background 0.15s",
            cursor: "pointer",
            marginTop: "1.5rem",
            marginBottom: "1.5rem",
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          aria-label="Upload RFP document"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            onChange={handleInputChange}
          />
          {state.status === "idle" && (
            <>
              <p style={{ fontSize: "1.125rem", fontWeight: 500 }}>
                Drop your RFP here or click to browse
              </p>
              <p className="muted">PDF or DOCX · up to 50 MB</p>
            </>
          )}
          {state.status === "uploading" && (
            <>
              <p style={{ fontWeight: 500 }}>Uploading… {state.progress}%</p>
              <div
                style={{
                  height: 6,
                  background: "#e5e7eb",
                  borderRadius: 3,
                  marginTop: "0.75rem",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${state.progress}%`,
                    background: "#2563eb",
                    transition: "width 0.2s",
                  }}
                />
              </div>
            </>
          )}
          {state.status === "parsing" && (
            <p style={{ fontWeight: 500 }}>Parsing document… extracting structure</p>
          )}
          {state.status === "error" && (
            <>
              <p style={{ color: "#b91c1c", fontWeight: 500 }}>{state.message}</p>
              <p className="muted">Click to try again</p>
            </>
          )}
        </div>
      )}

      {state.status === "done" && (
        <>
          <div style={{ marginTop: "1rem" }}>
            <button type="button" className="btn secondary" onClick={handleReset}>
              Upload Another RFP
            </button>
          </div>
          <ResultsPanel result={state.result} filename={state.filename} />
        </>
      )}
    </main>
  );
}
