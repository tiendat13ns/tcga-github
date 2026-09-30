import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudioTestCaseItem } from "../components/TesterStudio";
import type { TestExecutionItem } from "../components/TesterStudio/shared";
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

export function useTestCases(
  filters: Record<string, any>,
  enabled: boolean = true,
  options?: { refetchOnMount?: boolean | "always" }
) {
  return useQuery({
    queryKey: testCaseKeys.list(filters),
    queryFn: () => fetchTestCases(filters),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 mins
    ...options,
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

/* ── Ma trận chạy thử (Environment × Lần chạy) ─────────────────────────────
   execution_status TỔNG của test case được backend tự tính lại (rollup) mỗi khi 1 ô
   thay đổi. Danh sách execution của 1 test case có query riêng (không lồng trong
   testCases.list) vì Execution Matrix Drawer cần luôn thấy dữ liệu mới nhất trong khi
   đang mở, không phụ thuộc staleTime 5 phút của danh sách test case tổng. ── */

export const testExecutionKeys = {
  all: ["testExecutions"] as const,
  byTestCase: (testCaseId: string) => ["testExecutions", testCaseId] as const,
};

async function fetchTestExecutions(testCaseId: string): Promise<TestExecutionItem[]> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases/${testCaseId}/executions`);
  if (!r.ok) throw new Error("Failed to load executions");
  const d = await r.json();
  return d.executions || [];
}

export function useTestExecutions(testCaseId: string | null) {
  return useQuery({
    queryKey: testExecutionKeys.byTestCase(testCaseId || ""),
    queryFn: () => fetchTestExecutions(testCaseId as string),
    enabled: !!testCaseId,
  });
}

// Sau mỗi tạo/sửa/xoá 1 ô: làm mới cả danh sách execution (cho drawer đang mở) lẫn danh
// sách test case tổng (cho badge execution_status rollup ở bảng ngoài).
function invalidateExecutionRelatedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: testExecutionKeys.all });
  queryClient.invalidateQueries({ queryKey: testCaseKeys.all });
}

async function createExecutionAPI(payload: { testCaseId: string; environment: string }): Promise<TestExecutionItem> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases/${payload.testCaseId}/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ environment: payload.environment }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to add execution.");
  return d;
}

export function useCreateExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExecutionAPI,
    onSuccess: () => invalidateExecutionRelatedQueries(queryClient),
  });
}

async function updateExecutionAPI(payload: {
  executionId: string;
  data: Partial<Pick<TestExecutionItem, "result">>;
}): Promise<TestExecutionItem> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases/executions/${payload.executionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.data),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to update execution.");
  return d;
}

export function useUpdateExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateExecutionAPI,
    onSuccess: () => invalidateExecutionRelatedQueries(queryClient),
  });
}

async function deleteExecutionAPI(executionId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/api/v1/test-cases/executions/${executionId}`, { method: "DELETE" });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(d?.detail || "Failed to delete execution.");
  }
}

export function useDeleteExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExecutionAPI,
    onSuccess: () => invalidateExecutionRelatedQueries(queryClient),
  });
}
