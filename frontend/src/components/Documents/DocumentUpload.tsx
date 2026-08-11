import "../../styles.css";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import type { DocumentItem } from "../../App";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_URL = `${API_BASE}/api/documents/upload`;

type DocumentUploadProps = {
  projectId: string | null;
  onUploadSuccess: (documents: DocumentItem[]) => void;
};

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentUpload({ projectId, onUploadSuccess }: DocumentUploadProps) {
  const { refreshUser } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files ?? []));
    setMessage("");
    setIsError(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setMessage("");
      setIsError(false);
    }
  };

  const removeSelectedFile = (fileIndex: number) => {
    setSelectedFiles((currentFiles) => currentFiles.filter((_, index) => index !== fileIndex));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setIsError(true);
      setMessage("Please select at least one file before uploading.");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    // Append project_id as query param if a project is selected
    const url = projectId ? `${API_URL}?project_id=${projectId}` : API_URL;

    setIsUploading(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await apiFetch(url, { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.detail || "Upload failed.");

      const uploadedDocuments = Array.isArray(data) ? data : [];
      const count = uploadedDocuments.length;
      setMessage(`Uploaded ${count} file${count === 1 ? "" : "s"} successfully.`);
      setSelectedFiles([]);
      formRef.current?.reset();
      onUploadSuccess(uploadedDocuments);
      refreshUser?.();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Cannot connect to backend.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="panel animate-in">
      <div className="panel-header">
        <span className="panel-title">Upload Documents</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!projectId && (
            <span style={{ fontSize: "11px", color: "var(--warning)", display: "flex", alignItems: "center", gap: "4px" }}>
              ⚠ Select a project first
            </span>
          )}
          {selectedFiles.length > 0 && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
            </span>
          )}
        </div>
      </div>
      <div className="panel-body">
        <form ref={formRef} onSubmit={handleSubmit}>
          {/* Drop Zone */}
          <div
            className={`upload-zone${isDragging ? " dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="upload-zone-icon">
              <UploadIcon />
            </div>
            <div>
              <div className="upload-zone-label">Drop files here or click to browse</div>
              <div className="upload-zone-hint" style={{ marginTop: "4px" }}>
                .pdf .docx .txt .md .xlsx .csv .dbml .zip
              </div>
            </div>
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.md,.xlsx,.csv,.dbml,.zip"
              multiple
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="selected-files-list" style={{ marginTop: "12px" }}>
              <div className="selected-files-list-title">Selected files</div>
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 12px",
                    borderBottom: index < selectedFiles.length - 1 ? "1px solid var(--border-soft)" : "none",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}><FileIcon /></span>
                  <span style={{ flex: 1, fontSize: "12px", color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </span>
                  <span className="badge badge-filetype">{file.name.split(".").pop()?.toUpperCase()}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                    {formatFileSize(file.size)}
                  </span>
                  <button type="button" className="btn btn-secondary" style={{ padding: "3px 7px" }} onClick={() => removeSelectedFile(index)}>
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="submit" className="btn btn-primary" disabled={isUploading || selectedFiles.length === 0}>
              {isUploading ? (
                <><SpinnerIcon /> Uploading...</>
              ) : selectedFiles.length > 0 ? (
                <><UploadIcon /> Upload {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"}</>
              ) : (
                <><UploadIcon /> Upload</>
              )}
            </button>
            {selectedFiles.length > 0 && (
              <button type="button" className="btn btn-secondary" onClick={() => { setSelectedFiles([]); formRef.current?.reset(); }}>
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Message */}
        {message && (
          <div className={`msg ${isError ? "msg-error" : "msg-success"}`} style={{ marginTop: "12px" }}>
            {isError ? <AlertIcon /> : <CheckIcon />}
            {message}
          </div>
        )}
      </div>
    </section>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

export default DocumentUpload;
