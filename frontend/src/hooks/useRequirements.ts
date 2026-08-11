import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_V1_REQ = `${API_BASE}/api/v1/requirements`;
const API_DOCS = `${API_BASE}/api/documents`;

/* ── Query Keys ─────────────────────────────────────────── */
export const requirementKeys = {
  testCases: (requirementId: string) => ["requirements", requirementId, "test-cases"] as const,
  documentDetail: (documentId: string) => ["documents", documentId, "detail"] as const,
};

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchTestCasesForRequirement(requirementId: string) {
  const r = await apiFetch(`${API_V1_REQ}/${requirementId}/test-cases`);
  if (!r.ok) return null;
  const d = await r.json();
  return d.total_test_cases > 0 ? d : null;
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
