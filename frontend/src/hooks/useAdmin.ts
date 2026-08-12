import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export const adminKeys = {
  stats: ["admin", "stats"] as const,
  users: ["admin", "users"] as const,
  feedback: ["admin", "feedback"] as const,
};

export interface AdminStats {
  total_users: number;
  total_projects: number;
  total_documents: number;
  total_requirements: number;
  total_test_cases: number;
  total_usage_logs: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  plan?: string;
  credit_balance: number;
  created_at: string | null;
  projects_count: number;
  requirements_count: number;
  test_cases_count: number;
}

export interface AdminFeedback {
  id: string;
  user_email: string;
  type: "bug" | "feature_request" | "other";
  message: string;
  status: "new" | "reviewed";
  created_at: string | null;
}

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchAdminStats(): Promise<AdminStats> {
  const r = await apiFetch(`${API_BASE}/api/admin/stats`);
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Không thể tải thống kê Admin");
  }
  return r.json();
}

async function fetchAdminUsers(): Promise<AdminUser[]> {
  const r = await apiFetch(`${API_BASE}/api/admin/users`);
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Không thể tải danh sách người dùng Admin");
  }
  return r.json();
}

async function updateUserCredits({ userId, credit_balance }: { userId: string; credit_balance: number }) {
  const r = await apiFetch(`${API_BASE}/api/admin/users/${userId}/credits`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credit_balance }),
  });
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Cập nhật credit thất bại");
  }
  return r.json();
}

export type PlanKey = "free" | "lite" | "pro";

async function updateUserPlan({ userId, plan }: { userId: string; plan: PlanKey }) {
  const r = await apiFetch(`${API_BASE}/api/admin/users/${userId}/plan`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Đổi gói thất bại");
  }
  return r.json();
}

async function fetchAdminFeedback(): Promise<AdminFeedback[]> {
  const r = await apiFetch(`${API_BASE}/api/admin/feedback`);
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Không thể tải danh sách feedback");
  }
  return r.json();
}

async function updateFeedbackStatus({ feedbackId, status }: { feedbackId: string; status: string }) {
  const r = await apiFetch(`${API_BASE}/api/admin/feedback/${feedbackId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Cập nhật trạng thái feedback thất bại");
  }
  return r.json();
}

/* ── Hooks ──────────────────────────────────────────────── */
export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: fetchAdminStats,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: fetchAdminUsers,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAdminFeedback() {
  return useQuery({
    queryKey: adminKeys.feedback,
    queryFn: fetchAdminFeedback,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFeedbackStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.feedback });
    },
  });
}

export function useUpdateUserCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserCredits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats });
    },
  });
}

export function useUpdateUserPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users });
    },
  });
}
