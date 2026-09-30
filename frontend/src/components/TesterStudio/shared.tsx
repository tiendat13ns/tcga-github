import { Search, X } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

// Một ô trong ma trận chạy thử Environment × Lần chạy của 1 test case (Tester Studio).
// Tester tự thêm environment (VD "Desktop-Chrome") và lần chạy khi cần — không có danh sách cố định.
// CHỈ chứa kết quả Pass/Fail/Blocked của lần chạy đó — actual_result/bug_reference/note dùng
// chung cho cả test case, xem StudioTestCaseItem (đúng cấu trúc file mẫu: 1 cột Mã lỗi/Ghi chú
// cho cả dòng, không lặp lại theo từng ô).
export type TestExecutionItem = {
  id: string;
  test_case_id: string;
  environment: string;
  run_number: number;
  result: string; // Untested | Pass | Fail | Blocked
  executed_by?: string | null;
  executed_at?: string | null;
};

export type StudioTestCaseItem = {
  id: string;
  requirement_id?: string;
  document_id?: string;
  title: string;
  scenario?: string;
  preconditions?: string;
  test_steps: string[];
  test_data?: string;
  expected_result?: string;
  actual_result?: string;
  priority: string;
  severity?: string;
  test_type?: string;
  automation_candidate?: boolean;
  execution_type?: string;
  execution_status?: string;
  status: string;
  note?: string;
  bug_reference?: string | null;
  version?: number;
  feature_name?: string;
  requirement_title?: string;
  project_id?: string;
  module_name?: string;
  executions?: TestExecutionItem[];
};

export type StudioView = "projects" | "documents" | "testcases";

export type ExecutionSummary = { Pass: number; Fail: number; Blocked: number; Untested: number; total: number };

export type BugReportFields = {
  actualResult: string;
  stepsToReproduce: string;
  environment: string;
  severity: string;
};

/* ══════════════════════════════════════════════════════════════
   Icons
   ══════════════════════════════════════════════════════════════ */
export const FlaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6" /><path d="M10 9l-3 9a2 2 0 002 2h6a2 2 0 002-2l-3-9V3" /><path d="M7 14h10" />
  </svg>
);
export const FolderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);
export const FileTextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
export const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
export const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
export const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
export const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "tcs-spin 0.7s linear infinite" }}>
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);
export const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
export const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
export const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
export const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
export const CheckSquareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);
export const AlertCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
export const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   Badges, search box, formatters
   ══════════════════════════════════════════════════════════════ */
export function PriorityBadge({ priority }: { priority: string }) {
  const colorMap: Record<string, string> = {
    High: "var(--danger)",
    Medium: "var(--warning)",
    Low: "var(--accent)",
  };
  const color = colorMap[priority] || "var(--text-muted)";
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-mono)",
      color, padding: "2px 8px", borderRadius: "4px",
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      whiteSpace: "nowrap",
    }}>
      {priority}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    Critical: "var(--danger)",
    High: "var(--warning)",
    Medium: "var(--text-secondary)",
    Low: "var(--text-muted)",
  };
  const color = colorMap[severity] || "var(--text-muted)";
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-mono)",
      color, padding: "2px 8px", borderRadius: "4px",
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {severity}
    </span>
  );
}

// Màu theo trạng thái chạy thử (Pass/Fail/Blocked/Untested) — dùng chung cho cột Execution
// tổng và từng ô trong ma trận Environment × Lần chạy.
export function executionResultColor(result?: string): string {
  switch (result) {
    case "Pass": return "var(--success)";
    case "Fail": return "var(--danger)";
    case "Blocked": return "var(--warning)";
    default: return "var(--text-muted)";
  }
}

export function ColumnSearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative", marginBottom: "10px" }}>
      <Search size={13} strokeWidth={1.75} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", height: "30px", padding: "6px 26px 6px 30px", boxSizing: "border-box",
          borderRadius: "6px", background: "var(--bg-surface)", color: "var(--text-primary)",
          border: "1px solid var(--border)", fontSize: "12px", outline: "none",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
            padding: 0, display: "flex", alignItems: "center",
          }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export function timeAgo(dateString: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
  } catch { return dateString; }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ── Execution summary: tổng hợp Pass/Fail/Blocked/Untested, dùng chung
   cho cả bảng test case (theo document) và dashboard cấp project. ── */
export function computeExecutionSummary(items: StudioTestCaseItem[]): ExecutionSummary {
  const counts = { Pass: 0, Fail: 0, Blocked: 0, Untested: 0 };
  for (const tc of items) {
    const key = (tc.execution_status || "Untested") as keyof typeof counts;
    counts[key in counts ? key : "Untested"]++;
  }
  return { ...counts, total: items.length };
}

export function ExecutionSummaryBar({ summary }: { summary: ExecutionSummary }) {
  if (summary.total === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", height: "6px", width: "180px", borderRadius: "3px", overflow: "hidden", background: "var(--bg-surface)", border: "1px solid var(--border)", flexShrink: 0 }}>
        {summary.Pass > 0 && <div style={{ width: `${(summary.Pass / summary.total) * 100}%`, background: "var(--success)" }} />}
        {summary.Fail > 0 && <div style={{ width: `${(summary.Fail / summary.total) * 100}%`, background: "var(--danger)" }} />}
        {summary.Blocked > 0 && <div style={{ width: `${(summary.Blocked / summary.total) * 100}%`, background: "var(--warning)" }} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: "var(--text-secondary)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--success)", display: "inline-block", flexShrink: 0 }} />
          Pass <strong style={{ color: "var(--text-primary)" }}>{summary.Pass}</strong>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--danger)", display: "inline-block", flexShrink: 0 }} />
          Fail <strong style={{ color: "var(--text-primary)" }}>{summary.Fail}</strong>
        </span>
        {summary.Blocked > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--warning)", display: "inline-block", flexShrink: 0 }} />
            Blocked <strong style={{ color: "var(--text-primary)" }}>{summary.Blocked}</strong>
          </span>
        )}
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--text-muted)", display: "inline-block", flexShrink: 0 }} />
          Untested <strong style={{ color: "var(--text-primary)" }}>{summary.Untested}</strong>
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {Math.round((summary.Pass / summary.total) * 100)}% pass rate
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Bug Report: các trường nhập thủ công được gộp thành 1 chuỗi có cấu trúc
   để lưu vào cột actual_result hiện có (không cần đổi schema DB), và có thể
   parse ngược lại thành từng trường khi mở lại bug report sau này.
   ══════════════════════════════════════════════════════════════ */
export const DEFAULT_BUG_REPORT_FIELDS: BugReportFields = {
  actualResult: "",
  stepsToReproduce: "",
  environment: "",
  severity: "Medium",
};

const BUG_REPORT_SECTION_KEYS = ["Actual Result", "Steps to Reproduce", "Environment", "Severity"] as const;
const BUG_REPORT_SECTION_HEADER = /^\[(Actual Result|Steps to Reproduce|Environment|Severity)\]$/;

export function serializeBugReport(fields: BugReportFields): string {
  return [
    `[Actual Result]\n${fields.actualResult.trim()}`,
    `[Steps to Reproduce]\n${fields.stepsToReproduce.trim()}`,
    `[Environment]\n${fields.environment.trim()}`,
    `[Severity]\n${fields.severity.trim()}`,
  ].join("\n\n");
}

export function parseBugReport(raw: string | undefined): BugReportFields {
  if (!raw || !raw.trim()) return { ...DEFAULT_BUG_REPORT_FIELDS };

  const lines = raw.split("\n");
  const isStructured = lines.some((line) => BUG_REPORT_SECTION_HEADER.test(line.trim()));
  if (!isStructured) {
    // Dữ liệu cũ (freeform hoặc AI-generated trước đây) — hiển thị nguyên văn vào Actual Result.
    return { ...DEFAULT_BUG_REPORT_FIELDS, actualResult: raw };
  }

  const result: Partial<Record<(typeof BUG_REPORT_SECTION_KEYS)[number], string>> = {};
  let currentKey: (typeof BUG_REPORT_SECTION_KEYS)[number] | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey) result[currentKey] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const match = BUG_REPORT_SECTION_HEADER.exec(line.trim());
    if (match) {
      flush();
      currentKey = match[1] as (typeof BUG_REPORT_SECTION_KEYS)[number];
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  flush();

  return {
    actualResult: result["Actual Result"] || "",
    stepsToReproduce: result["Steps to Reproduce"] || "",
    environment: result["Environment"] || "",
    severity: result["Severity"] || "Medium",
  };
}
