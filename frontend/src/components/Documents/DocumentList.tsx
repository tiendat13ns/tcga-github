import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { DocumentItem } from "../../App";
import type { GenerateRequirementsResponse } from "../RequirementViewer";
import { useProjectDocuments, useDeleteDocument, useClearDocuments, useAddDocumentsToCache } from "../../hooks/useDocuments";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import ConfirmDialog from "../ConfirmDialog";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_V1_DOCUMENTS_URL = `${API_BASE}/api/v1/documents`;
const API_V1_REQUIREMENTS_URL = `${API_BASE}/api/v1/requirements`;

type DocumentListProps = {
  projectId: string | null;
  newUploadedDocuments: DocumentItem[];
  onViewRequirements: (data: GenerateRequirementsResponse, doc: DocumentItem) => void;
};

type Filters = { filename: string; status: string; timeOrder: string };
const defaultFilters: Filters = { filename: "", status: "", timeOrder: "newest" };

/* ── Icons ── */
const FilterIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
const TrashIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
const EyeIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const ZapIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const RefreshIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>;
const XIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const FileTextIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const AlertIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const SpinnerIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>;

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed" ? "badge-completed" : status === "processing" ? "badge-processing" : status === "error" ? "badge-error" : "badge-uploaded";
  return <span className={`badge ${cls}`}><span className="badge-dot" />{status}</span>;
}

export default function DocumentList({ projectId, newUploadedDocuments, onViewRequirements }: DocumentListProps) {
  const { data: documents = [], isLoading, error: fetchError } = useProjectDocuments(projectId);
  const deleteDocMutation = useDeleteDocument(projectId);
  const clearDocsMutation = useClearDocuments(projectId);
  const addToCache = useAddDocumentsToCache(projectId);
  const { refreshUser } = useAuth();  // để cập nhật số credit ở sidebar sau khi generate (bị trừ credit)

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [generatingRequirementsId, setGeneratingRequirementsId] = useState<string | null>(null);
  const [generatingTestCasesId, setGeneratingTestCasesId] = useState<string | null>(null);
  const [tcProgress, setTcProgress] = useState<{ done: number; total: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [existingRequirements, setExistingRequirements] = useState<Record<string, GenerateRequirementsResponse | null>>({});
  const [isLoadingRequirements, setIsLoadingRequirements] = useState<Record<string, boolean>>({});
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load existing requirements for completed docs
  useEffect(() => {
    documents.forEach(async (doc) => {
      if (doc.status === "completed" && existingRequirements[doc.id] === undefined && !isLoadingRequirements[doc.id]) {
        setIsLoadingRequirements((prev) => ({ ...prev, [doc.id]: true }));
        try {
          const r = await apiFetch(`${API_V1_DOCUMENTS_URL}/${doc.id}/requirements`);
          if (r.ok) {
            const d = await r.json();
            setExistingRequirements((prev) => ({ ...prev, [doc.id]: d.total_requirements > 0 ? d : null }));
          } else {
            setExistingRequirements((prev) => ({ ...prev, [doc.id]: null }));
          }
        } catch {
          setExistingRequirements((prev) => ({ ...prev, [doc.id]: null }));
        } finally {
          setIsLoadingRequirements((prev) => ({ ...prev, [doc.id]: false }));
        }
      }
    });
  }, [documents, existingRequirements, isLoadingRequirements]);

  // Add newly uploaded docs to cache
  useEffect(() => {
    if (newUploadedDocuments.length === 0) return;
    addToCache(newUploadedDocuments);
  }, [newUploadedDocuments]);

  const filteredDocuments = useMemo(() => {
    return documents
      .filter((d) => {
        return (
          d.original_filename.toLowerCase().includes(filters.filename.toLowerCase()) &&
          (!filters.status || d.status === filters.status)
        );
      })
      .sort((a, b) => {
        const ta = new Date(a.uploaded_at).getTime();
        const tb = new Date(b.uploaded_at).getTime();
        return filters.timeOrder === "oldest" ? ta - tb : tb - ta;
      });
  }, [documents, filters]);

  const statuses = useMemo(() => Array.from(new Set(documents.map((d) => d.status))).sort(), [documents]);

  const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const confirmClearUploadHistory = () => {
    setMessage("");
    clearDocsMutation.mutate(undefined, {
      onSuccess: () => {
        setFilters(defaultFilters);
        setExistingRequirements({});
      },
      onError: (e) => setMessage(e instanceof Error ? e.message : "Cannot connect to backend."),
    });
  };

  const generateRequirements = async (doc: DocumentItem) => {
    setGeneratingRequirementsId(doc.id); setMessage("");
    try {
      const r = await apiFetch(`${API_V1_DOCUMENTS_URL}/${doc.id}/requirements/generate`, { method: "POST" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.detail || "Could not generate requirements.");
      setExistingRequirements((prev) => ({ ...prev, [doc.id]: d }));
      refreshUser();  // credit vừa bị trừ → cập nhật lại số hiển thị ở sidebar
      onViewRequirements(d, doc);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Cannot connect to backend."); }
    finally { setGeneratingRequirementsId(null); }
  };

  // Sinh test case cho TẤT CẢ requirement của document — gọi tuần tự endpoint sinh test case
  // theo từng requirement (backend chưa có endpoint gộp theo document). Hiện tiến độ n/tổng để
  // người dùng biết đang chạy tới đâu (mỗi requirement là 1 lời gọi LLM, có thể chậm).
  const generateTestCases = async (doc: DocumentItem) => {
    const reqs = existingRequirements[doc.id];
    if (!reqs || reqs.requirements.length === 0) return;
    setGeneratingTestCasesId(doc.id); setMessage(""); setSuccessMessage("");
    setTcProgress({ done: 0, total: reqs.requirements.length });
    try {
      let done = 0;
      for (const req of reqs.requirements) {
        const r = await apiFetch(`${API_V1_REQUIREMENTS_URL}/${req.id}/test-cases/generate`, { method: "POST" });
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.detail || `Không sinh được test case cho requirement "${req.title}".`);
        }
        done += 1;
        setTcProgress({ done, total: reqs.requirements.length });
      }
      setSuccessMessage(`Đã sinh test case cho ${done} requirement. Mở Tester Studio để xem chi tiết.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cannot connect to backend.");
    } finally {
      // credit đã bị trừ theo từng requirement thành công → cập nhật lại sidebar dù có lỗi giữa chừng.
      refreshUser();
      setGeneratingTestCasesId(null);
      setTcProgress(null);
    }
  };

  const confirmDeleteDocument = () => {
    if (!documentToDelete) return;
    deleteDocMutation.mutate(documentToDelete.id, {
      onSuccess: () => {
        setExistingRequirements((prev) => {
          const next = { ...prev };
          delete next[documentToDelete.id];
          return next;
        });
      },
      onError: (e) => setMessage(e instanceof Error ? e.message : "Cannot connect to backend."),
    });
  };

  const displayError = message || (fetchError instanceof Error ? fetchError.message : "");

  return (
    <section className="panel animate-in" style={{ animationDelay: "60ms" }}>
      {/* Header */}
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="panel-title">Uploaded Documents</span>
          {documents.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1px 7px" }}>
              {filteredDocuments.length}
            </span>
          )}
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowFilters((f) => !f)}>
            <FilterIcon /> {showFilters ? "Hide" : "Filter"}
          </button>
          <button type="button" className="btn btn-danger" disabled={clearDocsMutation.isPending || documents.length === 0} onClick={() => setShowClearConfirm(true)}>
            {clearDocsMutation.isPending ? <><SpinnerIcon /> Clearing...</> : <><TrashIcon /> Clear</>}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ padding: "10px 14px", display: "grid", gap: "8px", borderBottom: "1px solid var(--border)" }}>
          <input
            className="filter-control"
            type="text"
            name="filename"
            value={filters.filename}
            onChange={handleFilterChange}
            placeholder="Search filename..."
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <select className="filter-control" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="filter-control" name="timeOrder" value={filters.timeOrder} onChange={handleFilterChange}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <button type="button" className="btn btn-secondary" style={{ width: "fit-content" }} onClick={() => setFilters(defaultFilters)}>Reset</button>
        </div>
      )}

      {/* Error */}
      {displayError && (
        <div className="msg msg-error" style={{ margin: "0 14px 0" }}>
          <AlertIcon />{displayError}
        </div>
      )}

      {/* Success (vd sinh test case xong) */}
      {successMessage && (
        <div className="msg" style={{ margin: "0 14px", display: "flex", alignItems: "center", gap: "6px", background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)" }}>
          {successMessage}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ padding: "14px", display: "grid", gap: "6px" }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: "56px", borderRadius: "6px" }} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && documents.length === 0 && (
        <div className="empty-state" style={{ padding: "24px 14px" }}>
          <div className="empty-state-icon"><FileTextIcon /></div>
          <div className="empty-state-title">No documents yet</div>
          <div className="empty-state-body">Upload a document to get started.</div>
        </div>
      )}

      {/* Document Card List */}
      {!isLoading && filteredDocuments.length > 0 && (
        <div className="doc-card-list">
          {filteredDocuments.map((doc) => {
            const hasReqs = !!existingRequirements[doc.id];
            const isGenerating = generatingRequirementsId === doc.id;
            const isLoadingReqs = !!isLoadingRequirements[doc.id];
            
            const getFileIcon = (filename: string) => {
              const ext = filename.split('.').pop()?.toLowerCase();
              switch (ext) {
                case 'pdf': return <img src="https://img.icons8.com/color/48/pdf.png" alt="PDF" style={{ width: 24, height: 24 }} />;
                case 'doc':
                case 'docx': return <img src="https://img.icons8.com/color/48/word.png" alt="Word" style={{ width: 24, height: 24 }} />;
                case 'xls':
                case 'xlsx': return <img src="https://img.icons8.com/color/48/xls.png" alt="Excel" style={{ width: 24, height: 24 }} />;
                case 'txt': return <img src="https://img.icons8.com/color/48/txt.png" alt="Text" style={{ width: 24, height: 24 }} />;
                default: return <FileTextIcon />;
              }
            };

            return (
              <div key={doc.id} className="doc-card-row">
                <div className="doc-card-icon">
                  {getFileIcon(doc.original_filename)}
                </div>
                <div className="doc-card-info">
                  <div className="doc-card-name" title={doc.original_filename}>
                    {doc.original_filename}
                  </div>
                  <div className="doc-card-meta">
                    <span className="badge badge-filetype" style={{ padding: "1px 5px", fontSize: "10px" }}>
                      {doc.file_type.toUpperCase()}
                    </span>
                    <span className="meta-dot">&middot;</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span className="meta-dot">&middot;</span>
                    <span>{formatDate(doc.uploaded_at)}</span>
                    <span className="meta-dot">&middot;</span>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
                
                <div className="doc-card-actions">
                  {doc.status === "completed" && hasReqs ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onViewRequirements(existingRequirements[doc.id]!, doc)}
                      >
                        <EyeIcon /> View Req
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={generatingTestCasesId === doc.id}
                        onClick={() => generateTestCases(doc)}
                        title="Sinh test case cho tất cả requirement của tài liệu này"
                      >
                        {generatingTestCasesId === doc.id
                          ? <><SpinnerIcon /> TCs {tcProgress ? `${tcProgress.done}/${tcProgress.total}` : "..."}</>
                          : <><ZapIcon /> Generate TCs</>}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isGenerating}
                        onClick={() => generateRequirements(doc)}
                        title="Re-generate requirements"
                      >
                        {isGenerating ? <SpinnerIcon /> : <RefreshIcon />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDocumentToDelete(doc)}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  ) : doc.status === "completed" ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isGenerating || isLoadingReqs}
                        onClick={() => generateRequirements(doc)}
                      >
                        {isGenerating ? <><SpinnerIcon /> Gen...</> : isLoadingReqs ? <><SpinnerIcon /> Ldg...</> : <><ZapIcon /> Generate</>}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDocumentToDelete(doc)}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setDocumentToDelete(doc)}
                    >
                      <TrashIcon /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Upload History"
        message="Are you sure you want to clear all uploaded document history?"
        confirmText={clearDocsMutation.isPending ? "Clearing..." : "Clear"}
        onConfirm={confirmClearUploadHistory}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmDialog
        isOpen={!!documentToDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${documentToDelete?.original_filename}"?`}
        confirmText={deleteDocMutation.isPending ? "Deleting..." : "Delete"}
        onConfirm={confirmDeleteDocument}
        onCancel={() => setDocumentToDelete(null)}
      />
    </section>
  );
}
