import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatWorkspace from "./ChatWorkspace";

const refreshUser = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ token: null, refreshUser }),
}));

describe("ChatWorkspace greeting", () => {
  beforeEach(() => refreshUser.mockClear());

  it("updates the UI-only greeting when document selection changes", () => {
    const { rerender } = render(
      <ChatWorkspace projectId="project-1" selectedDocumentIds={[]} initialMessages={[]} />,
    );

    expect(screen.getByText(/chọn ít nhất một tài liệu/i)).toBeInTheDocument();
    expect(screen.queryByText(/bạn đã chọn tài liệu/i)).not.toBeInTheDocument();

    rerender(
      <ChatWorkspace projectId="project-1" selectedDocumentIds={["document-1"]} initialMessages={[]} />,
    );

    expect(screen.getByText(/bạn đã chọn tài liệu/i)).toBeInTheDocument();
    expect(screen.queryByText(/chọn ít nhất một tài liệu/i)).not.toBeInTheDocument();
  });
});
