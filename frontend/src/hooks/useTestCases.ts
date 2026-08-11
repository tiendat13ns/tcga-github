import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudioTestCaseItem } from "../components/TesterStudio";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/* ── Query Keys ─────────────────────────────────────────── */
export const testCaseKeys = {
  all: ["testCases"] as const,
  list: (filters: Record<string, any>) => ["testCases", "list", filters] as const,
};

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchTestCases(filters: Record<string, any>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.append(key, String(value));
  }

  const r = await apiFetch(`${API_BASE}/api/v1/test-cases?${params.toString()}`);
  if (!r.ok) throw new Error("Failed to load test cases");
  const d = await r.json();
  return {
    test_cases: d.test_cases || [],
    total_test_cases: d.total_test_cases || 0,
  };
}

async function updateTestCaseAPI(payload: { id: string; data: Partial<StudioTestCaseItem> }): Promise<StudioTestCaseItem> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases/${payload.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.data),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to update test case.");
  return d;
}

/* ── Hooks ──────────────────────────────────────────────── */

export function useTestCases(filters: Record<string, any>, enabled: boolean = true) {
  return useQuery({
    queryKey: testCaseKeys.list(filters),
    queryFn: () => fetchTestCases(filters),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 mins
  });
}

export function useUpdateTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTestCaseAPI,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: testCaseKeys.all });
      const previousQueries = queryClient.getQueriesData({ queryKey: testCaseKeys.all });
      
      previousQueries.forEach(([key, oldData]: any) => {
        if (oldData?.test_cases) {
          queryClient.setQueryData(key, {
            ...oldData,
            test_cases: oldData.test_cases.map((tc: any) => 
              tc.id === payload.id ? { ...tc, ...payload.data } : tc
            )
          });
        }
      });
      return { previousQueries };
    },
    onError: (err, newTodo, context: any) => {
      context?.previousQueries?.forEach(([key, oldData]: any) => {
        queryClient.setQueryData(key, oldData);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.all });
    },
  });
}

async function createTestCaseAPI(payload: any): Promise<StudioTestCaseItem> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to create test case.");
  return d;
}

export function useCreateTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTestCaseAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.all });
    },
  });
}

async function generateBugReportAPI(payload: { id: string; actual_result: string }): Promise<{ report: string }> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases/${payload.id}/bug-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actual_result: payload.actual_result }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to generate bug report.");
  return d;
}

export function useGenerateBugReport() {
  return useMutation({
    mutationFn: generateBugReportAPI,
  });
}
