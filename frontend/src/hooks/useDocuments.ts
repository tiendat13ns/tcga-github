import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DocumentItem } from "../App";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_URL = `${API_BASE}/api/documents`;

/* ── Query Keys ─────────────────────────────────────────── */
export const documentKeys = {
  all: ["documents"] as const,
  byProject: (projectId: string | null) => ["documents", projectId ?? "all"] as const,
};

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchDocuments(projectId: string | null): Promise<DocumentItem[]> {
  const url = projectId ? `${API_URL}?project_id=${projectId}` : API_URL;
  const r = await apiFetch(url);
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.detail || "Could not load documents.");
  return d;
}

async function deleteDocumentAPI(docId: string): Promise<string> {
  const r = await apiFetch(`${API_URL}/selected`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [docId] }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.detail || "Could not delete document.");
  return docId;
}

async function clearDocumentsAPI(projectId: string): Promise<void> {
  const r = await apiFetch(`${API_URL}?project_id=${projectId}`, { method: "DELETE" });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.detail || "Could not clear history.");
}

/* ── Hooks ──────────────────────────────────────────────── */

/** Fetch all documents for a project. Cached per projectId for the session. */
export function useProjectDocuments(projectId: string | null) {
  return useQuery({
    queryKey: documentKeys.byProject(projectId),
    queryFn: () => fetchDocuments(projectId),
    // Tự poll khi có document đang sinh requirement ở nền — để badge "Đang tạo..." tự chuyển
    // sang "View Req"/"failed" mà người dùng không phải refresh. Ngừng poll khi không còn cái nào.
    refetchInterval: (query) => {
      const docs = query.state.data as { requirement_status?: string | null }[] | undefined;
      const anyGenerating = Array.isArray(docs) && docs.some((d) => d.requirement_status === "generating");
      return anyGenerating ? 3000 : false;
    },
  });
}

/** Delete a single document and update the cache. */
export function useDeleteDocument(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocumentAPI,
    onSuccess: (deletedId) => {
      queryClient.setQueryData<DocumentItem[]>(
        documentKeys.byProject(projectId),
        (old) => old ? old.filter((d) => d.id !== deletedId) : []
      );
      // Also invalidate project stats since file count changed
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Clear all documents of the given project and update the cache. */
export function useClearDocuments(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearDocumentsAPI(projectId as string),
    onSuccess: () => {
      queryClient.setQueryData<DocumentItem[]>(
        documentKeys.byProject(projectId),
        []
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Manually add newly uploaded documents to the cache. */
export function useAddDocumentsToCache(projectId: string | null) {
  const queryClient = useQueryClient();
  return (newDocs: DocumentItem[]) => {
    queryClient.setQueryData<DocumentItem[]>(
      documentKeys.byProject(projectId),
      (old) => {
        const currentIds = new Set((old || []).map((d) => d.id));
        return [...newDocs.filter((d) => !currentIds.has(d.id)), ...(old || [])];
      }
    );
    // Invalidate project stats since file count changed
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
}
