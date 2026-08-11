import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Project } from "../Projects/ProjectManager";
import { DocumentItem } from "../../App";
import {
  AlertCircleIcon, ArrowLeftIcon, CheckSquareIcon, ChevronRightIcon, ColumnSearchInput,
  EyeIcon, ExecutionSummaryBar, FileTextIcon, PriorityBadge, SeverityBadge,
  formatFileSize, parseBugReport, timeAgo,
} from "./shared";
import type { ExecutionSummary, StudioTestCaseItem } from "./shared";

// Ưu tiên hiển thị test case chưa chạy theo độ ưu tiên: High → Medium → Low (thứ đáng test
// trước luôn nổi lên đầu cột, không phải cuộn tìm).
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const byPriority = (a: StudioTestCaseItem, b: StudioTestCaseItem) =>
  (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);

// Chiều cao tối đa cho danh sách mỗi cột — vượt quá thì cuộn riêng trong cột, giữ trang gọn
// và 3 cột thẳng hàng (thay vì cả trang dài theo cột nhiều item nhất).
const COLUMN_LIST_MAX_HEIGHT = "calc(100vh - 300px)";

type ProjectWorkspaceViewProps = {
  selectedProject: Project | null;
  documents: DocumentItem[];
  isLoadingDocs: boolean;
  filteredDocuments: DocumentItem[];
  docSearch: string;
  onDocSearchChange: (v: string) => void;

  projectExecutionSummary: ExecutionSummary;
  isLoadingProjectTCs: boolean;

  projectBugReports: StudioTestCaseItem[];
  filteredBugReports: StudioTestCaseItem[];
  bugSearch: string;
  onBugSearchChange: (v: string) => void;

  projectUntestedCases: StudioTestCaseItem[];
  filteredUntestedCases: StudioTestCaseItem[];
  untestedSearch: string;
  onUntestedSearchChange: (v: string) => void;

  tcIdByCaseId: Map<string, string>;

  onGoBackToProjects: () => void;
  onGoToTestCases: (doc: DocumentItem) => void;
  onOpenBugReportDrawer: (tc: StudioTestCaseItem) => void;
};

export default function ProjectWorkspaceView({
  selectedProject,
  documents,
  isLoadingDocs,
  filteredDocuments,
  docSearch,
  onDocSearchChange,
  projectExecutionSummary,
  isLoadingProjectTCs,
  projectBugReports,
  filteredBugReports,
  bugSearch,
  onBugSearchChange,
  projectUntestedCases,
  filteredUntestedCases,
  untestedSearch,
  onUntestedSearchChange,
  tcIdByCaseId,
  onGoBackToProjects,
  onGoToTestCases,
  onOpenBugReportDrawer,
}: ProjectWorkspaceViewProps) {
  const sortedUntested = useMemo(
    () => [...filteredUntestedCases].sort(byPriority),
    [filteredUntestedCases],
  );

  return (
    <div className="tcs-view">
      <div className="tcs-view-header">
        <div className="tcs-breadcrumb">
          <button className="tcs-breadcrumb-btn" onClick={onGoBackToProjects}>
            <ArrowLeftIcon /> All Projects
          </button>
          <ChevronRightIcon />
          <span className="tcs-breadcrumb-current">{selectedProject?.name}</span>
        </div>
        <div className="tcs-view-title-row" style={{ marginTop: "12px" }}>
          <div className="tcs-title">
            <div className="tcs-title-icon" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
              <FileTextIcon />
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 600 }}>Project Workspace</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                Execution summary, documents, bug reports and untested cases
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tcs-view-body">
        {/* Project Execution Dashboard — tổng hợp toàn bộ document trong project */}
        {!isLoadingProjectTCs && projectExecutionSummary.total > 0 && (
          <div style={{ padding: "20px 28px 4px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "10px" }}>
              Project Execution Summary
            </div>
            <ExecutionSummaryBar summary={projectExecutionSummary} />
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(420px, 1.4fr) minmax(280px, 1fr) minmax(280px, 1fr)",
            alignItems: "start",
            gap: "28px",
            padding: "8px 28px 28px",
            maxWidth: "1560px",
          }}
        >
          {/* Document list */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
              <span style={{ color: "var(--accent)", display: "flex" }}><FileTextIcon /></span>
              Documents
              <span className="tc-count-badge">{documents.length}</span>
            </div>
            {documents.length > 0 && (
              <ColumnSearchInput value={docSearch} onChange={onDocSearchChange} placeholder="Search documents..." />
            )}
            {isLoadingDocs ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "64px 20px", color: "var(--text-muted)" }}>
                <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải danh sách Tài liệu...</span>
              </div>
            ) : documents.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "120px", borderRadius: "8px", border: "1px dashed var(--border)", color: "var(--text-muted)", fontSize: "12px", textAlign: "center", padding: "20px" }}>
                No documents yet — upload one from the project dashboard to generate requirements and test cases.
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 4px" }}>No documents match your search.</div>
            ) : (
              <div className="tcs-doc-list" style={{ padding: 0, maxHeight: COLUMN_LIST_MAX_HEIGHT, overflowY: "auto", paddingRight: "4px" }}>
                {filteredDocuments.map((doc: DocumentItem) => (
                  <div key={doc.id} className="tcs-doc-row">
                    <div className="tcs-doc-row-icon">
                      <FileTextIcon />
                    </div>
                    <div className="tcs-doc-row-info">
                      <div className="tcs-doc-row-name">{doc.original_filename}</div>
                      <div className="tcs-doc-row-meta">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{doc.file_type.toUpperCase()}</span>
                        <span>{timeAgo(doc.uploaded_at)}</span>
                      </div>
                    </div>
                    <div className="tcs-doc-row-actions">
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: "12px", padding: "6px 14px", gap: "5px" }}
                        onClick={() => onGoToTestCases(doc)}
                      >
                        <EyeIcon /> View TCs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bug Reports — sidebar bên phải, danh sách gọn các test case đang Fail của cả project */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
              <span style={{ color: "var(--danger)", display: "flex" }}><AlertCircleIcon /></span>
              Bug Reports
              <span className="tc-count-badge">{projectBugReports.length}</span>
            </div>
            {projectBugReports.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "120px", borderRadius: "8px", border: "1px dashed var(--border)", color: "var(--text-muted)", fontSize: "12px", textAlign: "center", padding: "20px" }}>
                No bug reports for this project yet.
              </div>
            ) : (
              <>
                <ColumnSearchInput value={bugSearch} onChange={onBugSearchChange} placeholder="Search bug reports..." />
                {filteredBugReports.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 4px" }}>No bug reports match your search.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: COLUMN_LIST_MAX_HEIGHT, overflowY: "auto", paddingRight: "4px" }}>
                    {filteredBugReports.map((tc: StudioTestCaseItem) => {
                      const fields = parseBugReport(tc.actual_result);
                      const docName = documents.find((d: DocumentItem) => d.id === tc.document_id)?.original_filename;
                      return (
                        <div
                          key={tc.id}
                          title={tc.title}
                          onClick={() => onOpenBugReportDrawer(tc)}
                          style={{
                            display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "5px",
                            padding: "8px 12px", borderRadius: "8px",
                            border: "1px solid var(--border)", background: "var(--bg-surface)",
                            cursor: "pointer", transition: "border-color var(--transition)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--danger)", flexShrink: 0, marginTop: "5px" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: "var(--accent)", marginBottom: "2px" }}>
                                {tcIdByCaseId.get(tc.id) || "TC-?"}
                              </div>
                              <span style={{
                                fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4,
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                              }}>
                                {tc.title}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingLeft: "16px" }}>
                            {docName && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {docName}
                              </span>
                            )}
                            <SeverityBadge severity={fields.severity} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Untested — cột lấp phần trống bên phải, danh sách test case chưa chạy của cả project */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
              <span style={{ color: "var(--text-muted)", display: "flex" }}><CheckSquareIcon /></span>
              Untested
              <span className="tc-count-badge">{projectUntestedCases.length}</span>
            </div>
            {projectUntestedCases.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "120px", borderRadius: "8px", border: "1px dashed var(--border)", color: "var(--text-muted)", fontSize: "12px", textAlign: "center", padding: "20px" }}>
                No untested cases — everything has been run at least once.
              </div>
            ) : (
              <>
                <ColumnSearchInput value={untestedSearch} onChange={onUntestedSearchChange} placeholder="Search untested cases..." />
                {filteredUntestedCases.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 4px" }}>No untested cases match your search.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: COLUMN_LIST_MAX_HEIGHT, overflowY: "auto", paddingRight: "4px" }}>
                    {sortedUntested.map((tc: StudioTestCaseItem) => {
                      const doc = documents.find((d: DocumentItem) => d.id === tc.document_id);
                      return (
                        <div
                          key={tc.id}
                          title={tc.title}
                          onClick={() => doc && onGoToTestCases(doc)}
                          style={{
                            display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "5px",
                            padding: "8px 12px", borderRadius: "8px",
                            border: "1px solid var(--border)", background: "var(--bg-surface)",
                            cursor: doc ? "pointer" : "default", transition: "border-color var(--transition)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--text-muted)", flexShrink: 0, marginTop: "5px" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: "var(--accent)", marginBottom: "2px" }}>
                                {tcIdByCaseId.get(tc.id) || "TC-?"}
                              </div>
                              <span style={{
                                fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4,
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                              }}>
                                {tc.title}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingLeft: "16px" }}>
                            {doc && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {doc.original_filename}
                              </span>
                            )}
                            <PriorityBadge priority={tc.priority} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
