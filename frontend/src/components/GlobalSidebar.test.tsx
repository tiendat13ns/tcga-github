import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GlobalSidebar from "./GlobalSidebar";

vi.mock("../hooks/useUsage", () => ({
  useUsageSummary: () => ({ data: null, isLoading: false }),
  getCurrentPlanQuota: () => null,
}));
vi.mock("./FeedbackModal", () => ({ default: () => null }));
vi.mock("./Notifications/NotificationBell", () => ({ default: () => null }));

describe("GlobalSidebar toggle tooltip", () => {
  it("closes immediately on click and Escape", () => {
    const onToggleSidebar = vi.fn();
    render(
      <GlobalSidebar
        activeView="overview"
        isSidebarOpen={false}
        onNavigate={vi.fn()}
        onToggleSidebar={onToggleSidebar}
        user={{ email: "qa@example.com", role: "user", credit_balance: 100 }}
        onLogout={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: /open sidebar/i });
    fireEvent.mouseEnter(toggle);
    expect(screen.getByText("Open sidebar")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Open sidebar")).not.toBeInTheDocument();

    fireEvent.mouseEnter(toggle);
    fireEvent.blur(window);
    expect(screen.queryByText("Open sidebar")).not.toBeInTheDocument();

    fireEvent.mouseEnter(toggle);
    fireEvent.click(toggle);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Open sidebar")).not.toBeInTheDocument();
  });
});
