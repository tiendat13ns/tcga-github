import "./styles.css";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import DesktopRequiredGate from "./components/DesktopRequiredGate";
import GlobalSidebar from "./components/GlobalSidebar";
import ProjectsGrid from "./components/Projects/ProjectsGrid";
import ProjectDetailDashboard from "./components/Projects/ProjectDetailDashboard";
import TesterStudio from "./components/TesterStudio";
import UsageBilling from "./components/UsageBilling";
import SettingsPage from "./components/SettingsPage";
import AdminDashboard from "./components/AdminDashboard";
import AdminFeedbackPage from "./components/AdminDashboard/FeedbackPage";
import OverviewDashboard from "./components/OverviewDashboard";
import OnboardingTour from "./components/Tutorial/OnboardingTour";
import TutorialsView from "./components/Tutorial/TutorialsView";
import { useAppRouter } from "./hooks/useAppRouter";
import { useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/LoginScreen";
import LandingPage from "./components/landing/LandingPage";
import WhatsNewPage from "./components/landing/WhatsNewPage";

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
  // Trạng thái sinh requirement chạy nền: null = chưa/xong, "generating", "failed".
  requirement_status?: string | null;
  requirement_error?: string | null;
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
  const [isTourRunning, setIsTourRunning] = useState(false);

  // Tour chỉ target anchor trên Sidebar + Overview (xem lib/tourSteps.ts) nên luôn chuyển
  // về Overview trước khi bật, để mọi anchor cùng tồn tại trên 1 màn hình.
  const startTour = () => {
    handleNavigate("overview");
    setIsTourRunning(true);
  };

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
        onGoToWhatsNew={() => navigateTo("/whats-new")}
      />
    );
  }

  // Trang "Tính năng mới" — công khai như landing, tách route riêng để không làm loãng nội
  // dung landing (mục tiêu chuyển đổi khách mới) với changelog (phục vụ người dùng hiện tại).
  if (pathname === "/whats-new") {
    return (
      <WhatsNewPage
        isAuthenticated={isAuthenticated}
        onGoToLogin={() => navigateTo("/login")}
        onGoToRegister={() => navigateTo("/register")}
        onGoToDashboard={() => {
          const isAdmin = user?.role === "admin";
          setActiveView(isAdmin ? "admin" : "overview");
          navigateTo(isAdmin ? "/admin" : "/overview");
        }}
        onGoToLanding={() => navigateTo("/")}
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
        onLoginSuccess={(token, refreshToken, userEmail) => {
          login(token, refreshToken);
          resetForLogin();
          const isAdminEmail = userEmail && userEmail.toLowerCase() === "dat96133@gmail.com";
          const targetView = isAdminEmail ? "admin" : "overview";
          const targetPath = isAdminEmail ? "/admin" : "/overview";
          setActiveView(targetView);
          window.history.replaceState(null, "", targetPath);
        }}
        initialMode={authMode}
        onGoToLanding={() => navigateTo("/")}
      />
    );
  }

  return (
    <DesktopRequiredGate onGoHome={() => navigateTo("/")} onSignOut={logout}>
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

          {activeView === "admin_feedback" && user?.role === "admin" && (
            <AdminFeedbackPage />
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

          {activeView === "tutorial" && <TutorialsView onStartTour={startTour} />}

          {activeView === "settings" && (
            <SettingsPage onNavigateToUsage={() => handleNavigate("usage")} />
          )}
        </main>
      </div>
    </div>
    <OnboardingTour run={isTourRunning} onFinish={() => setIsTourRunning(false)} />
    </DesktopRequiredGate>
  );
}

export default App;
