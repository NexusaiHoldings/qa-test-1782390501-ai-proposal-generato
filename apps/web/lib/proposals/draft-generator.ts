"use server";

import { getSessionUser } from "@/lib/admin-auth";
import { listCaseStudies, type CaseStudy } from "@/lib/proposals/case-study-manager";

export type { CaseStudy };

export interface DraftSection {
  title: string;
  content: string;
}

export interface ProposalDraft {
  id: string;
  userId: string;
  title: string;
  rfpContext: string;
  companyProfile: string;
  caseStudyIds: string[];
  sections: DraftSection[];
  createdAt: string;
  status: string;
}

export type GenerateDraftResult = ProposalDraft | { error: string };
export type LoadStudiesResult = CaseStudy[] | { error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
} {
  if (_pool) return _pool;
  const { Pool: PgPool } = require("pg") as {
    Pool: new (cfg: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

async function ensureTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposals_drafts (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         TEXT        NOT NULL,
      title           TEXT        NOT NULL,
      rfp_context     TEXT        NOT NULL DEFAULT '',
      company_profile TEXT        NOT NULL DEFAULT '',
      case_study_ids  TEXT[]      NOT NULL DEFAULT '{}',
      sections_json   TEXT        NOT NULL DEFAULT '[]',
      status          TEXT        NOT NULL DEFAULT 'draft',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function rowToProposalDraft(row: Record<string, unknown>): ProposalDraft {
  let sections: DraftSection[] = [];
  try {
    sections = JSON.parse(row.sections_json as string) as DraftSection[];
  } catch {
    sections = [];
  }
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    rfpContext: row.rfp_context as string,
    companyProfile: row.company_profile as string,
    caseStudyIds: (row.case_study_ids as string[]) ?? [],
    sections,
    createdAt:
      row.created_at instanceof Date
        ? (row.created_at as Date).toISOString()
        : String(row.created_at),
    status: row.status as string,
  };
}

async function saveDraftToDb(
  userId: string,
  title: string,
  rfpContext: string,
  companyProfile: string,
  caseStudyIds: string[],
  sections: DraftSection[],
): Promise<ProposalDraft> {
  await ensureTable();
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO proposals_drafts
       (user_id, title, rfp_context, company_profile, case_study_ids, sections_json)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, title, rfp_context, company_profile, case_study_ids, sections_json, status, created_at`,
    [userId, title, rfpContext, companyProfile, caseStudyIds, JSON.stringify(sections)],
  );
  return rowToProposalDraft(result.rows[0]);
}

function generateTemplateDraft(rfpContext: string, companyProfile: string): string {
  const profile = companyProfile.slice(0, 120).replace(/\n/g, " ").trim();
  const context = rfpContext.slice(0, 200).replace(/\n/g, " ").trim();
  return `## Executive Summary

${profile} is pleased to present this proposal in response to the stated requirements. Our team brings deep expertise and a proven delivery track record. Having carefully reviewed the requirements — "${context}" — we are confident in our ability to deliver exceptional, measurable value within the defined scope and timeline.

## Technical Approach

Our methodology is grounded in industry best practices and tailored specifically to address each requirement identified in the RFP. We will begin with a comprehensive discovery and requirements-validation phase to align all stakeholders, followed by iterative design, development, testing, and deployment cycles. Our phased implementation approach reduces risk while allowing for continuous feedback and course correction. We leverage proven toolsets and frameworks to accelerate delivery without sacrificing quality or maintainability.

## Relevant Experience

Our portfolio includes numerous successful engagements with organizations of comparable size and complexity. The case studies referenced in this proposal demonstrate our ability to deliver on-time, reduce operational costs, and drive measurable outcomes for our clients. Each engagement builds on lessons learned to refine our approach and ensure repeatable success.

## Management Plan

Our dedicated project team will be led by a senior Project Manager with full accountability for scope, schedule, and budget. We employ an agile delivery framework with bi-weekly sprint reviews, weekly written status reports, and a dedicated client success liaison available for day-to-day communication. All milestones, risks, and action items are tracked in real time in our shared project management platform, ensuring complete transparency throughout the engagement.

## Budget Approach

Our pricing model is transparent, competitive, and structured to maximize value for the investment. We provide detailed line-item breakdowns so clients understand exactly where budget is allocated. We offer flexible engagement models — fixed-price, time-and-materials, or hybrid — and we are committed to delivering within the agreed budget without sacrificing quality.

## Conclusion

We appreciate the opportunity to present our capabilities and are enthusiastic about partnering to achieve your goals. Our team is uniquely positioned to deliver the results you need, and we welcome the opportunity to discuss this proposal in detail. We look forward to a successful collaboration.`;
}

function buildPrompt(
  rfpContext: string,
  companyProfile: string,
  caseStudies: CaseStudy[],
  proposalTitle: string,
): string {
  const caseStudySection =
    caseStudies.length > 0
      ? `RELEVANT CASE STUDIES:\n${caseStudies
          .map((cs) => `Title: ${cs.title}\nExcerpt:\n${cs.excerpt.slice(0, 600)}`)
          .join("\n\n---\n\n")}`
      : "No case studies provided — draw on general industry best practices.";

  return `You are an expert proposal writer with decades of experience writing winning government and commercial proposals.

Generate a detailed, compelling, and professional proposal draft based on the following inputs.

PROPOSAL TITLE: ${proposalTitle}

COMPANY PROFILE:
${companyProfile}

RFP REQUIREMENTS / CONTEXT:
${rfpContext}

${caseStudySection}

Instructions:
- Write a complete, professional proposal addressing the specific RFP requirements
- Reference provided case studies to demonstrate relevant experience
- Use exactly these section headings with ## prefix on their own line
- Write in a confident, professional tone; each section should be 2-4 substantive paragraphs
- Do not include meta-commentary or placeholders — every sentence must be final, usable copy

Required sections (use these exact ## headings):
## Executive Summary
## Technical Approach
## Relevant Experience
## Management Plan
## Budget Approach
## Conclusion`;
}

async function callClaudeApi(
  prompt: string,
  rfpContext: string,
  companyProfile: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateTemplateDraft(rfpContext, companyProfile);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `AI generation failed (${response.status}): ${errText.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

function parseGeneratedSections(text: string): DraftSection[] {
  const sectionPattern = /^##\s+(.+)$/gm;
  const matches = [...text.matchAll(sectionPattern)];

  if (matches.length === 0) {
    return [{ title: "Proposal Draft", content: text.trim() }];
  }

  const sections: DraftSection[] = [];
  for (let idx = 0; idx < matches.length; idx++) {
    const match = matches[idx];
    const title = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end =
      idx + 1 < matches.length
        ? matches[idx + 1].index ?? text.length
        : text.length;
    const content = text.slice(start, end).trim();
    sections.push({ title, content });
  }
  return sections;
}

export async function loadCaseStudiesAction(): Promise<LoadStudiesResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated. Please log in." };
  try {
    const studies = await listCaseStudies(user.id);
    return studies;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to load case studies.",
    };
  }
}

export async function generateDraftAction(
  formData: FormData,
): Promise<GenerateDraftResult> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated. Please log in." };

  const rfpContext = ((formData.get("rfpContext") as string) ?? "").trim();
  const companyProfile = ((formData.get("companyProfile") as string) ?? "").trim();
  const rawTitle = (formData.get("proposalTitle") as string) ?? "";
  const proposalTitle = rawTitle.trim() || "Untitled Proposal";
  const selectedIds = formData
    .getAll("caseStudyIds")
    .filter((v): v is string => typeof v === "string");

  if (!rfpContext) {
    return { error: "RFP context is required. Please describe the RFP requirements." };
  }
  if (!companyProfile) {
    return { error: "Company profile is required. Please describe your company." };
  }

  try {
    const allStudies = await listCaseStudies(user.id);
    const selectedStudies =
      selectedIds.length > 0
        ? allStudies.filter((s) => selectedIds.includes(s.id))
        : allStudies.slice(0, 3);

    const prompt = buildPrompt(rfpContext, companyProfile, selectedStudies, proposalTitle);
    const generatedText = await callClaudeApi(prompt, rfpContext, companyProfile);
    const sections = parseGeneratedSections(generatedText);

    const draft = await saveDraftToDb(
      user.id,
      proposalTitle,
      rfpContext,
      companyProfile,
      selectedStudies.map((s) => s.id),
      sections,
    );

    return draft;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to generate proposal draft.",
    };
  }
}

export async function listDraftsAction(): Promise<ProposalDraft[] | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  try {
    await ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, user_id, title, rfp_context, company_profile, case_study_ids, sections_json, status, created_at
       FROM proposals_drafts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.id],
    );
    return result.rows.map(rowToProposalDraft);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load drafts." };
  }
}

export async function getDraftAction(
  draftId: string,
): Promise<ProposalDraft | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  try {
    await ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, user_id, title, rfp_context, company_profile, case_study_ids, sections_json, status, created_at
       FROM proposals_drafts
       WHERE id = $1 AND user_id = $2`,
      [draftId, user.id],
    );
    if (result.rows.length === 0) {
      return { error: "Draft not found or access denied." };
    }
    return rowToProposalDraft(result.rows[0]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load draft." };
  }
}

export async function deleteDraftAction(
  draftId: string,
): Promise<{ success: boolean } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  try {
    await ensureTable();
    const pool = getPool();
    await pool.query(
      `DELETE FROM proposals_drafts WHERE id = $1 AND user_id = $2`,
      [draftId, user.id],
    );
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete draft." };
  }
}
