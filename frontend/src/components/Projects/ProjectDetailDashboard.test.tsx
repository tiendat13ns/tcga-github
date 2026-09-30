import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ProjectDetailDashboard from "./ProjectDetailDashboard";

const requirementResponse = {
  document_id: "document-1",
  project_id: "project-1",
  total_requirements: 1,
  requirements: [{
    id: "requirement-1", title: "Login", description: "Login flow",
    functional_requirement: null, validation_rule: null, permission: null, workflow: null,
    state: null, error_handling: null, module_name: null, feature_name: null,
    actor: null, goal: null, trigger: null, business_rules: null, inputs: null, outputs: null,
    preconditions: null, validation_rules: null, exception_flows: null, source_reference: null,
    components: null, error_messages: null, status: "ai_generated", version: 1,
    clarifying_questions: ["Trigger là gì?"], user_answers: null, user_context: null,
    test_case_status: null, test_case_error: null,
  }],
};

vi.mock("../Documents/DocumentUpload", () => ({ default: () => null }));
vi.mock("../Documents/DocumentList", () => ({
  default: ({ onViewRequirements }: { onViewRequirements: (reqs: typeof requirementResponse, doc: object) => void }) => (
    <button onClick={() => onViewRequirements(requirementResponse, {
      id: "document-1", project_id: "project-1", original_filename: "srs.docx",
      stored_filename: "srs.docx", file_type: "docx", file_size: 10, file_path: "uploads/srs.docx",
      status: "completed", uploaded_at: "2026-01-01",
    })}>View requirement</button>
  ),
}));
vi.mock("../RequirementViewer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../RequirementViewer")>();
  return {
    ...actual,
    default: ({ uiState, onUiStateChange }: {
      uiState: import("../RequirementViewer").RequirementViewerUiState;
      onUiStateChange: (state: import("../RequirementViewer").RequirementViewerUiState) => void;
    }) => (
      <div>
        <span>Draft: {uiState.qaAnswersDraft["requirement-1"]?.[0] || "empty"}</span>
        <button onClick={() => onUiStateChange({
          ...uiState,
          qaAnswersDraft: { ...uiState.qaAnswersDraft, "requirement-1": ["Khi người dùng nhấn Đăng nhập"] },
        })}>Set draft</button>
      </div>
    ),
  };
});
vi.mock("../SideDrawer", () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div>{children}</div> : null,
}));
vi.mock("../ChatWorkspace", () => ({ default: () => null }));
vi.mock("../Documents/DocumentContextSidebar", () => ({ default: () => null }));
vi.mock("../../hooks/useChatHistory", () => ({
  useChatHistory: () => ({ data: [], isLoading: false }),
  useSyncChatHistoryCache: () => vi.fn(),
  useClearChatHistory: () => ({ mutate: vi.fn() }),
}));

describe("ProjectDetailDashboard Requirement draft cache", () => {
  it("restores drawer and draft after the project view remounts", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const project = { id: "project-1", name: "TCGA", description: "", created_at: "2026-01-01" };
    const renderDashboard = () => render(
      <QueryClientProvider client={queryClient}>
        <ProjectDetailDashboard project={project} />
      </QueryClientProvider>,
    );

    const first = renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /view requirement/i }));
    fireEvent.click(await screen.findByRole("button", { name: /set draft/i }));
    expect(await screen.findByText(/khi người dùng nhấn đăng nhập/i)).toBeInTheDocument();

    first.unmount();
    renderDashboard();
    expect(await screen.findByText(/khi người dùng nhấn đăng nhập/i)).toBeInTheDocument();
  });
});
