import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export const adminKeys = {
  stats: ["admin", "stats"] as const,
  users: ["admin", "users"] as const,
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
