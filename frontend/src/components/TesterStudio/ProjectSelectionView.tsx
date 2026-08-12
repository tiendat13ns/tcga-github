import { Sparkles, FlaskConical } from "lucide-react";
import { Project } from "../Projects/ProjectManager";
import { ChevronRightIcon, CheckSquareIcon, FolderIcon, PlusIcon, timeAgo } from "./shared";

type ProjectSelectionViewProps = {
  projects: Project[];
  isLoadingProjects: boolean;
  onSelectProject: (project: Project) => void;
  onGoToProjects: () => void;
};

export default function ProjectSelectionView({ projects, isLoadingProjects, onSelectProject, onGoToProjects }: ProjectSelectionViewProps) {
  return (
    <div className="tcs-view">
      <div className="tcs-view-header">
        <div className="tcs-view-title-row">
          <div className="tcs-title">
            <div className="tcs-title-icon"><FlaskConical size={20} strokeWidth={1.75} /></div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>Tester Studio</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                Select a project to start testing
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tcs-view-body">
        {isLoadingProjects ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "64px 20px", color: "var(--text-muted)" }}>
            <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải danh sách Projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="tcs-empty">
            <div className="tcs-empty-icon"><FolderIcon /></div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)" }}>No projects yet</div>
            <div style={{ fontSize: "13px", maxWidth: "320px", textAlign: "center", lineHeight: 1.6 }}>
              Create a project from the Projects page first, then come back here to browse its test cases.
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              onClick={onGoToProjects}
            >
              <PlusIcon /> Go to Projects
            </button>
          </div>
        ) : (
          <div className="tcs-project-grid">
            {projects.map((p) => (
              <div
                key={p.id}
                className="tcs-project-card"
                onClick={() => onSelectProject(p)}
              >
                <div className="tcs-project-card-icon">
                  <FolderIcon />
                </div>
                <div className="tcs-project-card-body">
                  <div className="tcs-project-card-name">{p.name}</div>
                  {p.description && (
                    <div className="tcs-project-card-desc">{p.description}</div>
                  )}
                  <div className="tcs-project-card-meta">
                    <span><CheckSquareIcon /> {p.test_case_count || 0} tests</span>
                    <span>{timeAgo(p.created_at)}</span>
                  </div>
                </div>
                <div className="tcs-project-card-arrow"><ChevronRightIcon /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
