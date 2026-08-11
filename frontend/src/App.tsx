import "./styles.css";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import GlobalSidebar from "./components/GlobalSidebar";
import ProjectsGrid from "./components/Projects/ProjectsGrid";
import ProjectDetailDashboard from "./components/Projects/ProjectDetailDashboard";
import TesterStudio from "./components/TesterStudio";
import UsageBilling from "./components/UsageBilling";
import AdminDashboard from "./components/AdminDashboard";
import OverviewDashboard from "./components/OverviewDashboard";
import TutorialPlaceholder from "./components/TutorialPlaceholder";
import { useAppRouter } from "./hooks/useAppRouter";
import { useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/LoginScreen";
import LandingPage from "./components/landing/LandingPage";

export type DocumentItem = {
  id: string;
  project_id?: string | null;
  original_filename: string;
  stored_filename: string;
  file_type: string;
  file_size: number;
  file_path: string;
  status: string;
  uploaded_at: string;
  error_message?: string | null;
  updated_at?: string | null;
};

function App() {
  const { isAuthenticated, isLoading, login, user, logout } = useAuth();
  const {
    pathname,
    activeView,
    selectedProject,
    setActiveView,
    navigateTo,
    handleNavigate,
    handleSelectProject,
    handleSelectProjectById,
    handleNavigateToTestCases,
    resetForLogin,
    testerStudioResetKey,
  } = useAppRouter(isAuthenticated, user);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", color: "var(--text-muted)" }}>
          <Sparkles className="animate-spin" size={28} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang chuẩn bị không gian làm việc...</span>
        </div>
      </div>
    );
  }

  // Trang landing công khai — hiển thị cho mọi người, kể cả đã đăng nhập (CTA đổi thành "Vào Dashboard").
  if (pathname === "/") {
    return (
      <LandingPage
        isAuthenticated={isAuthenticated}
        onGoToLogin={() => navigateTo("/login")}
        onGoToRegister={() => navigateTo("/register")}
        onGoToDashboard={() => {
          const isAdmin = user?.role === "admin";
          setActiveView(isAdmin ? "admin" : "overview");
          navigateTo(isAdmin ? "/admin" : "/overview");
        }}
      />
    );
  }

  if (!isAuthenticated) {
    const currentPath = window.location.pathname;
    const authMode = currentPath === "/register" ? "register" : "login";
    // Redirect to /login or /register if not already there
    if (currentPath !== "/login" && currentPath !== "/register") {
      window.history.replaceState(null, "", "/login");
    }
    return (
      <LoginScreen
        onLoginSuccess={(token, userEmail) => {
          login(token);
          resetForLogin();
          const isAdminEmail = userEmail && userEmail.toLowerCase() === "dat96133@gmail.com";
          const targetView = isAdminEmail ? "admin" : "overview";
          const targetPath = isAdminEmail ? "/admin" : "/overview";
          setActiveView(targetView);
          window.history.replaceState(null, "", targetPath);
        }}
        initialMode={authMode}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Main layout */}
      <div className="app-workspace">
        <div
          style={{
            width: isSidebarOpen ? "280px" : "64px",
            minWidth: isSidebarOpen ? "280px" : "64px",
            overflow: "hidden",
            transition: "width var(--transition-slow), min-width var(--transition-slow)",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <GlobalSidebar
            activeView={activeView}
            selectedProject={selectedProject}
            onNavigate={handleNavigate}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            user={user}
            onLogout={logout}
            onGoToLanding={() => navigateTo("/")}
          />
        </div>

        <main className="app-main" style={{ flex: 1, minWidth: 0, padding: 0 }}>
          {/* Chỉ mount AdminDashboard khi user thực sự là admin — non-admin không bao giờ gọi
              API admin (không lộ 403) và không thấy nội dung admin. Kết hợp guard redirect ở
              useAppRouter để đá về /overview lặng lẽ. */}
          {activeView === "admin" && user?.role === "admin" && (
            <AdminDashboard />
          )}

          {activeView === "overview" && (
            <OverviewDashboard
              onNavigateToProjects={() => handleNavigate("projects")}
              onSelectProject={handleSelectProjectById}
              onNavigateToTestCases={handleNavigateToTestCases}
            />
          )}

          {activeView === "projects" && (
            <ProjectsGrid onSelectProject={handleSelectProject} />
          )}

          {activeView === "project_detail" && selectedProject && (
            <ProjectDetailDashboard project={selectedProject} />
          )}

          {activeView === "test_cases" && (
            <TesterStudio key={testerStudioResetKey} onNavigateToProjects={() => handleNavigate("projects")} />
          )}

          {activeView === "usage" && (
            <UsageBilling />
          )}

          {activeView === "tutorial" && <TutorialPlaceholder />}
        </main>
      </div>
    </div>
  );
}

export default App;
