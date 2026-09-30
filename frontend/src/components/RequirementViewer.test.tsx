import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RequirementViewer, {
  createRequirementViewerUiState,
  type GenerateRequirementsResponse,
  type RequirementItem,
  type RequirementViewerUiState,
} from "./RequirementViewer";
import { apiFetch } from "../lib/api";

vi.mock("../hooks/useRequirements", () => ({ useDocumentDetail: () => ({ data: null }) }));
vi.mock("../hooks/useTestCases", () => ({
  useTestCases: () => ({ data: { test_cases: [] }, isPending: false }),
  testCaseKeys: { list: (filters: unknown) => ["test-cases", filters] },
}));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ refreshUser: vi.fn() }) }));
vi.mock("../contexts/JobTrackerContext", () => ({ useJobTracker: () => ({ trackTestCaseJob: vi.fn() }) }));
vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));

const requirement: RequirementItem = {
  id: "requirement-1", title: "Đăng nhập", description: "Luồng đăng nhập",
  functional_requirement: "Người dùng đăng nhập bằng email.", validation_rule: [], permission: [],
  workflow: ["Nhập email", "Nhấn Đăng nhập"], state: [], error_handling: [],
  module_name: "Authentication", feature_name: "Login", actor: "Người dùng",
  goal: "Truy cập hệ thống", trigger: "Nhấn Đăng nhập", business_rules: [], inputs: [], outputs: [],
  preconditions: ["Có tài khoản"], validation_rules: [], exception_flows: [],
  source_reference: "[SOURCE SECTION: Đăng nhập]", components: [], error_messages: [],
  status: "ai_generated", version: 1, clarifying_questions: ["Tài khoản bị khóa xử lý thế nào?"],
  user_answers: null, user_context: null, test_case_status: null, test_case_error: null,
};

function Harness() {
  const [requirements, setRequirements] = useState<GenerateRequirementsResponse>({
    document_id: "document-1", project_id: "project-1", total_requirements: 1,
    requirements: [requirement],
  });
  const [uiState, setUiState] = useState<RequirementViewerUiState>(createRequirementViewerUiState);
  return (
    <RequirementViewer
      requirements={requirements}
      document={{ original_filename: "srs.docx", file_type: "docx", file_size: 100 }}
      onClose={vi.fn()}
      onRequirementsUpdate={setRequirements}
      uiState={uiState}
      onUiStateChange={setUiState}
    />
  );
}

describe("RequirementViewer user-confirmed context", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("saves Unicode and newlines independently from Test Case generation", async () => {
    const mockedApiFetch = vi.mocked(apiFetch);
    mockedApiFetch.mockImplementation(async (_url, init) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({
          ...requirement,
          user_answers: ["Khóa 15 phút"],
          user_context: "Phạm vi mobile\nƯu tiên Unicode ✓",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ requirements: [{ id: requirement.id, test_case_status: null }] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText("Đăng nhập"));
    const context = screen.getByLabelText(/góp ý cho ai/i);
    fireEvent.change(context, { target: { value: "Phạm vi mobile\nƯu tiên Unicode ✓" } });
    const answer = screen.getByPlaceholderText(/nhập câu trả lời/i);
    fireEvent.change(answer, { target: { value: "Khóa 15 phút" } });
    fireEvent.click(screen.getByRole("button", { name: /lưu thông tin xác nhận/i }));

    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/requirements/requirement-1/answers"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          answers: ["Khóa 15 phút"],
          user_context: "Phạm vi mobile\nƯu tiên Unicode ✓",
        }),
      }),
    ));
    await waitFor(() => {
      expect((screen.getByLabelText(/góp ý cho ai/i) as HTMLTextAreaElement).value).toBe(
        "Phạm vi mobile\nƯu tiên Unicode ✓",
      );
    });
  });

  it("saves unsaved context before requesting Test Case generation", async () => {
    const mockedApiFetch = vi.mocked(apiFetch);
    mockedApiFetch.mockImplementation(async (url, init) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({
          ...requirement,
          user_answers: [""],
          user_context: "Chỉ áp dụng cho mobile",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (init?.method === "POST" && String(url).includes("/test-cases/generate")) {
        return new Response(JSON.stringify({ status: "generating" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ requirements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText("Đăng nhập"));
    fireEvent.change(screen.getByLabelText(/góp ý cho ai/i), {
      target: { value: "Chỉ áp dụng cho mobile" },
    });
    fireEvent.click(screen.getByRole("button", { name: /tạo test case/i }));

    await waitFor(() => {
      const writeCalls = mockedApiFetch.mock.calls.filter(([, init]) =>
        init?.method === "PATCH" || init?.method === "POST"
      );
      expect(writeCalls.map(([url]) => String(url))).toEqual([
        expect.stringContaining("/requirements/requirement-1/answers"),
        expect.stringContaining("/requirements/requirement-1/test-cases/generate"),
      ]);
    });
  });

  it("shows a clear validation state when context exceeds 4,000 characters", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText("Đăng nhập"));
    const context = screen.getByLabelText(/góp ý cho ai/i);
    fireEvent.change(context, { target: { value: "x".repeat(4001) } });

    expect(context).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("4001/4000 ký tự")).toHaveClass("is-error");
    expect(screen.getByRole("button", { name: /lưu thông tin xác nhận/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /tạo test case/i })).toBeDisabled();
  });
});
