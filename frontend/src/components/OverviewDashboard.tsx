import { useMemo, useState } from "react";
import { useProjects } from "../hooks/useProjects";
import { useUsageSummary, getCurrentPlanQuota } from "../hooks/useUsage";
import { useAuth } from "../contexts/AuthContext";
import {
  FolderGit2,
  FileText,
  CheckSquare,
  Zap,
  Clock,
  ArrowRight,
  Sparkles,
  Plus,
  ChevronRight,
  FolderOpen,
  Layers,
  Search,
  X,
  Grid,
  ListChecks,
} from "lucide-react";

type OverviewDashboardProps = {
  onNavigateToProjects: () => void;
  onSelectProject: (projectId: string) => void;
  onNavigateToTestCases: (projectId?: string) => void;
};

// Helper: Calculate relative time display (vi-VN)
function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Vừa xong";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  if (diffInSeconds < 172800) return "Hôm qua";
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;

  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function OverviewDashboard({
  onNavigateToProjects,
  onSelectProject,
  onNavigateToTestCases,
}: OverviewDashboardProps) {
  const { user } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: usageSummary, isLoading: usageLoading } = useUsageSummary();
  const currentPlanQuota = getCurrentPlanQuota(usageSummary);
  const creditBalance = usageSummary?.credit_balance ?? user?.credit_balance ?? 0;
  const creditPct = currentPlanQuota
    ? Math.max(0, Math.min(100, (creditBalance / currentPlanQuota) * 100))
    : null;
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = user?.role === "admin";

  // Compute aggregated stats
  const totalProjects = projects.length;
  const totalRequirements = useMemo(
    () => projects.reduce((acc, p) => acc + (p.req_count || 0), 0),
    [projects]
  );
  const totalTestCases = useMemo(
    () => projects.reduce((acc, p) => acc + (p.test_case_count || 0), 0),
    [projects]
  );

  // Projects sorted by creation time: Newest -> Oldest
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [projects]);

  // Filtered projects by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return sortedProjects;
    return sortedProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [sortedProjects, searchQuery]);

  // Get Last Used Project from localStorage or default to newest project
  const lastUsedProject = useMemo(() => {
    const lastId = localStorage.getItem("tcga_last_project_id");
    if (lastId) {
      const found = projects.find((p) => p.id === lastId);
      if (found) return found;
    }
    return sortedProjects.length > 0 ? sortedProjects[0] : null;
  }, [projects, sortedProjects]);

  // Get Last Used Tester Studio Project from localStorage
  const lastUsedTesterStudioProject = useMemo(() => {
    const lastTesterProjectId = localStorage.getItem("tcga_last_tester_project_id");
    if (lastTesterProjectId) {
      const found = projects.find((p) => p.id === lastTesterProjectId);
      if (found) return found;
    }
    return lastUsedProject;
  }, [projects, lastUsedProject]);

  if (projectsLoading) {
    return (
      <div className="tcs-view" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", color: "var(--text-muted)" }}>
          <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải Overview...</span>
        </div>
      </div>
    );
  }

  const lastProjectRelativeTime = formatRelativeTime(lastUsedProject?.updated_at || lastUsedProject?.created_at);

  return (
    <div className="tcs-view" style={{ height: "100%", overflowY: "auto" }}>
      {/* Header Banner */}
      <div
        className="tcs-view-header"
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="tcs-view-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div className="tcs-title" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Unified Line Icon matching Menu Sidebar */}
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "8px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
                Tổng quan Hệ thống
                <span className="badge" style={{ fontSize: "11px", letterSpacing: "0.5px", padding: "3px 8px", background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-soft)" }}>
                  TCGA Workspace
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button data-tour="overview-new-project" className="btn btn-primary" onClick={onNavigateToProjects} style={{ height: "38px", padding: "0 16px" }}>
              <Plus size={16} strokeWidth={2} /> Tạo Project mới
            </button>
          </div>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Section 1: Quick Resume (Tiếp tục công việc) */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Clock size={16} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
              Tiếp tục công việc
            </h3>
          </div>

          <div data-tour="overview-resume" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
            {/* Card 1: Last Used Project */}
            <div
              className="card"
              style={{
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "16px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span className="badge" style={{ fontSize: "11px", fontWeight: 600, background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-soft)" }}>
                    Dự án gần đây
                  </span>
                  {lastProjectRelativeTime ? (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} strokeWidth={1.75} /> {lastProjectRelativeTime}
                    </span>
                  ) : null}
                </div>

                {lastUsedProject ? (
                  <>
                    <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0", color: "var(--text-primary)" }}>
                      {lastUsedProject.name}
                    </h4>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {lastUsedProject.description || "Không có mô tả dự án"}
                    </p>

                    <div style={{ display: "flex", gap: "16px", marginTop: "14px", fontSize: "12px", color: "var(--text-secondary)", alignItems: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <FileText size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
                        <strong>{lastUsedProject.file_count || 0}</strong> tài liệu
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <ListChecks size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
                        <strong>{lastUsedProject.req_count || 0}</strong> yêu cầu
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <CheckSquare size={14} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
                        <strong>{lastUsedProject.test_case_count || 0}</strong> test case
                      </span>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "8px 0" }}>Chưa có project nào trong tài khoản.</p>
                )}
              </div>

              <div>
                {lastUsedProject ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center", height: "36px", fontSize: "13px" }}
                    onClick={() => onSelectProject(lastUsedProject.id)}
                  >
                    <FolderOpen size={14} strokeWidth={1.75} /> Mở Project Này <ArrowRight size={14} strokeWidth={1.75} />
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onNavigateToProjects}>
                    <Plus size={14} strokeWidth={2} /> Tạo Project Đầu Tiên
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Last Used Tester Studio */}
            <div
              className="card"
              style={{
                padding: "20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "16px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span className="badge" style={{ fontSize: "11px", fontWeight: 600, background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-soft)" }}>
                    Tester Studio
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Sparkles size={12} strokeWidth={1.75} style={{ color: "var(--accent)" }} /> AI Generator
                  </span>
                </div>

                <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "4px 0", color: "var(--text-primary)" }}>
                  {lastUsedTesterStudioProject ? lastUsedTesterStudioProject.name : "Tester Studio Workspace"}
                </h4>

                <div style={{ display: "flex", gap: "16px", marginTop: "14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <span>Kịch bản kiểm thử: <strong>{totalTestCases}</strong> cases</span>
                </div>
              </div>

              <div>
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%", justifyContent: "center", height: "36px", fontSize: "13px" }}
                  onClick={() => onNavigateToTestCases(lastUsedTesterStudioProject?.id)}
                >
                  <CheckSquare size={14} strokeWidth={1.75} style={{ color: "var(--accent)" }} /> Mở Tester Studio <ChevronRight size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Aggregated Metrics Cards (Unified Line Icons Matching Menu Sidebar) */}
        <div data-tour="overview-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
          {/* Total Projects */}
          <div className="card" style={{ padding: "18px 20px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-surface)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Grid size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Projects</div>
              <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "2px", color: "var(--text-primary)" }}>{totalProjects}</div>
            </div>
          </div>

          {/* Total Requirements */}
          <div className="card" style={{ padding: "18px 20px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-surface)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Requirements</div>
              <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "2px", color: "var(--text-primary)" }}>{totalRequirements}</div>
            </div>
          </div>

          {/* Total Test Cases */}
          <div className="card" style={{ padding: "18px 20px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-surface)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckSquare size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Test Cases</div>
              <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "2px", color: "var(--text-primary)" }}>{totalTestCases}</div>
            </div>
          </div>

          {/* Credit Balance */}
          <div className="card" style={{ padding: "18px 20px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-surface)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={20} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Credit Balance</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "2px", color: "var(--accent)" }}>
                  {creditBalance.toLocaleString()}
                </div>
                {creditPct !== null && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>/ {currentPlanQuota!.toLocaleString()}</div>
                )}
              </div>
              {creditPct !== null ? (
                <div style={{ height: "5px", borderRadius: "999px", background: "var(--border)", overflow: "hidden", marginTop: "8px" }} title={`${usageSummary?.current_plan} · ${Math.round(creditPct)}%`}>
                  <div style={{ height: "100%", width: `${creditPct}%`, background: "var(--accent)", borderRadius: "999px", transition: "width 0.6s ease" }} />
                </div>
              ) : usageLoading ? (
                <div style={{ height: "5px", borderRadius: "999px", background: "var(--border)", overflow: "hidden", marginTop: "8px" }}>
                  <div className="sidebar-credit-bar-skeleton" style={{ height: "100%", width: "40%", borderRadius: "999px" }} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Section 3: Projects List */}
        <div className="card" style={{ padding: "24px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                <FolderGit2 size={18} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
                Danh sách Projects
              </h3>
            </div>

            {/* Search Box */}
            <div style={{ position: "relative", width: "240px" }}>
              <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", display: "flex", pointerEvents: "none" }}>
                <Search size={14} strokeWidth={1.75} />
              </div>
              <input
                type="text"
                className="input"
                placeholder="Lọc dự án..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "34px",
                  padding: "6px 28px 6px 32px",
                  borderRadius: "6px",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>

          </div>

          {filteredProjects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              <div style={{ display: "inline-flex", padding: "12px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", marginBottom: "12px", color: "var(--text-muted)" }}>
                <FolderOpen size={28} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Không tìm thấy dự án nào</div>
              <button className="btn btn-primary" style={{ marginTop: "12px" }} onClick={onNavigateToProjects}>
                <Plus size={14} strokeWidth={2} /> Tạo Project
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
              {filteredProjects.map((p, idx) => {
                const isNewest = idx === 0;
                const projectTime = formatRelativeTime(p.created_at);

                return (
                  <div
                    key={p.id}
                    className="card table-row-hover"
                    style={{
                      padding: "20px",
                      borderRadius: "8px",
                      border: isNewest ? "1px solid var(--accent)" : "1px solid var(--border-soft)",
                      background: "var(--bg-elevated)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "16px",
                      position: "relative",
                      transition: "all var(--transition)",
                    }}
                  >
                    {isNewest && (
                      <div
                        style={{
                          position: "absolute",
                          top: "-10px",
                          right: "16px",
                          background: "var(--accent)",
                          color: "#fff",
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        NEWEST PROJECT
                      </div>
                    )}

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                        <h4 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                          {p.name}
                        </h4>
                      </div>

                      {projectTime ? (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                          <Clock size={12} strokeWidth={1.75} />
                          <span>Tạo: {projectTime}</span>
                        </div>
                      ) : null}

                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineClamp: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.description || "Không có mô tả chi tiết."}
                      </p>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-soft)", borderRadius: "6px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px", alignItems: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <FileText size={13} strokeWidth={1.75} /> Docs: <strong>{p.file_count || 0}</strong>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <ListChecks size={13} strokeWidth={1.75} /> Req: <strong>{p.req_count || 0}</strong>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <CheckSquare size={13} strokeWidth={1.75} /> Tests: <strong>{p.test_case_count || 0}</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, justifyContent: "center", height: "32px", fontSize: "12px" }}
                          onClick={() => onSelectProject(p.id)}
                        >
                          Mở Project
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                          onClick={() => onNavigateToTestCases(p.id)}
                          title="Mở Tester Studio với Project này"
                        >
                          <CheckSquare size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
