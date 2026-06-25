"use server";

/**
 * RFP document parser — server actions + extraction utilities for PDF/DOCX RFP
 * documents. Extracts evaluation criteria, budget signals, and mandatory requirements.
 *
 * "use server" at file level: all exported async functions are server actions,
 * callable directly from "use client" components across the network boundary.
 * Native modules (pdf-parse, mammoth) are loaded via require() with webpackIgnore.
 */

export interface RfpSection {
  title: string;
  content: string;
}

export interface ParsedRfp {
  rawText: string;
  evaluationCriteria: EvaluationCriterion[];
  budgetSignals: BudgetSignal[];
  mandatoryRequirements: MandatoryRequirement[];
  sections: RfpSection[];
  pageCount: number;
  wordCount: number;
}

export interface EvaluationCriterion {
  label: string;
  weight: string | null;
  description: string;
}

export interface BudgetSignal {
  text: string;
  amount: string | null;
  context: string;
}

export interface MandatoryRequirement {
  text: string;
  category: string;
}

const BUDGET_PATTERNS = [
  /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|thousand|k|m|b))?/gi,
  /budget(?:\s+of)?\s*[:=]?\s*\$?[\d,]+/gi,
  /not\s+to\s+exceed\s+\$?[\d,]+/gi,
  /maximum\s+(?:budget|cost|price)\s+of\s+\$?[\d,]+/gi,
  /total\s+(?:contract\s+)?value\s+(?:of\s+)?\$?[\d,]+/gi,
  /award(?:ed)?\s+(?:up\s+to\s+)?\$?[\d,]+/gi,
];

const MANDATORY_KEYWORDS = [
  "must",
  "shall",
  "required",
  "mandatory",
  "minimum requirement",
  "will be required",
  "is required",
  "are required",
];

const EVAL_SECTION_PATTERNS = [
  /evaluation\s+(?:criteria|factors|methodology)/i,
  /scoring\s+(?:criteria|rubric|methodology)/i,
  /selection\s+criteria/i,
  /award\s+criteria/i,
  /basis\s+(?:of|for)\s+(?:evaluation|award|selection)/i,
];

/** Extract raw text from a PDF buffer using pdf-parse. */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // webpackIgnore: true
  const pdfParse = require(/* webpackIgnore: true */ "pdf-parse") as (
    buf: Buffer
  ) => Promise<{ text: string; numpages: number }>;
  const result = await pdfParse(buffer);
  return { text: result.text, pageCount: result.numpages };
}

/** Extract raw text from a DOCX buffer using mammoth. */
async function extractDocxText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // webpackIgnore: true
  const mammoth = require(/* webpackIgnore: true */ "mammoth") as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  const pageEstimate = Math.max(1, Math.ceil(result.value.length / 3000));
  return { text: result.value, pageCount: pageEstimate };
}

const SECTION_HEADING_RE = /^(?:[A-Z][A-Z\s\d.]{2,60}|[IVXLCDM]+\.\s+[A-Z][^\n]{3,60})$/;

function isSectionHeading(line: string): boolean {
  return SECTION_HEADING_RE.test(line);
}

/** Split raw text into logical sections based on common RFP heading patterns. */
function extractSections(text: string): RfpSection[] {
  const lines = text.split("\n");
  const sections: RfpSection[] = [];
  let currentTitle = "Introduction";
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && isSectionHeading(trimmed)) {
      if (currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
      }
      currentTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
  }
  return sections.filter((s) => s.content.length > 20);
}

/** Extract evaluation criteria from the parsed text and sections. */
function extractEvaluationCriteria(text: string, sections: RfpSection[]): EvaluationCriterion[] {
  const criteria: EvaluationCriterion[] = [];

  const evalSection = sections.find((s) =>
    EVAL_SECTION_PATTERNS.some((p) => p.test(s.title))
  );
  const searchText = evalSection ? evalSection.content : text;

  const weightedPattern =
    /([A-Z][^\n]{5,100})\s*[\-–—:]\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|points?|pts?)/gi;
  let match: RegExpExecArray | null;
  while ((match = weightedPattern.exec(searchText)) !== null) {
    criteria.push({
      label: match[1].trim(),
      weight: match[2] + (match[0].includes("%") ? "%" : " points"),
      description: match[1].trim(),
    });
  }

  const bulletPattern = /^[\s•\-*–]\s*([A-Z][^\n]{10,200})$/gm;
  if (evalSection && criteria.length < 3) {
    let bm: RegExpExecArray | null;
    while ((bm = bulletPattern.exec(evalSection.content)) !== null) {
      const label = bm[1].trim();
      if (!criteria.some((c) => c.label === label)) {
        criteria.push({ label, weight: null, description: label });
      }
    }
  }

  const commonCriteria = [
    "Technical Approach",
    "Management Approach",
    "Past Performance",
    "Price",
    "Qualifications",
    "Experience",
  ];
  for (const common of commonCriteria) {
    const re = new RegExp(`${common}[^\\n]{0,150}`, "i");
    const cm = re.exec(text);
    if (cm && !criteria.some((c) => c.label.toLowerCase().includes(common.toLowerCase()))) {
      criteria.push({ label: common, weight: null, description: cm[0].trim() });
    }
  }

  return criteria.slice(0, 20);
}

/** Extract budget signals (dollar amounts, budget ranges) from text. */
function extractBudgetSignals(text: string): BudgetSignal[] {
  const signals: BudgetSignal[] = [];
  const seen = new Set<string>();

  for (const pattern of BUDGET_PATTERNS) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const matchText = match[0].trim();
      if (seen.has(matchText)) continue;
      seen.add(matchText);

      const start = Math.max(0, match.index - 80);
      const end = Math.min(text.length, match.index + matchText.length + 80);
      const context = text.slice(start, end).replace(/\s+/g, " ").trim();

      const amountMatch = /\$[\d,]+(?:\.\d{2})?/.exec(matchText);
      signals.push({
        text: matchText,
        amount: amountMatch ? amountMatch[0] : null,
        context,
      });
    }
  }

  return signals.slice(0, 15);
}

/** Extract mandatory requirements (must/shall sentences) from text. */
function extractMandatoryRequirements(text: string): MandatoryRequirement[] {
  const requirements: MandatoryRequirement[] = [];
  const sentences = text.split(/[.!?]+/).map((s) => s.replace(/\s+/g, " ").trim());

  for (const sentence of sentences) {
    if (sentence.length < 15 || sentence.length > 500) continue;
    const lower = sentence.toLowerCase();
    const keyword = MANDATORY_KEYWORDS.find((kw) => lower.includes(kw));
    if (!keyword) continue;

    let category = "General";
    if (/insurance|bonding|license|certification/i.test(sentence)) category = "Compliance";
    else if (/experience|year[s]?\s+of/i.test(sentence)) category = "Qualifications";
    else if (/submit|deliver|provide|include/i.test(sentence)) category = "Submission";
    else if (/technical/i.test(sentence)) category = "Technical";
    else if (/financial|fiscal|revenue|profit/i.test(sentence)) category = "Financial";

    requirements.push({ text: sentence, category });
  }

  const unique = Array.from(
    new Map(requirements.map((r) => [r.text, r])).values()
  );
  return unique.slice(0, 30);
}

/**
 * Parse an RFP document buffer and extract structured information.
 *
 * @param buffer - Raw file buffer (PDF or DOCX)
 * @param mimeType - MIME type of the uploaded file
 * @returns Structured ParsedRfp object
 */
export async function parseRfpDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedRfp> {
  let rawText: string;
  let pageCount: number;

  if (mimeType === "application/pdf" || mimeType === "application/x-pdf") {
    const result = await extractPdfText(buffer);
    rawText = result.text;
    pageCount = result.pageCount;
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await extractDocxText(buffer);
    rawText = result.text;
    pageCount = result.pageCount;
  } else {
    throw new Error(`Unsupported file type: ${mimeType}. Please upload a PDF or DOCX file.`);
  }

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const sections = extractSections(rawText);
  const evaluationCriteria = extractEvaluationCriteria(rawText, sections);
  const budgetSignals = extractBudgetSignals(rawText);
  const mandatoryRequirements = extractMandatoryRequirements(rawText);

  return {
    rawText,
    evaluationCriteria,
    budgetSignals,
    mandatoryRequirements,
    sections,
    pageCount,
    wordCount,
  };
}

/**
 * Validate that the uploaded file is an acceptable RFP document type.
 *
 * @param mimeType - MIME type string from the upload
 * @param filename - Original filename for extension fallback
 * @returns true if the file is acceptable
 */
export async function isValidRfpFileType(mimeType: string, filename: string): Promise<boolean> {
  const acceptedMimeTypes = new Set([
    "application/pdf",
    "application/x-pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ]);
  if (acceptedMimeTypes.has(mimeType)) return true;

  const ext = filename.split(".").pop()?.toLowerCase();
  return ext === "pdf" || ext === "docx" || ext === "doc";
}

/**
 * Format parsed RFP results into a human-readable summary string.
 *
 * @param parsed - The ParsedRfp result object
 * @returns Formatted summary text
 */
export async function formatRfpSummary(parsed: ParsedRfp): Promise<string> {
  const lines: string[] = [
    `RFP Analysis Summary`,
    `====================`,
    `Pages: ${parsed.pageCount} | Words: ${parsed.wordCount.toLocaleString()}`,
    "",
  ];

  if (parsed.evaluationCriteria.length > 0) {
    lines.push("EVALUATION CRITERIA:");
    for (const criterion of parsed.evaluationCriteria) {
      const weight = criterion.weight ? ` (${criterion.weight})` : "";
      lines.push(`  • ${criterion.label}${weight}`);
    }
    lines.push("");
  }

  if (parsed.budgetSignals.length > 0) {
    lines.push("BUDGET SIGNALS:");
    for (const signal of parsed.budgetSignals) {
      lines.push(`  • ${signal.text}`);
      lines.push(`    Context: ${signal.context.slice(0, 120)}...`);
    }
    lines.push("");
  }

  if (parsed.mandatoryRequirements.length > 0) {
    lines.push(`MANDATORY REQUIREMENTS (${parsed.mandatoryRequirements.length} found):`);
    const byCategory = new Map<string, MandatoryRequirement[]>();
    for (const req of parsed.mandatoryRequirements) {
      const group = byCategory.get(req.category) ?? [];
      group.push(req);
      byCategory.set(req.category, group);
    }
    for (const [category, reqs] of byCategory) {
      lines.push(`  [${category}]`);
      for (const req of reqs.slice(0, 3)) {
        lines.push(`    • ${req.text.slice(0, 150)}`);
      }
    }
  }

  return lines.join("\n");
}

export type ParseRfpResult = ParsedRfp | { error: string };

/**
 * Server action: accept a FormData containing a "file" entry (PDF or DOCX),
 * parse it, and return structured extraction results.
 *
 * Called directly from the "use client" upload page across the Next.js
 * server-action boundary — no separate API route required.
 *
 * @param formData - Multipart form data with a "file" field
 * @returns ParsedRfp on success, or { error: string } on validation/parse failure
 */
export async function parseRfpAction(formData: FormData): Promise<ParseRfpResult> {
  try {
    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return { error: "No file provided. Please select a PDF or DOCX document." };
    }
    if (!(await isValidRfpFileType(fileEntry.type, fileEntry.name))) {
      return { error: "Unsupported file type. Please upload a PDF or DOCX file." };
    }
    if (fileEntry.size === 0) {
      return { error: "The uploaded file is empty." };
    }
    if (fileEntry.size > 50 * 1024 * 1024) {
      return { error: "File exceeds the 50 MB limit. Please upload a smaller document." };
    }
    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseRfpDocument(buffer, fileEntry.type);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse the document.";
    return { error: message };
  }
}
