import { useState } from "react";
import { FolderGit2 } from "lucide-react";
import { Project } from "./ProjectManager";
import DocumentUpload from "../Documents/DocumentUpload";
import DocumentList from "../Documents/DocumentList";
import RequirementViewer, { GenerateRequirementsResponse } from "../RequirementViewer";
import SideDrawer from "../SideDrawer";
import ChatWorkspace from "../ChatWorkspace";
import DocumentContextSidebar from "../Documents/DocumentContextSidebar";
import { DocumentItem } from "../../App";
import Breadcrumb from "../Breadcrumb";
import { useChatHistory, useSyncChatHistoryCache, useClearChatHistory } from "../../hooks/useChatHistory";

type ProjectDetailDashboardProps = {
  project: Project;
};

export default function ProjectDetailDashboard({ project }: ProjectDetailDashboardProps) {
  const [newUploadedDocuments, setNewUploadedDocuments] = useState<DocumentItem[]>([]);
  // Lịch sử chat lưu ở DB (thay cho localStorage trước đây) — đồng bộ được giữa các
  // thiết bị/trình duyệt, không mất khi đăng xuất hoặc xóa cache.
  const { data: chatMessages, isLoading: isChatHistoryLoading } = useChatHistory(project.id);
  const syncChatCache = useSyncChatHistoryCache(project.id);
  const clearChatHistory = useClearChatHistory(project.id);

  // State for toggling views
  const [activeTab, setActiveTab] = useState<"dashboard" | "agent">("dashboard");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const [activeRequirementData, setActiveRequirementData] = useState<{
    reqs: GenerateRequirementsResponse;
    doc: DocumentItem | null;
  } | null>(null);

  const handleViewRequirements = (reqs: GenerateRequirementsResponse, doc: DocumentItem) => {
    setActiveRequirementData({ reqs, doc });
  };

  const handleCloseRequirements = () => {
    setActiveRequirementData(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
      {activeTab === "dashboard" ? (
        <>
          {/* Project Header */}
          <div className="tcs-view-header">
            <div className="tcs-view-title-row">
              <div className="tcs-title">
                <div className="tcs-title-icon">
                  <FolderGit2 size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ fontSize: "20px", fontWeight: 700 }}>{project.name}</div>
                    <span className="badge badge-completed">Active</span>
                  </div>
                  {project.description && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                      {project.description}
                    </div>
                  )}
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ padding: "8px 16px", borderRadius: "20px", display: "flex", gap: "8px", alignItems: "center" }}
                onClick={() => setActiveTab("agent")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Work with Agent
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "32px", backgroundColor: "var(--bg)" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
              <DocumentUpload
                projectId={project.id}
                onUploadSuccess={setNewUploadedDocuments}
              />
              <DocumentList
                projectId={project.id}
                newUploadedDocuments={newUploadedDocuments}
                onViewRequirements={handleViewRequirements}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Breadcrumb thay cho nút "Quay lại" — cho biết rõ vị trí hiện tại trong cây
              phân cấp (Dự án > tên dự án > Work with Agent) và cho phép nhảy thẳng về
              cấp trên, không chỉ lùi một bước như nút Back trước đây. */}
          <div style={{ padding: "10px 20px", display: "flex", alignItems: "center" }}>
            <Breadcrumb
              items={[
                { label: project.name, onClick: () => setActiveTab("dashboard") },
                { label: "Work with Agent" },
              ]}
            />
          </div>

          <div className="workspace-content-grid" style={{ flex: 1, minHeight: 0 }}>
            {isChatHistoryLoading || !chatMessages ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontSize: "13px" }}>
                Đang tải lịch sử chat...
              </div>
            ) : (
              <ChatWorkspace
                key={project.id}
                projectId={project.id}
                selectedDocumentIds={selectedDocumentIds}
                initialMessages={chatMessages}
                onMessagesChange={syncChatCache}
                onClearHistory={() => clearChatHistory.mutate()}
              />
            )}
            <div className="workspace-right-sidebar">
              {/* Bỏ Upload Documents khỏi màn Work with Agent — upload tài liệu đã có sẵn
                  ở tab Dashboard của dự án, ở đây chỉ cần chọn tài liệu để chat/sinh nội
                  dung nên chỉ giữ lại Nguồn tài liệu. */}
              <DocumentContextSidebar
                projectId={project.id}
                newUploadedDocuments={newUploadedDocuments}
                selectedDocumentIds={selectedDocumentIds}
                onSelectionChange={setSelectedDocumentIds}
              />
            </div>
          </div>
        </>
      )}

      {/* Side Drawer for Requirement Details */}
      <SideDrawer
        isOpen={!!activeRequirementData}
        onClose={handleCloseRequirements}
        title="Requirements & Test Cases"
        width="65vw"
      >
        {activeRequirementData && (
          <RequirementViewer
            requirements={activeRequirementData.reqs}
            document={activeRequirementData.doc}
            onClose={handleCloseRequirements}
            onRequirementsUpdate={(updatedReqs) => setActiveRequirementData(prev => prev ? { ...prev, reqs: updatedReqs } : null)}
          />
        )}
      </SideDrawer>
      
    </div>
  );
}
