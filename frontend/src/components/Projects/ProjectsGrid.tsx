import { useState, FormEvent } from "react";
import { Sparkles, FolderGit2 } from "lucide-react";
import { Project } from "./ProjectManager";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "../../hooks/useProjects";
import ConfirmDialog from "../ConfirmDialog";
import ModalDialog from "../ModalDialog";

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"></path>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}

function CheckSquareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );
}

function timeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}mo ago`;
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  } catch {
    return dateString;
  }
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return d; }
}

type ProjectsGridProps = {
  onSelectProject: (project: Project) => void;
};

export default function ProjectsGrid({ onSelectProject }: ProjectsGridProps) {
  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  // Form sửa project — tách state riêng khỏi form tạo mới để tránh dữ liệu 2 form lẫn
  // vào nhau nếu người dùng mở form này rồi form kia trong cùng phiên.
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");

  const isCreating = createProject.isPending;
  const isUpdating = updateProject.isPending;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required."); return; }
    setError("");
    createProject.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => {
          setName(""); setDescription(""); setShowCreateModal(false);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Error creating project.");
        },
      }
    );
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setEditName(p.name);
    setEditDescription(p.description || "");
    setEditError("");
  };

  const closeEditModal = () => {
    setEditingProject(null);
    setEditName(""); setEditDescription(""); setEditError("");
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!editName.trim()) { setEditError("Project name is required."); return; }
    setEditError("");
    updateProject.mutate(
      { id: editingProject.id, name: editName.trim(), description: editDescription.trim() || null },
      {
        onSuccess: () => closeEditModal(),
        onError: (err) => {
          setEditError(err instanceof Error ? err.message : "Error updating project.");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="tcs-view" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", color: "var(--text-muted)" }}>
          <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải danh sách Projects...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tcs-view">
      <div className="tcs-view-header">
        <div className="tcs-view-title-row">
          <div className="tcs-title">
            <div className="tcs-title-icon">
              <FolderGit2 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>Projects</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                Manage project workspace and isolate RAG knowledge base
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <PlusIcon /> Create Project
          </button>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
            <SpinnerIcon /> Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="workspace-empty" style={{ marginTop: "48px" }}>
            <div className="workspace-empty-icon">📂</div>
            <div className="workspace-empty-title">No projects found</div>
            <div className="workspace-empty-body">
              You don't have any projects yet. Create your first project to start managing requirements and test cases.
            </div>
            <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={() => setShowCreateModal(true)}>
              <PlusIcon /> Create Project
            </button>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px"
          }}>
            {projects.map(p => (
              <div 
                key={p.id} 
                className="project-card"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "18px",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}
                onClick={() => onSelectProject(p)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-elevated)", borderRadius: "8px", color: "var(--accent)", flexShrink: 0 }}>
                    <FolderIcon />
                  </div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</h3>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "2px" }}>
                    <button
                      type="button"
                      className="icon-btn-ghost"
                      title="Edit project"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(p);
                      }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-ghost"
                      style={{ color: "var(--danger)" }}
                      title="Delete project"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(p);
                      }}
                      disabled={deleteProject.isPending}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {p.description || "No description"}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Files">
                      <FileIcon /> {p.file_count || 0} files
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Requirements">
                      <ListIcon /> {p.req_count || 0} reqs
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }} title="Test Cases">
                      <CheckSquareIcon /> {p.test_case_count || 0} tests
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }} title={`Created at ${formatDate(p.created_at)}`}>
                    <ClockIcon /> {timeAgo(p.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalDialog
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setError(""); setName(""); setDescription(""); }}
        title="Create Project"
        width="400px"
      >
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "8px" }}>
          {error && <div className="error-message" style={{ color: "var(--danger)", fontSize: "14px", padding: "8px", backgroundColor: "rgba(220, 38, 38, 0.1)", borderRadius: "6px" }}>{error}</div>}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>Project Name</label>
            <input 
              autoFocus
              type="text" 
              className="filter-control" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Acme E-commerce"
              required
              style={{ fontSize: "14px", padding: "10px 12px" }}
            />
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>Description <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>(Optional)</span></label>
            <textarea 
              className="filter-control" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Briefly describe the project..."
              rows={3}
              style={{ resize: "vertical", fontSize: "14px", padding: "10px 12px", minHeight: "80px" }}
            />
          </div>
          
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
            <button type="button" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }} onClick={() => { setShowCreateModal(false); setError(""); setName(""); setDescription(""); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }} disabled={isCreating}>
              {isCreating ? <><SpinnerIcon /> Creating...</> : "Create Project"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog
        isOpen={!!editingProject}
        onClose={closeEditModal}
        title="Edit Project"
        width="400px"
      >
        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "8px" }}>
          {editError && <div className="error-message" style={{ color: "var(--danger)", fontSize: "14px", padding: "8px", backgroundColor: "rgba(220, 38, 38, 0.1)", borderRadius: "6px" }}>{editError}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>Project Name</label>
            <input
              autoFocus
              type="text"
              className="filter-control"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="e.g. Acme E-commerce"
              required
              style={{ fontSize: "14px", padding: "10px 12px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>Description <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>(Optional)</span></label>
            <textarea
              className="filter-control"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Briefly describe the project..."
              rows={3}
              style={{ resize: "vertical", fontSize: "14px", padding: "10px 12px", minHeight: "80px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
            <button type="button" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "13px" }} onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }} disabled={isUpdating}>
              {isUpdating ? <><SpinnerIcon /> Saving...</> : "Save Changes"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        isOpen={!!projectToDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}"?`}
        confirmText={deleteProject.isPending ? "Deleting..." : "Delete"}
        onConfirm={() => {
          if (projectToDelete) {
            deleteProject.mutate(projectToDelete.id);
          }
        }}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}
