import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LogOut, Zap, ShieldCheck, ChevronRight, Settings, MessageCircleMore } from "lucide-react";
import { TCGAAppIcon } from "./TCGALogo";
import { Project } from "./Projects/ProjectManager";
import { useUsageSummary, getCurrentPlanQuota } from "../hooks/useUsage";
import FeedbackModal from "./FeedbackModal";

function PieChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 118 2.83" /><path d="M22 12A10 10 0 0012 2v10z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function PanelLeftCloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="16 16 12 12 16 8" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  );
}

function HelpCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

type TooltipPos = { top: number; left: number };

// Tooltip nổi khi hover — render qua Portal thẳng vào document.body (xem ghi chú
// .sidebar-nav-tooltip trong styles.css: sidebar có overflow:hidden nên tooltip
// position:absolute bên trong sẽ bị cắt cụt, phải thoát ra ngoài bằng Portal).
function FloatingTooltip({ pos, label }: { pos: TooltipPos; label: string }) {
  return createPortal(
    <span className="sidebar-nav-tooltip" style={{ top: pos.top, left: pos.left, transform: "translateY(-50%)" }}>
      {label}
    </span>,
    document.body
  );
}

// Một mục nav trong Sidebar. Khi thu gọn (isSidebarOpen=false): icon nằm trong khung tròn,
// bo tròn hoàn toàn (999px) thay vì hình chữ nhật bo góc nhẹ như lúc mở rộng, kèm tooltip tối
// nổi bên phải khi hover (FloatingTooltip).
type SidebarNavItemProps = {
  dataTour?: string;
  isActive: boolean;
  isSidebarOpen: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  accent?: boolean;
};

function SidebarNavItem({ dataTour, isActive, isSidebarOpen, onClick, icon, label, accent }: SidebarNavItemProps) {
  const itemRef = useRef<HTMLLIElement>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);

  const showTooltip = () => {
    if (isSidebarOpen) return;
    const rect = itemRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  };

  return (
    <li
      ref={itemRef}
      data-tour={dataTour}
      className={`project-item ${isActive ? "active" : ""}`}
      onClick={onClick}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltipPos(null)}
      style={{
        justifyContent: isSidebarOpen ? "flex-start" : "center",
        padding: isSidebarOpen ? "10px 16px" : "12px",
        margin: 0,
        borderRadius: isSidebarOpen ? undefined : "999px",
      }}
    >
      <div className="project-item-content" style={{ display: "flex", alignItems: "center", gap: "12px", flexDirection: "row", flex: isSidebarOpen ? 1 : "none", color: accent ? "var(--accent)" : undefined }}>
        {icon}
        {isSidebarOpen && <div className="project-item-name" style={accent ? { fontWeight: 600 } : undefined}>{label}</div>}
      </div>
      {tooltipPos && <FloatingTooltip pos={tooltipPos} label={label} />}
    </li>
  );
}

export type GlobalViewType = "overview" | "projects" | "project_detail" | "test_cases" | "usage" | "tutorial" | "admin" | "settings" | "admin_feedback";

type GlobalSidebarProps = {
  activeView: GlobalViewType;
  selectedProject?: Project | null;
  onNavigate: (view: "overview" | "projects" | "test_cases" | "usage" | "tutorial" | "admin" | "settings" | "admin_feedback") => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  user: { email: string; role?: string; credit_balance: number } | null;
  onLogout: () => void;
  onGoToLanding?: () => void;
};

export default function GlobalSidebar({ activeView, selectedProject, onNavigate, isSidebarOpen, onToggleSidebar, user, onLogout, onGoToLanding }: GlobalSidebarProps) {
  const isAdmin = user?.role === "admin";
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  // Admin không còn bypass credit ở backend — dùng chung logic quota/progress-bar với
  // mọi user (current_plan trả về đúng gói thật dựa trên credit_balance).
  const { data: usageSummary, isLoading: usageLoading } = useUsageSummary({ enabled: !!user });
  const currentPlanQuota = getCurrentPlanQuota(usageSummary);
  const creditPct = currentPlanQuota
    ? Math.max(0, Math.min(100, (user!.credit_balance / currentPlanQuota) * 100))
    : null;

  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const [toggleTooltipPos, setToggleTooltipPos] = useState<TooltipPos | null>(null);
  const showToggleTooltip = () => {
    const rect = toggleBtnRef.current?.getBoundingClientRect();
    if (rect) setToggleTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 12 });
  };

  return (
    <aside className="global-sidebar project-sidebar" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="sidebar-header" style={{ justifyContent: isSidebarOpen ? "space-between" : "center", gap: "10px", padding: isSidebarOpen ? "24px 20px" : "24px 0", alignItems: "center" }}>
        {isSidebarOpen ? (
          <>
            <button
              type="button"
              onClick={onGoToLanding}
              title="Test Case Generation Assistant · AI-powered — Về trang chủ"
              style={{ display: "flex", alignItems: "center", gap: "11px", background: "none", border: "none", padding: 0, cursor: onGoToLanding ? "pointer" : "default", minWidth: 0 }}
            >
              <TCGAAppIcon size={40} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, maxWidth: "150px" }}>
                <span className="sidebar-title" style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.1 }}>TCGA</span>
                <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.01em", lineHeight: 1.3, marginTop: "3px", textAlign: "left" }}>
                  Test Case Generation Assistant
                </span>
              </div>
            </button>
            <button type="button" className="icon-btn-ghost" onClick={onToggleSidebar} title="Close sidebar" style={{ flexShrink: 0 }}>
              <PanelLeftCloseIcon />
            </button>
          </>
        ) : (
          <button
            ref={toggleBtnRef}
            type="button"
            className="icon-btn-ghost"
            onClick={onToggleSidebar}
            onMouseEnter={showToggleTooltip}
            onMouseLeave={() => setToggleTooltipPos(null)}
          >
            <MenuIcon />
            {toggleTooltipPos && <FloatingTooltip pos={toggleTooltipPos} label="Open sidebar" />}
          </button>
        )}
      </div>

      {isSidebarOpen && activeView === "project_detail" && selectedProject && (
        <div
          className="sidebar-project-crumb"
          title={selectedProject.name}
          style={{ display: "flex", alignItems: "center", gap: "5px", margin: "10px 16px 4px", padding: "6px 10px", fontSize: "12px", fontWeight: 500, color: "var(--accent)", background: "var(--accent-glow)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", overflow: "hidden" }}
        >
          <FolderIcon />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedProject.name}</span>
        </div>
      )}

      <ul className="project-list" style={{ marginTop: "16px", flex: 1, padding: isSidebarOpen ? "0 12px" : "0 4px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {isAdmin && (
          <SidebarNavItem
            isActive={activeView === "admin"}
            isSidebarOpen={isSidebarOpen}
            onClick={() => onNavigate("admin")}
            icon={<ShieldCheck size={18} />}
            label="Admin Dashboard"
            accent
          />
        )}

        <SidebarNavItem
          dataTour="nav-overview"
          isActive={activeView === "overview"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => onNavigate("overview")}
          icon={<PieChartIcon />}
          label="Overview"
        />
        <SidebarNavItem
          dataTour="nav-projects"
          isActive={activeView === "projects" || activeView === "project_detail"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => onNavigate("projects")}
          icon={<GridIcon />}
          label="Projects"
        />
        <SidebarNavItem
          dataTour="nav-test-cases"
          isActive={activeView === "test_cases"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => onNavigate("test_cases")}
          icon={<ClipboardCheckIcon />}
          label="Tester Studio"
        />
        <SidebarNavItem
          dataTour="nav-usage"
          isActive={activeView === "usage"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => onNavigate("usage")}
          icon={<BookOpenIcon />}
          label="Usage & Billing"
        />
        <SidebarNavItem
          dataTour="nav-tutorial"
          isActive={activeView === "tutorial"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => onNavigate("tutorial")}
          icon={<HelpCircleIcon />}
          label="Tutorial"
        />
        <SidebarNavItem
          dataTour="nav-settings"
          isActive={activeView === "settings"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => onNavigate("settings")}
          icon={<Settings size={18} />}
          label="Settings"
        />
        <SidebarNavItem
          dataTour="nav-feedback"
          isActive={isAdmin && activeView === "admin_feedback"}
          isSidebarOpen={isSidebarOpen}
          onClick={() => (isAdmin ? onNavigate("admin_feedback") : setIsFeedbackOpen(true))}
          icon={<MessageCircleMore size={18} />}
          label="Feedback"
        />
      </ul>

      {user && (
        <>
          <div style={{ height: "1px", background: "var(--border)", margin: "0 12px" }} />
          <div className="sidebar-user-footer" style={{ padding: isSidebarOpen ? "16px" : "16px 0", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}>
            <div className="sidebar-user-avatar" style={{ background: isAdmin ? "var(--accent)" : undefined, color: isAdmin ? "#fff" : undefined }}>
              {user.email.charAt(0).toUpperCase()}
            </div>
            {isSidebarOpen && (
              <>
                <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="sidebar-user-email" title={user.email} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {user.email.split("@")[0]}
                  </div>
                  {creditPct !== null ? (
                    <button
                      type="button"
                      onClick={() => onNavigate("usage")}
                      title={`${user.credit_balance.toLocaleString()} / ${currentPlanQuota!.toLocaleString()} credits (${Math.round(creditPct)}%) — ${usageSummary?.current_plan}`}
                      style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", background: "none", border: "none", padding: 0, width: "100%", cursor: "pointer" }}
                    >
                      <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${creditPct}%`, background: "var(--accent)", borderRadius: "999px", transition: "width 0.6s ease" }} />
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatCompact(user.credit_balance)}/{formatCompact(currentPlanQuota!)}
                      </span>
                      <ChevronRight size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    </button>
                  ) : usageLoading ? (
                    // Skeleton — cùng hình dạng thanh bar thật, tránh nhấp nháy đổi layout
                    // khi usage summary còn đang fetch (~vài trăm ms sau khi đăng nhập).
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                      <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: "var(--border)", overflow: "hidden" }}>
                        <div className="sidebar-credit-bar-skeleton" style={{ height: "100%", width: "40%", borderRadius: "999px" }} />
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-muted)", opacity: 0.5, flexShrink: 0 }}>···</span>
                    </div>
                  ) : (
                    <div className="sidebar-credit-badge" style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                      <Zap size={12} />
                      <span>{user.credit_balance.toLocaleString()} credits</span>
                    </div>
                  )}
                </div>
                <button type="button" className="sidebar-logout-btn icon-btn-ghost" onClick={onLogout} title="Log out" style={{ padding: "6px" }}>
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </>
      )}

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </aside>
  );
}

