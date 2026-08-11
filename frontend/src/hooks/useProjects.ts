import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project } from "../components/Projects/ProjectManager";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/* ── Query Keys ─────────────────────────────────────────── */
export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

/* ── Fetchers ───────────────────────────────────────────── */
async function fetchProjects(): Promise<Project[]> {
  const r = await apiFetch(`${API_BASE}/api/v1/projects`);
  if (!r.ok) throw new Error("Failed to load projects");
  const d = await r.json();
  return d.projects || [];
}

async function createProjectAPI(payload: { name: string; description?: string | null }): Promise<Project> {
  const r = await apiFetch(`${API_BASE}/api/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to create project.");
  return d;
}

async function updateProjectAPI(payload: { id: string; name: string; description?: string | null }): Promise<Project> {
  const r = await apiFetch(`${API_BASE}/api/v1/projects/${payload.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: payload.name, description: payload.description }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail || "Failed to update project.");
  return d;
}

async function deleteProjectAPI(projectId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/api/v1/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(d?.detail || "Failed to delete project.");
  }
}

/* ── Hooks ──────────────────────────────────────────────── */

/** Fetch all projects. Cached for the entire session (staleTime: Infinity). */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: fetchProjects,
  });
}

/** Create a new project and update the projects cache. */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProjectAPI,
    onSuccess: (newProject) => {
      // Optimistically prepend the new project to the cache
      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old ? [newProject, ...old] : [newProject]
      );
    },
  });
}

/** Update a project's name/description and update the projects cache. */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectAPI,
    onSuccess: (updatedProject) => {
      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old ? old.map((p) => (p.id === updatedProject.id ? updatedProject : p)) : old
      );
    },
  });
}

/** Delete a project and update the projects cache. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProjectAPI,
    onSuccess: (_data, projectId) => {
      // Optimistically remove the project from the cache
      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old ? old.filter((p) => p.id !== projectId) : []
      );
    },
  });
}
