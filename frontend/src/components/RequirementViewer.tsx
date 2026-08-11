import { useEffect, useState } from "react";
import { useDocumentDetail } from "../hooks/useRequirements";
import { apiFetch, downloadWithAuth } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_V1_REQUIREMENTS_URL = `${API_BASE}/api/v1/requirements`;
const API_V1_DOCUMENTS_URL = `${API_BASE}/api/v1/documents`;
const API_URL = `${API_BASE}/api/documents`;

export type RequirementItem = {
  id: string; title: string; description: string;
  functional_requirement: string | null; validation_rule: string[] | null;
  permission: string[] | null; workflow: string[] | null;
  state: string[] | null; error_handling: string[] | null;
  module_name: string | null; feature_name: string | null;
  actor: string | null; business_rules: string[] | null;
  inputs: string[] | null; outputs: string[] | null;
  preconditions: string[] | null; validation_rules: string[] | null;
  exception_flows: string[] | null; source_reference: string | null;
  status: string; version: number;
  clarifying_questions: string[] | null;
  user_answers: string[] | null;
};

export type GenerateRequirementsResponse = {
  document_id: string; project_id: string | null;
  total_requirements: number; requirements: RequirementItem[];
};

type TestCaseItem = {
  id: string; requirement_id: string; document_id: string | null;
  title: string; scenario: string | null; preconditions: string | null;
  test_steps: string[] | null; test_data: string | null;
  expected_result: string; priority: string; severity: string | null;
  test_type: string | null; automation_candidate: boolean;
  execution_type: string; status: string; version: number;
};

type GenerateTestCasesResponse = {
  requirement_id: string; document_id: string | null;
  total_test_cases: number; test_cases: TestCaseItem[];
};

type DocumentDetail = {
  id: string; original_filename: string; status: string;
  text_length: number; preview: string | null; error_message?: string | null;
};

type Props = {
  requirements: GenerateRequirementsResponse | null;
  document?: { original_filename: string; file_type: string; file_size: number } | null;
  onClose: () => void;
  onRequirementsUpdate: (reqs: GenerateRequirementsResponse) => void;
};

/* ── Icons ── */
const FlaskIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6" /><path d="M10 9l-3 9a2 2 0 002 2h6a2 2 0 002-2l-3-9V3" /><path d="M7 14h10" /></svg>;
const ZapIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const RefreshIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>;
const ChevronDown = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;
const ChevronUp = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>;
const XIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const FileTextIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const AlertIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const SpinnerIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>;
const EyeIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;

function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed" ? "badge-completed" : status === "processing" ? "badge-processing" : status === "error" ? "badge-error" : "badge-uploaded";
  return <span className={`badge ${cls}`}><span className="badge-dot" />{status}</span>;
}

function RequirementFieldList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) return <span className="req-field-empty">None</span>;
  return (
    <ul className="req-field-list">
      {items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
    </ul>
  );
}

export default function RequirementViewer({ requirements, document, onClose, onRequirementsUpdate }: Props) {
  const [testCasesMap, setTestCasesMap] = useState<Record<string, GenerateTestCasesResponse | null>>({});
  const [generatingTestCasesId, setGeneratingTestCasesId] = useState<string | null>(null);
  const [expandedTestCasesId, setExpandedTestCasesId] = useState<string | null>(null);
  const [qaAnswersDraft, setQaAnswersDraft] = useState<Record<string, string[]>>({});
  const [submittingAnswersId, setSubmittingAnswersId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<DocumentDetail | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [expandedPreview, setExpandedPreview] = useState(false);

  // Use React Query to fetch document detail when not provided via prop
  const { data: fetchedDoc } = useDocumentDetail(
    !document && requirements ? requirements.document_id : null
  );
  const internalDoc = document ?? fetchedDoc ?? null;

  // Load existing test cases on requirements change (with auth headers)
  useEffect(() => {
    if (!requirements) return;
    requirements.requirements.forEach(async (req) => {
      if (testCasesMap[req.id] === undefined && !generatingTestCasesId) {
        try {
          const r = await apiFetch(`${API_V1_REQUIREMENTS_URL}/${req.id}/test-cases`);
          if (r.ok) {
            const d = await r.json();
            setTestCasesMap((prev) => ({ ...prev, [req.id]: d.total_test_cases > 0 ? d : null }));
          } else {
            setTestCasesMap((prev) => ({ ...prev, [req.id]: null }));
          }
        } catch {
          setTestCasesMap((prev) => ({ ...prev, [req.id]: null }));
        }
      }
    });
  }, [requirements]);

  // Load document preview (with auth headers)
  const loadDocumentPreview = async () => {
    if (!requirements) return;
    const docId = requirements.document_id;
    setLoadingPreviewId(docId);
    try {
      const r = await apiFetch(`${API_URL}/${docId}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.detail || "Could not load preview.");
      setSelectedDocumentDetail(d);
      setExpandedPreview(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cannot connect to backend.");
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const generateTestCases = async (requirementId: string) => {
    setGeneratingTestCasesId(requirementId); setMessage("");
    try {
      const r = await apiFetch(`${API_V1_REQUIREMENTS_URL}/${requirementId}/test-cases/generate`, {
        method: "POST",
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.detail || "Could not generate test cases.");
      setTestCasesMap((prev) => ({ ...prev, [requirementId]: d }));
      setExpandedTestCasesId(requirementId);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Cannot connect to backend."); }
    finally { setGeneratingTestCasesId(null); }
  };

  const submitAnswersAndGenerate = async (req: RequirementItem) => {
    const drafts = qaAnswersDraft[req.id] || [];
    const numQuestions = req.clarifying_questions?.length || 0;
    const answers = Array.from({ length: numQuestions }, (_, i) => drafts[i] || "");

    setSubmittingAnswersId(req.id); setMessage("");
    try {
      const r = await apiFetch(`${API_V1_REQUIREMENTS_URL}/${req.id}/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const saved = await r.json().catch(() => null);
      if (!r.ok) throw new Error(saved?.detail || "Could not save answers.");

      const updatedReqs = {
        ...requirements!,
        requirements: requirements!.requirements.map((r) =>
          r.id === req.id ? { ...r, user_answers: saved.user_answers } : r
        ),
      };
      onRequirementsUpdate(updatedReqs);

      await generateTestCases(req.id);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Cannot connect to backend."); }
    finally { setSubmittingAnswersId(null); }
  };

  const handleGoToTesterStudio = (reqId: string) => {
    if (!requirements) return;
    const docId = requirements.document_id;
    const projId = requirements.project_id || "";
    const docName = internalDoc?.original_filename || "";
    const params = new URLSearchParams();
    if (docId) params.append("document_id", docId);
    if (projId) params.append("project_id", projId);
    if (docName) params.append("doc_name", docName);
    if (reqId) params.append("req_id", reqId);

    const url = `/test-cases?${params.toString()}`;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("popstate"));
    onClose();
  };

  if (!requirements) {
    return (
      <div className="rv-empty panel animate-in">
        <div className="rv-empty-icon">📋</div>
        <div className="rv-empty-title">No requirements loaded</div>
        <div className="rv-empty-body">
          Select a document from the list and click <strong>View Requirement</strong> to get started.
        </div>
      </div>
    );
  }

  // Generate a short summary for the header
  let summary = "";
  if (requirements.requirements.length > 0) {
    const firstReq = requirements.requirements[0];
    summary = firstReq.feature_name || firstReq.module_name || firstReq.title || "Unknown module";
    if (summary.length > 50) {
      summary = summary.substring(0, 47) + "...";
    }
  }

  return (
    <section className="animate-in rv-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div className="panel-header" style={{ alignItems: "flex-start", backgroundColor: "var(--bg-surface)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="panel-title">Requirements for: {internalDoc?.original_filename || "Document"}</span>
            <span className="rv-req-count" title="Total requirements">{requirements.total_requirements}</span>
          </div>
          {summary && (
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 400 }}>
              Module/Feature: <span style={{ color: "var(--text-primary)" }}>{summary}</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!loadingPreviewId}
            onClick={loadDocumentPreview}
          >
            {loadingPreviewId ? <><SpinnerIcon /> Loading...</> : <><EyeIcon /> Source Preview</>}
          </button>
        </div>
      </div>

      {/* Error message */}
      {message && (
        <div className="msg msg-error" style={{ margin: "0 18px 0" }}>
          <AlertIcon />{message}
        </div>
      )}

      {/* Source document preview (collapsible) */}
      {selectedDocumentDetail && (
        <div className="rv-preview-panel">
          <div className="rv-preview-header" onClick={() => setExpandedPreview((v) => !v)}>
            <span className="rv-preview-title">
              <FileTextIcon /> {selectedDocumentDetail.original_filename}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {selectedDocumentDetail.text_length.toLocaleString()} chars
              </span>
              {expandedPreview ? <ChevronUp /> : <ChevronDown />}
              <button type="button" className="btn btn-secondary" style={{ padding: "2px 6px" }}
                onClick={(e) => { e.stopPropagation(); setSelectedDocumentDetail(null); }}>
                <XIcon />
              </button>
            </div>
          </div>
          {expandedPreview && (
            <pre className="text-preview rv-preview-body">
              {selectedDocumentDetail.preview || "No extracted text preview available."}
            </pre>
          )}
        </div>
      )}

      {/* Requirements list */}
      <div style={{ padding: "18px" }}>
        <div className="req-list">
          {requirements.requirements.map((req, idx) => {
            const hasTestCases = Boolean(testCasesMap[req.id] && testCasesMap[req.id]!.total_test_cases > 0);
            return (
              <article className="req-card animate-in" key={req.id} data-status={req.status}>
                <div className="req-card-header" style={{ justifyContent: "flex-end" }}>
                  <div className="req-card-actions">
                    <StatusBadge status={req.status} />
                    <button
                      type="button"
                      className="btn btn-purple"
                      disabled={!hasTestCases}
                      onClick={() => handleGoToTesterStudio(req.id)}
                      title={hasTestCases ? "Chuyển tới Tester Studio với các test case đã tạo" : "Chưa có test case"}
                      style={!hasTestCases ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                    >
                      <FlaskIcon /> Test trong Tester Studio
                    </button>
                    {testCasesMap[req.id] && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setExpandedTestCasesId((prev) => prev === req.id ? null : req.id)}
                      >
                        {expandedTestCasesId === req.id
                          ? <><ChevronUp /> Hide ({testCasesMap[req.id]!.total_test_cases})</>
                          : <><ChevronDown /> Show ({testCasesMap[req.id]!.total_test_cases})</>}
                      </button>
                    )}
                  </div>
                </div>

              <div className="req-card-body">
                {req.functional_requirement && (
                  <div className="req-field">
                    <div className="req-field-label">Functional Requirement</div>
                    <div className="req-field-value">{req.functional_requirement}</div>
                  </div>
                )}
                {req.validation_rule && req.validation_rule.length > 0 && (
                  <div className="req-field">
                    <div className="req-field-label">Validation Rules</div>
                    <RequirementFieldList items={req.validation_rule} />
                  </div>
                )}
                {req.workflow && req.workflow.length > 0 && (
                  <div className="req-field">
                    <div className="req-field-label">Workflow</div>
                    <RequirementFieldList items={req.workflow} />
                  </div>
                )}
                {req.error_handling && req.error_handling.length > 0 && (
                  <div className="req-field">
                    <div className="req-field-label">Error Handling</div>
                    <RequirementFieldList items={req.error_handling} />
                  </div>
                )}
                {/* HITL Q&A Panel */}
                {(!testCasesMap[req.id] && generatingTestCasesId !== req.id) && req.clarifying_questions && req.clarifying_questions.length > 0 && (
                  <div className="hitl-qa-panel">
                    <div className="hitl-qa-header">
                      <span className="hitl-qa-icon">⚠️</span>
                      <span className="hitl-qa-title">AI cần làm rõ {req.clarifying_questions.length} điểm trước khi tạo Test Case</span>
                      {req.user_answers?.length
                        ? <span className="badge badge-completed" style={{ marginLeft: "auto" }}>Đã trả lời</span>
                        : <span className="badge badge-processing" style={{ marginLeft: "auto" }}>Chờ trả lời</span>}
                    </div>
                    <div className="hitl-qa-body">
                      {req.clarifying_questions.map((q, qIdx) => (
                        <div key={qIdx} className="hitl-qa-item">
                          <div className="hitl-qa-question">
                            <span className="hitl-q-num">Q{qIdx + 1}</span>
                            <span>{q}</span>
                          </div>
                          <textarea
                            className="hitl-qa-answer"
                            placeholder={req.user_answers?.[qIdx] || "Nhập câu trả lời của bạn..."}
                            value={qaAnswersDraft[req.id]?.[qIdx] ?? (req.user_answers?.[qIdx] || "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQaAnswersDraft((prev) => {
                                const arr = [...(prev[req.id] || Array(req.clarifying_questions!.length).fill(""))];
                                arr[qIdx] = val;
                                return { ...prev, [req.id]: arr };
                              });
                            }}
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Cases Panel */}
                {expandedTestCasesId === req.id && testCasesMap[req.id] && (
                  <div className="tc-panel">
                    <div className="tc-panel-header">
                      <span className="tc-panel-title">Test Cases</span>
                      <span className="tc-count-badge">{testCasesMap[req.id]!.total_test_cases}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        type="button"
                        onClick={() => {
                          downloadWithAuth(
                            `${API_V1_REQUIREMENTS_URL}/${req.id}/test-cases/export`,
                            `test_cases_${req.id.slice(0, 8)}.xlsx`
                          ).catch((e) => setMessage(e instanceof Error ? e.message : "Could not export file."));
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "11px", gap: "6px", textDecoration: "none" }}
                      >
                        <FileTextIcon /> Export Excel
                      </button>
                    </div>
                    <div className="tc-table-wrap">
                      <table className="tc-table">
                        <thead>
                          <tr>
                            <th style={{ width: "8%" }}>Feature</th>
                            <th style={{ width: "8%" }}>Test Case ID</th>
                            <th style={{ width: "16%" }}>Test Item</th>
                            <th style={{ width: "15%" }}>Precondition</th>
                            <th style={{ width: "20%" }}>Test Steps</th>
                            <th style={{ width: "16%" }}>Test Data</th>
                            <th style={{ width: "16%" }}>Expected Output</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testCasesMap[req.id]!.test_cases.map((tc, tcIdx) => (
                            <tr key={tc.id} className="animate-in">
                              <td>{req.feature_name || req.title || "N/A"}</td>
                              <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                                TC-{String(tcIdx + 1).padStart(2, "0")}
                              </td>
                              <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{tc.title}</td>
                              <td>{tc.preconditions || ""}</td>
                              <td>
                                {tc.test_steps && tc.test_steps.length > 0 ? (
                                  <ol style={{ margin: 0, paddingLeft: "16px" }}>
                                    {tc.test_steps.map((step, si) => <li key={si}>{step}</li>)}
                                  </ol>
                                ) : null}
                              </td>
                              <td>{tc.test_data || ""}</td>
                              <td>{tc.expected_result}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
