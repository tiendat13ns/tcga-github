import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/Toast/ToastProvider";
import { useNotifications } from "./NotificationContext";
import { documentKeys } from "../hooks/useDocuments";
import { requirementKeys } from "../hooks/useRequirements";
import { testCaseKeys } from "../hooks/useTestCases";

/**
 * Theo dõi các job chạy nền (sinh Requirement / Test Case) ở tầng APP ROOT — sống xuyên suốt
 * điều hướng, nên phát hiện được job hoàn tất và bắn toast NGAY CẢ khi người dùng đã rời khỏi
 * trang/panel vừa bấm (nơi có vòng poll cục bộ sẽ bị huỷ khi unmount).
 *
 * Chống N+1: poll gộp theo nhóm — job requirement gộp theo project (1 request/project qua
 * /api/documents), job test case gộp theo document (1 request/document qua
 * /requirements/status). Số request tỉ lệ với số project/document đang có job (thường 1),
 * KHÔNG tỉ lệ với số item. Chỉ poll khi còn job đang chờ và người dùng đã đăng nhập.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const POLL_INTERVAL_MS = 3000;

type ReqJob = { key: string; kind: "requirement"; documentId: string; projectId: string | null; label: string };
type TcJob = { key: string; kind: "testcase"; documentId: string; requirementId: string; projectId: string | null; label: string };
type Job = ReqJob | TcJob;

type JobTrackerContextType = {
  trackRequirementJob: (job: { documentId: string; projectId: string | null; label: string }) => void;
  trackTestCaseJob: (job: { documentId: string; requirementId: string; projectId: string | null; label: string }) => void;
};

const JobTrackerContext = createContext<JobTrackerContextType | undefined>(undefined);

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function JobTrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<Job[]>([]);

  // Refs để tick() (chạy trong interval) luôn đọc giá trị mới nhất mà không cần tái tạo interval.
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;

  // Các key ĐÃ bắn thông báo hoàn tất — chống báo trùng: job chỉ báo ĐÚNG 1 LẦN dù tick chạy
  // chồng nhau / lặp (StrictMode nhân đôi interval ở dev, hoặc response chậm làm 2 tick cùng
  // thấy trạng thái "xong" trước khi job kịp bị gỡ khỏi state). Cập nhật đồng bộ trong tick
  // (không qua setState) nên có hiệu lực ngay, không dính độ trễ re-render như jobsRef.
  const notifiedRef = useRef<Set<string>>(new Set());
  // Chặn 2 tick chạy song song (mỗi lần chỉ 1 lượt poll).
  const runningRef = useRef(false);

  const trackRequirementJob = useCallback((job: { documentId: string; projectId: string | null; label: string }) => {
    const key = `req:${job.documentId}`;
    notifiedRef.current.delete(key);  // cho phép báo lại nếu sinh lại cùng document
    setJobs((prev) => (prev.some((j) => j.key === key) ? prev : [...prev, { key, kind: "requirement", ...job }]));
  }, []);

  const trackTestCaseJob = useCallback((job: { documentId: string; requirementId: string; projectId: string | null; label: string }) => {
    const key = `tc:${job.requirementId}`;
    notifiedRef.current.delete(key);
    setJobs((prev) => (prev.some((j) => j.key === key) ? prev : [...prev, { key, kind: "testcase", ...job }]));
  }, []);

  // Đổi tài khoản (login/logout/switch): bỏ mọi job đang theo dõi để không bắn toast của
  // tài khoản cũ cho tài khoản mới.
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  useEffect(() => {
    if (userIdRef.current !== userId) {
      userIdRef.current = userId;
      setJobs([]);
    }
  }, [userId]);

  const tick = useCallback(async () => {
    if (runningRef.current) return;  // đã có 1 lượt poll đang chạy → bỏ qua, tránh chồng chéo
    const current = jobsRef.current;
    if (current.length === 0) return;
    runningRef.current = true;
    try {
      const reqJobs = current.filter((j): j is ReqJob => j.kind === "requirement");
      const tcJobs = current.filter((j): j is TcJob => j.kind === "testcase");
      const completedKeys: string[] = [];

      // ── Requirement jobs: gộp theo project, 1 request /api/documents mỗi project ──
      const reqByProject = groupBy(reqJobs, (j) => j.projectId ?? "__all__");
      await Promise.all([...reqByProject.entries()].map(async ([pk, group]) => {
        const url = pk === "__all__" ? `${API_BASE}/api/documents` : `${API_BASE}/api/documents?project_id=${pk}`;
        try {
          const r = await apiFetch(url);
          if (!r.ok) return;
          const docs: { id: string; requirement_status?: string | null }[] = await r.json();
          const statusById = new Map(docs.map((d) => [d.id, d.requirement_status ?? null]));
          for (const j of group) {
            if (!statusById.has(j.documentId)) { completedKeys.push(j.key); continue; } // bị xoá → ngừng theo dõi
            const s = statusById.get(j.documentId);
            if (s === "generating") continue;
            completedKeys.push(j.key);
            if (notifiedRef.current.has(j.key)) continue;  // đã báo rồi → chỉ gỡ job, không báo lại
            notifiedRef.current.add(j.key);
            if (s === "failed") {
              showToastRef.current(`Sinh Requirement thất bại cho "${j.label}"`, "error");
              addNotificationRef.current({ kind: "requirement", status: "error", label: j.label });
            } else {
              showToastRef.current(`Đã tạo xong Requirement cho "${j.label}"`, "success");
              addNotificationRef.current({ kind: "requirement", status: "success", label: j.label });
            }
            qcRef.current.invalidateQueries({ queryKey: documentKeys.byProject(j.projectId) });
            qcRef.current.invalidateQueries({ queryKey: requirementKeys.byProject(j.projectId) });
          }
        } catch { /* lỗi mạng → thử lại lần poll sau */ }
      }));

      // ── Test case jobs: gộp theo document, 1 request /requirements/status mỗi document ──
      const tcByDoc = groupBy(tcJobs, (j) => j.documentId);
      await Promise.all([...tcByDoc.entries()].map(async ([docId, group]) => {
        try {
          const r = await apiFetch(`${API_BASE}/api/v1/documents/${docId}/requirements/status`);
          if (!r.ok) return;
          const data = await r.json();
          const reqs: { id: string; test_case_status?: string | null }[] = data.requirements || [];
          const statusById = new Map(reqs.map((x) => [x.id, x.test_case_status ?? null]));
          let anyDone = false;
          for (const j of group) {
            if (!statusById.has(j.requirementId)) { completedKeys.push(j.key); continue; }
            const s = statusById.get(j.requirementId);
            if (s === "generating") continue;
            completedKeys.push(j.key);
            if (notifiedRef.current.has(j.key)) continue;
            notifiedRef.current.add(j.key);
            anyDone = true;
            if (s === "failed") {
              showToastRef.current(`Sinh Test Case thất bại cho "${j.label}"`, "error");
              addNotificationRef.current({ kind: "testcase", status: "error", label: j.label });
            } else {
              showToastRef.current(`Đã tạo xong Test Case cho "${j.label}"`, "success");
              addNotificationRef.current({ kind: "testcase", status: "success", label: j.label });
            }
          }
          if (anyDone) qcRef.current.invalidateQueries({ queryKey: testCaseKeys.all });
        } catch { /* lỗi mạng → thử lại lần poll sau */ }
      }));

      if (completedKeys.length > 0) {
        const done = new Set(completedKeys);
        setJobs((prev) => prev.filter((j) => !done.has(j.key)));
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  // Interval sống khi CÒN job và đã đăng nhập; dừng ngay khi hết job (tránh poll vô ích).
  const isAuthed = !!user;
  const hasJobs = jobs.length > 0;
  useEffect(() => {
    if (!hasJobs || !isAuthed) return;
    const t = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasJobs, isAuthed, tick]);

  return (
    <JobTrackerContext.Provider value={{ trackRequirementJob, trackTestCaseJob }}>
      {children}
    </JobTrackerContext.Provider>
  );
}

export function useJobTracker() {
  const ctx = useContext(JobTrackerContext);
  if (ctx === undefined) {
    throw new Error("useJobTracker must be used within a JobTrackerProvider");
  }
  return ctx;
}
