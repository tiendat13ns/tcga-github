import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { GenerateRequirementsResponse } from "../components/RequirementViewer";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_V1_REQ = `${API_BASE}/api/v1/requirements`;
const API_V1_PROJECTS = `${API_BASE}/api/v1/projects`;
const API_DOCS = `${API_BASE}/api/documents`;

/* ── Query Keys ─────────────────────────────────────────── */
export const requirementKeys = {
  testCases: (requirementId: string) => ["requirements", requirementId, "test-cases"] as const,
  documentDetail: (documentId: string) => ["documents", documentId, "detail"] as const,
  byProject: (projectId: string | null) => ["requirements", "byProject", projectId ?? "all"] as const,
};

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchTestCasesForRequirement(requirementId: string) {
  const r = await apiFetch(`${API_V1_REQ}/${requirementId}/test-cases`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.total_test_cases > 0 ? d : null;
}

/** Requirement (nếu có) của TOÀN BỘ document trong 1 project, gộp thành 1 request duy nhất
 * (thay vì gọi /documents/{id}/requirements riêng cho từng document — N+1 request). */
async function fetchProjectRequirements(projectId: string): Promise<Record<string, GenerateRequirementsResponse>> {
  const r = await apiFetch(`${API_V1_PROJECTS}/${projectId}/requirements`);
  if (!r.ok) throw new Error("Could not load requirements.");
  const d: { documents: Record<string, GenerateRequirementsResponse> } = await r.json();
  return d.documents;
}

async function fetchDocumentDetail(documentId: string) {
  const r = await apiFetch(`${API_DOCS}/${documentId}`);
  if (!r.ok) throw new Error("Could not load document detail.");
  return r.json();
}

async function generateTestCasesAPI(requirementId: string) {
  const r = await apiFetch(`${API_V1_REQ}/${requirementId}/test-cases/generate`, {
    method: "POST",
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.detail || "Could not generate test cases.");
  return d;
}

async function submitAnswersAPI({ requirementId, answers }: { requirementId: string; answers: string[] }) {
  const r = await apiFetch(`${API_V1_REQ}/${requirementId}/answers`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.detail || "Could not save answers.");
  return d;
}

/* ── Hooks ──────────────────────────────────────────────── */

/** Fetch test cases for a single requirement. */
export function useRequirementTestCases(requirementId: string, enabled = true) {
  return useQuery({
    queryKey: requirementKeys.testCases(requirementId),
    queryFn: () => fetchTestCasesForRequirement(requirementId),
    enabled,
    staleTime: 60_000,
  });
}

/** Requirement đã tồn tại của mọi document trong 1 project, cache theo projectId (staleTime:
 * Infinity mặc định — không tự fetch lại khi quay lại trang). Poll khi có doc đang generating
 * để badge "Generate" tự chuyển "View Req" mà không cần refresh. */
export function useProjectRequirements(projectId: string | null, poll: boolean) {
  return useQuery({
    queryKey: requirementKeys.byProject(projectId),
    queryFn: () => fetchProjectRequirements(projectId as string),
    enabled: !!projectId,
    refetchInterval: poll ? 3000 : false,
  });
}

/** Fetch document detail (filename, status, preview). */
export function useDocumentDetail(documentId: string | null | undefined) {
  return useQuery({
    queryKey: requirementKeys.documentDetail(documentId ?? ""),
    queryFn: () => fetchDocumentDetail(documentId!),
    enabled: !!documentId,
    staleTime: Infinity,
  });
}

/** Generate test cases for a requirement via POST. */
export function useGenerateTestCases(requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateTestCasesAPI(requirementId),
    onSuccess: (data) => {
      queryClient.setQueryData(requirementKeys.testCases(requirementId), data);
    },
  });
}

/** Submit HITL answers for a requirement and then generate test cases. */
export function useSubmitAnswers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAnswersAPI,
    onSuccess: (_data, { requirementId }) => {
      // Invalidate test cases so they refetch after answers saved
      queryClient.invalidateQueries({ queryKey: requirementKeys.testCases(requirementId) });
    },
  });
}
