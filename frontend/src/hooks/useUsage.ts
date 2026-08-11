import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/* ── Query Keys ─────────────────────────────────────────── */
export const usageKeys = {
  summary: ["usage", "summary"] as const,
  logs: (limit = 50, offset = 0) => ["usage", "logs", limit, offset] as const,
};

/* ── Types ───────────────────────────────────────────────── */
export interface UsagePlan {
  name: string;
  status: "active" | "coming_soon";
  price_vnd: number;
  credits_per_month: number;
  max_documents: number | null;
  max_projects: number | null;
  storage_mb: number;
}

export interface UsageSummary {
  credit_balance: number;
  current_plan: string;
  plan_status: string;
  total_credits_used: number;
  plans: UsagePlan[];
}

export interface UsageLogItem {
  id: string;
  operation: string;
  target_name: string | null;
  credits_used: number;
  created_at: string | null;
}

export interface UsageLogsResponse {
  total: number;
  items: UsageLogItem[];
}

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchUsageSummary(): Promise<UsageSummary> {
  const r = await apiFetch(`${API_BASE}/api/usage/summary`);
  if (!r.ok) throw new Error("Failed to load usage summary");
  return r.json();
}

async function fetchUsageLogs(limit = 50, offset = 0): Promise<UsageLogsResponse> {
  const r = await apiFetch(`${API_BASE}/api/usage/logs?limit=${limit}&offset=${offset}`);
  if (!r.ok) throw new Error("Failed to load usage logs");
  return r.json();
}

/**
 * Trả về credits_per_month của gói hiện tại của user (dựa trên current_plan trong
 * summary), hoặc undefined nếu chưa load xong / không tìm thấy plan khớp tên.
 */
export function getCurrentPlanQuota(summary: UsageSummary | undefined): number | undefined {
  return summary?.plans.find((p) => p.name === summary.current_plan)?.credits_per_month;
}

/* ── Hooks ──────────────────────────────────────────────── */

/**
 * Fetch usage summary (credit balance, plan info, total used).
 * Refetches every 30 seconds to keep credit balance live.
 */
export function useUsageSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: usageKeys.summary,
    queryFn: fetchUsageSummary,
    staleTime: 30_000,       // consider fresh for 30 seconds
    refetchInterval: 30_000, // auto-refetch in background every 30s
    enabled: options?.enabled ?? true,
  });
}

/**
 * Fetch usage logs with pagination.
 */
export function useUsageLogs(limit = 50, offset = 0) {
  return useQuery({
    queryKey: usageKeys.logs(limit, offset),
    queryFn: () => fetchUsageLogs(limit, offset),
    staleTime: 30_000,
  });
}

/**
 * Returns a helper to invalidate (force-refetch) all usage queries.
 * Call this after any action that changes credit balance.
 */
export function useInvalidateUsage() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["usage"] });
  };
}
