import { useEffect, useLayoutEffect, useState } from "react";
import { Project } from "../components/Projects/ProjectManager";
import { useProjects } from "./useProjects";

export type ViewType = "overview" | "projects" | "project_detail" | "test_cases" | "usage" | "tutorial" | "admin" | "settings" | "admin_feedback";

const VIEW_TO_PATH: Record<Exclude<ViewType, "project_detail">, string> = {
  overview: "/overview",
  projects: "/projects",
  test_cases: "/test-cases",
  usage: "/usage",
  tutorial: "/tutorial",
  admin: "/admin",
  settings: "/settings",
  admin_feedback: "/admin/feedback",
};

function pathToView(pathname: string): { view: ViewType; projectId: string | null } {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p.startsWith("/projects/")) {
    const id = p.slice("/projects/".length);
    if (id) return { view: "project_detail", projectId: id };
  }
  if (p === "/admin/feedback") return { view: "admin_feedback", projectId: null };
  if (p === "/admin") return { view: "admin", projectId: null };
  if (p === "/overview") return { view: "overview", projectId: null };
  if (p === "/projects") return { view: "projects", projectId: null };
  if (p === "/test-cases") return { view: "test_cases", projectId: null };
  if (p === "/usage") return { view: "usage", projectId: null };
  if (p === "/tutorial") return { view: "tutorial", projectId: null };
  if (p === "/settings") return { view: "settings", projectId: null };
  // Default: /overview
  return { view: "overview", projectId: null };
}

function viewToPath(view: ViewType, projectId?: string): string {
  if (view === "project_detail" && projectId) return `/projects/${projectId}`;
  return VIEW_TO_PATH[view as keyof typeof VIEW_TO_PATH] || "/overview";
}

type AuthedUser = { role: string } | null | undefined;

/**
 * Toàn bộ logic điều hướng thủ công của app (không dùng router lib):
 * pathname/activeView/selectedProject state, đồng bộ với URL qua pushState/popstate.
 */
export function useAppRouter(isAuthenticated: boolean, user: AuthedUser) {
  const initialRoute = pathToView(window.location.pathname);
  const [pathname, setPathname] = useState<string>(window.location.pathname);
  const [activeView, setActiveView] = useState<ViewType>(initialRoute.view);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(initialRoute.projectId);

  const { data: allProjects } = useProjects();

  // Điều hướng thủ công — cập nhật URL + state pathname cùng lúc.
  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setPathname(path);
  };

  // ── popstate listener (browser back/forward) ──
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      const route = pathToView(window.location.pathname);
      setActiveView(route.view);
      if (route.view === "project_detail" && route.projectId) {
        const found = allProjects?.find(p => p.id === route.projectId) || null;
        setSelectedProject(found);
        if (!found) setPendingProjectId(route.projectId);
      } else {
        setSelectedProject(null);
        setPendingProjectId(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allProjects]);

  // ── resolve pending project ID once data is available ──
  useEffect(() => {
    if (pendingProjectId && allProjects && allProjects.length > 0) {
      const found = allProjects.find(p => p.id === pendingProjectId);
      if (found) {
        setSelectedProject(found);
        setActiveView("project_detail");
      } else {
        // Project not found, fallback to projects list
        setActiveView("projects");
        window.history.replaceState(null, "", "/projects");
      }
      setPendingProjectId(null);
    }
  }, [pendingProjectId, allProjects]);

  // ── set initial URL on first authenticated load & redirect admin ──
  useEffect(() => {
    // Trang landing ("/") tự quản lý điều hướng riêng qua nút Dashboard — không để effect này ghi đè URL.
    if (window.location.pathname === "/") return;
    if (isAuthenticated && user) {
      if (user.role === "admin" && (activeView === "overview" || window.location.pathname === "/overview" || window.location.pathname === "/login")) {
        setActiveView("admin");
        window.history.replaceState(null, "", "/admin");
        return;
      }
      const currentPath = viewToPath(activeView, selectedProject?.id);
      if (window.location.pathname !== currentPath) {
        window.history.replaceState(null, "", currentPath);
      }
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guard: user KHÔNG phải admin thì không được ở view "admin" ──
  // Bất kể vào bằng cách nào (gõ URL trực tiếp, back/forward, deep-link), non-admin ở activeView
  // "admin" sẽ bị lặng lẽ đưa về /overview — KHÔNG hiện cảnh báo "không có quyền", và dùng
  // replaceState để /admin không nằm trong lịch sử → không lộ cho người dùng biết route admin
  // tồn tại (giảm bề mặt bị dò tìm lỗ hổng). useLayoutEffect để đổi view TRƯỚC khi trình duyệt
  // vẽ → không nháy thoáng màn hình admin/trống.
  useLayoutEffect(() => {
    if (!isAuthenticated || !user) return;
    if ((activeView === "admin" || activeView === "admin_feedback") && user.role !== "admin") {
      setActiveView("overview");
      setPathname("/overview");
      window.history.replaceState(null, "", "/overview");
    }
  }, [activeView, isAuthenticated, user]);

  // TesterStudio tự quản lý view nội bộ (projects/documents/testcases) tách biệt với router này.
  // Bấm "Tester Studio" ở sidebar trong khi đang ở sâu bên trong nó không đổi activeView (đã là
  // "test_cases" từ trước) nên component không re-mount và không quay về màn hình chọn project.
  // Tăng key này mỗi lần điều hướng tới "test_cases" để ép re-mount, reset về màn hình gốc.
  const [testerStudioResetKey, setTesterStudioResetKey] = useState(0);

  const handleNavigate = (view: "overview" | "projects" | "test_cases" | "usage" | "tutorial" | "admin" | "settings" | "admin_feedback") => {
    setActiveView(view);
    setSelectedProject(null);
    setPendingProjectId(null);
    navigateTo(viewToPath(view));
    if (view === "test_cases") {
      setTesterStudioResetKey((k) => k + 1);
    }
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setActiveView("project_detail");
    localStorage.setItem("tcga_last_project_id", project.id);
    navigateTo(`/projects/${project.id}`);
  };

  const handleSelectProjectById = (projectId: string) => {
    localStorage.setItem("tcga_last_project_id", projectId);
    const found = allProjects?.find((p) => p.id === projectId);
    if (found) {
      setSelectedProject(found);
    } else {
      setPendingProjectId(projectId);
    }
    setActiveView("project_detail");
    navigateTo(`/projects/${projectId}`);
  };

  const handleNavigateToTestCases = (projectId?: string) => {
    if (projectId) {
      localStorage.setItem("tcga_last_tester_project_id", projectId);
    }
    handleNavigate("test_cases");
  };

  const resetForLogin = () => {
    setSelectedProject(null);
    setPendingProjectId(null);
  };

  return {
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
  };
}
