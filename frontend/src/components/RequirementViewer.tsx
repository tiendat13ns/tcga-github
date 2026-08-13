import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDocumentDetail } from "../hooks/useRequirements";
import { useTestCases, testCaseKeys } from "../hooks/useTestCases";
import { useAuth } from "../contexts/AuthContext";
import { useJobTracker } from "../contexts/JobTrackerContext";
import { apiFetch } from "../lib/api";

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
  test_case_status?: string | null;
  test_case_error?: string | null;
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
  const queryClient = useQueryClient();
  // Trạng thái sinh test case chạy nền theo từng requirement: "generating" | "failed" | null.
  // Khởi tạo từ requirement.test_case_status (server) để mở lại drawer vẫn thấy "đang tạo".
  const [tcStatusMap, setTcStatusMap] = useState<Record<string, string | null>>({});
  const [submittingTcId, setSubmittingTcId] = useState<string | null>(null);  // đang gửi POST
  const [expandedTestCasesId, setExpandedTestCasesId] = useState<string | null>(null);
  const { refreshUser } = useAuth();
  const { trackTestCaseJob } = useJobTracker();  // toast toàn cục khi test case sinh xong dù đã đóng panel
  const [qaAnswersDraft, setQaAnswersDraft] = useState<Record<string, string[]>>({});
  const [submittingAnswersId, setSubmittingAnswersId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<DocumentDetail | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [expandedPreview, setExpandedPreview] = useState(false);
  // Mỗi requirement card mặc định thu gọn — tài liệu nhiều requirement sẽ không phải cuộn
  // qua hàng loạt nội dung full-text để tìm đúng cái cần xem.
  const [expandedReqIds, setExpandedReqIds] = useState<Set<string>>(new Set());

  const toggleReqExpanded = (id: string) => {
    setExpandedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandReq = (id: string) => {
    setExpandedReqIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  // Use React Query to fetch document detail when not provided via prop
  const { data: fetchedDoc } = useDocumentDetail(
    !document && requirements ? requirements.document_id : null
  );
  const internalDoc = document ?? fetchedDoc ?? null;

  // Khởi tạo trạng thái generating theo test_case_status của từng requirement (giá trị tức
  // thời từ prop — có thể đã cũ vì list document cache staleTime:Infinity). Effect bên dưới
  // sẽ fetch lại từ server để sửa nếu cũ.
  useEffect(() => {
    if (!requirements) return;
    setTcStatusMap((prev) => {
      const next = { ...prev };
      for (const req of requirements.requirements) {
        if (next[req.id] === undefined) next[req.id] = req.test_case_status ?? null;
      }
      return next;
    });
  }, [requirements]);

  // Trên mount / khi đổi document: fetch trạng thái test case MỚI NHẤT từ server (1 request
  // bulk /requirements/status — KHÔNG phải N+1) để phản ánh job đã bắt đầu TRONG LÚC panel
  // này đang đóng. requirements prop lấy từ cache list document (staleTime:Infinity) nên
  // test_case_status trong đó có thể vẫn là null dù server đã đánh dấu "generating" —
  // đây là lý do mở lại panel không thấy "Đang tạo". Fetch tươi này seed lại đúng, và nếu
  // có req đang generating thì poll bên dưới tự khởi động (anyTcGenerating -> true).
  const docId = requirements?.document_id;
  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch(`${API_V1_DOCUMENTS_URL}/${docId}/requirements/status`);
        if (!r.ok || cancelled) return;
        const data = await r.json();
        const reqs: { id: string; test_case_status: string | null }[] = data.requirements || [];
        setTcStatusMap((prev) => {
          const next = { ...prev };
          for (const req of reqs) next[req.id] = req.test_case_status ?? null;
          return next;
        });
      } catch { /* giữ giá trị seed từ prop nếu lỗi mạng */ }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  // Test case đã tồn tại (nếu có) của MỌI requirement trong document — 1 request bulk duy
  // nhất (giống cách documents list gộp requirements của cả project), rồi group theo
  // requirement_id ở client. KHÔNG gọi /requirements/{id}/test-cases riêng cho từng
  // requirement (N+1) như trước — số request không còn tỉ lệ với số requirement nữa.
  const tcFilters = useMemo(
    () => ({ document_id: requirements?.document_id, project_id: requirements?.project_id ?? undefined }),
    [requirements?.document_id, requirements?.project_id]
  );
  // refetchOnMount: "always" — mỗi lần mở lại panel này PHẢI check lại 1 lần (bulk, KHÔNG
  // phải N+1) vì test case có thể vừa sinh xong ở nền trong lúc panel đang đóng: đóng panel
  // unmount component → interval poll bên dưới cũng bị huỷ theo, nên nếu chỉ dựa staleTime
  // (5 phút) sẽ có khoảng trống hiển thị nhầm "chưa có test case" dù server đã có rồi.
  const { data: tcListData, isPending: tcListPending } = useTestCases(tcFilters, !!requirements, { refetchOnMount: "always" });

  const testCasesMap = useMemo(() => {
    const map: Record<string, GenerateTestCasesResponse | null> = {};
    if (!requirements) return map;
    const byReq: Record<string, TestCaseItem[]> = {};
    for (const tc of tcListData?.test_cases ?? []) {
      (byReq[tc.requirement_id] ??= []).push(tc);
    }
    for (const req of requirements.requirements) {
      const list = byReq[req.id];
      map[req.id] = list && list.length > 0
        ? { requirement_id: req.id, document_id: requirements.document_id, total_test_cases: list.length, test_cases: list }
        : null;
    }
    return map;
  }, [requirements, tcListData]);
  // Requirement nào đã kiểm tra xong "có test case chưa" — tránh flash HITL Q&A / nút
  // Generate trong lúc bulk query vẫn đang isPending (đang chờ fetch/refetch).
  const checkedTestCaseIds = useMemo(() => {
    if (!requirements || tcListPending) return new Set<string>();
    return new Set(requirements.requirements.map((r) => r.id));
  }, [requirements, tcListPending]);

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

  // Fire-and-forget: gửi yêu cầu sinh test case (202) rồi trả về ngay — backend chạy nền.
  // Trạng thái "generating" hiện lên, polling effect bên dưới sẽ tự cập nhật khi xong.
  const generateTestCases = async (requirementId: string) => {
    setSubmittingTcId(requirementId); setMessage("");
    try {
      const r = await apiFetch(`${API_V1_REQUIREMENTS_URL}/${requirementId}/test-cases/generate`, {
        method: "POST",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.detail || "Không gửi được yêu cầu sinh test case.");
      }
      setTcStatusMap((prev) => ({ ...prev, [requirementId]: "generating" }));
      // Đăng ký theo dõi toàn cục để có toast khi xong, kể cả khi người dùng đóng panel này.
      if (requirements) {
        const req = requirements.requirements.find((r) => r.id === requirementId);
        const label = req?.title || req?.feature_name || req?.module_name || "Requirement";
        trackTestCaseJob({ documentId: requirements.document_id, requirementId, projectId: requirements.project_id, label });
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Cannot connect to backend."); }
    finally { setSubmittingTcId(null); }
  };

  // Poll trạng thái test case khi có requirement đang generating — lấy test_case_status mới,
  // để badge "Đang tạo" tự chuyển sang bảng preview mà không phải refresh.
  const anyTcGenerating = Object.values(tcStatusMap).some((s) => s === "generating");
  const docIdForPoll = requirements?.document_id;
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  // So sánh với trạng thái NGAY TRƯỚC đó để chỉ refetch khi có req vừa chuyển hết generating
  // (không phải mọi req không-generating mỗi tick — đó chính là N+1: lặp fetch test-cases
  // riêng từng requirement mỗi 3s cho MỌI req đã xong từ trước).
  const tcStatusMapRef = useRef(tcStatusMap);
  tcStatusMapRef.current = tcStatusMap;
  useEffect(() => {
    if (!anyTcGenerating || !docIdForPoll) return;
    let cancelled = false;
    const tick = async () => {
      try {
        // Endpoint POLL nhẹ: chỉ trả (id, test_case_status, test_case_error) thay vì toàn bộ
        // nội dung mọi requirement mỗi 3s.
        const r = await apiFetch(`${API_V1_DOCUMENTS_URL}/${docIdForPoll}/requirements/status`);
        if (!r.ok || cancelled) return;
        const data = await r.json();
        const reqs: { id: string; test_case_status: string | null }[] = data.requirements || [];
        let firstFinishedId: string | null = null;
        for (const req of reqs) {
          const newStatus = req.test_case_status ?? null;
          const wasGenerating = tcStatusMapRef.current[req.id] === "generating";
          setTcStatusMap((prev) => (prev[req.id] === newStatus ? prev : { ...prev, [req.id]: newStatus }));
          if (wasGenerating && newStatus !== "generating" && !firstFinishedId) firstFinishedId = req.id;
        }
        if (firstFinishedId) {
          // Vừa có requirement xong sinh test case: refetch 1 LẦN DUY NHẤT danh sách test case
          // bulk của cả document (không fetch riêng từng requirement) + cập nhật credit.
          await queryClient.invalidateQueries({ queryKey: testCaseKeys.list(tcFilters) });
          setExpandedTestCasesId((cur) => cur ?? firstFinishedId);
          refreshUserRef.current();
        }
      } catch { /* bỏ qua lỗi mạng, lần poll sau thử lại */ }
    };
    const t = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [anyTcGenerating, docIdForPoll, queryClient, tcFilters]);

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
            const isChecked = checkedTestCaseIds.has(req.id);
            const hasTestCases = Boolean(testCasesMap[req.id] && testCasesMap[req.id]!.total_test_cases > 0);
            const isExpanded = expandedReqIds.has(req.id);
            const reqLabel = req.title || req.feature_name || req.module_name || `Requirement ${idx + 1}`;
            const needsAnswers = isChecked && !hasTestCases && req.clarifying_questions && req.clarifying_questions.length > 0;
            const tcStatus = tcStatusMap[req.id];
            const isTcGenerating = tcStatus === "generating";
            const isTcFailed = tcStatus === "failed";
            const isTcSubmitting = submittingTcId === req.id;
            return (
              <article className="req-card animate-in" key={req.id} data-status={req.status}>
                <div
                  className={`req-card-header${isExpanded ? " is-expanded" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleReqExpanded(req.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                    <span className={`req-card-chevron${isExpanded ? " is-open" : ""}`}><ChevronDown /></span>
                    <span className="req-card-title">REQ-{String(idx + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {reqLabel}
                    </span>
                  </div>
                  <div className="req-card-actions" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={req.status} />
                    {!isChecked ? (
                      <span className="badge badge-uploaded"><SpinnerIcon /> Đang kiểm tra...</span>
                    ) : isTcGenerating ? (
                      <span className="badge badge-processing" title="AI đang sinh test case ở nền — bạn có thể đóng và làm việc khác, kết quả sẽ tự hiện.">
                        <SpinnerIcon /> Đang tạo test case...
                      </span>
                    ) : hasTestCases ? (
                      // Đã có test case → chỉ hướng sang Tester Studio (kèm nút xem trước nhanh),
                      // KHÔNG hiện lại nút tạo test case.
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            expandReq(req.id);
                            setExpandedTestCasesId((prev) => prev === req.id ? null : req.id);
                          }}
                        >
                          {expandedTestCasesId === req.id
                            ? <><ChevronUp /> Ẩn xem trước</>
                            : <><ChevronDown /> Xem trước ({testCasesMap[req.id]!.total_test_cases})</>}
                        </button>
                        <button
                          type="button"
                          className="btn btn-purple"
                          onClick={() => handleGoToTesterStudio(req.id)}
                          title="Chuyển tới Tester Studio với các test case đã tạo"
                        >
                          <FlaskIcon /> Test trong Tester Studio
                        </button>
                      </>
                    ) : (
                      // Chưa có test case → nút tạo test case (luôn hiện, kể cả khi còn câu hỏi
                      // làm rõ — trả lời ở dưới là tuỳ chọn để tăng chất lượng).
                      <>
                        {needsAnswers && (
                          req.user_answers?.length
                            ? <span className="badge badge-completed">Đã trả lời</span>
                            : <span className="badge badge-processing">Chờ trả lời (tuỳ chọn)</span>
                        )}
                        {isTcFailed && (
                          <span className="badge badge-error" title={req.test_case_error || "Sinh test case thất bại"}>
                            <AlertIcon /> Tạo thất bại
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isTcSubmitting}
                          onClick={() => generateTestCases(req.id)}
                          title="Sinh test case cho requirement này"
                        >
                          {isTcSubmitting
                            ? <><SpinnerIcon /> Gửi...</>
                            : isTcFailed
                              ? <><ZapIcon /> Thử lại</>
                              : <><ZapIcon /> Tạo Test Case</>}
                        </button>
                      </>
                    )}
                  </div>
                </div>

              {isExpanded && (
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
                {needsAnswers && !isTcGenerating && (
                  <div className="hitl-qa-panel">
                    <div className="hitl-qa-header">
                      <span className="hitl-qa-icon">⚠️</span>
                      <span className="hitl-qa-title">AI cần làm rõ {req.clarifying_questions!.length} điểm trước khi tạo Test Case</span>
                      {req.user_answers?.length
                        ? <span className="badge badge-completed" style={{ marginLeft: "auto" }}>Đã trả lời</span>
                        : <span className="badge badge-processing" style={{ marginLeft: "auto" }}>Chờ trả lời</span>}
                    </div>
                    <div className="hitl-qa-body">
                      {req.clarifying_questions!.map((q, qIdx) => (
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

                {/* Test Cases Preview — chỉ demo vài case đầu, xem đầy đủ ở Tester Studio
                    (nơi có layout bảng rộng phù hợp hơn cho danh sách nhiều test case). */}
                {expandedTestCasesId === req.id && testCasesMap[req.id] && (() => {
                  const allTestCases = testCasesMap[req.id]!.test_cases;
                  const total = testCasesMap[req.id]!.total_test_cases;
                  const preview = allTestCases.slice(0, 4);
                  return (
                    <div className="tc-panel">
                      <div className="tc-panel-header">
                        <span className="tc-panel-title">Xem trước Test Cases</span>
                        <span className="tc-count-badge">{preview.length}/{total}</span>
                      </div>
                      <div className="tc-preview-list">
                        {preview.map((tc, tcIdx) => (
                          <div className="tc-preview-item" key={tc.id}>
                            <span className="tc-preview-id">TC-{String(tcIdx + 1).padStart(2, "0")}</span>
                            <div className="tc-preview-body">
                              <div className="tc-preview-title">{tc.title}</div>
                              {tc.expected_result && (
                                <div className="tc-preview-expected">{tc.expected_result}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-purple tc-preview-cta"
                        onClick={() => handleGoToTesterStudio(req.id)}
                      >
                        <FlaskIcon /> Xem đầy đủ {total} test case trong Tester Studio
                      </button>
                    </div>
                  );
                })()}
              </div>
              )}
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
