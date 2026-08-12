import { useMemo, useState } from "react";
import { CheckCircle2, Download, RefreshCw, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { useAdminStats, useAdminUsers, useUpdateUserCredits, useUpdateUserPlan } from "../../hooks/useAdmin";
import KpiCards from "./KpiCards";
import UserTable from "./UserTable";
import UserTableToolbar, { RoleFilter, SortOption } from "./UserTableToolbar";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrObj, refetch: refetchStats } = useAdminStats();
  const { data: users = [], isLoading: usersLoading, isError: usersError, error: usersErrObj, refetch: refetchUsers } = useAdminUsers();
  const updateCreditsMutation = useUpdateUserCredits();
  const updatePlanMutation = useUpdateUserPlan();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("created_desc");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRefresh = () => {
    refetchStats();
    refetchUsers();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportCSV = () => {
    if (!users.length) return;
    const headers = ["ID", "Email", "Role", "Plan", "Credit Balance", "Projects", "Requirements", "Test Cases", "Created At"];
    const rows = users.map((u) => {
      const userPlan = u.plan || (u.role === "admin" || u.credit_balance >= 1500 ? "Pro Plan" : u.credit_balance >= 600 ? "Lite Plan" : "Free Plan");
      return [
        u.id,
        u.email,
        u.role,
        userPlan,
        u.credit_balance,
        u.projects_count,
        u.requirements_count,
        u.test_cases_count,
        u.created_at || "",
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tcga_admin_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and sort users
  const processedUsers = useMemo(() => {
    let result = users.filter((u) => {
      const matchSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === "all" ? true : u.role === roleFilter;
      return matchSearch && matchRole;
    });

    result.sort((a, b) => {
      if (sortBy === "credit_desc") return b.credit_balance - a.credit_balance;
      if (sortBy === "projects_desc") return b.projects_count - a.projects_count;
      if (sortBy === "test_cases_desc") return b.test_cases_count - a.test_cases_count;
      // Default: created_desc
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [users, searchQuery, roleFilter, sortBy]);

  const adminUsersCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);
  const regularUsersCount = useMemo(() => users.filter((u) => u.role !== "admin").length, [users]);

  const isLoading = statsLoading || usersLoading;
  const isError = statsError || usersError;
  const errorMessage = (statsErrObj as Error)?.message || (usersErrObj as Error)?.message || "Đã xảy ra lỗi khi tải dữ liệu Admin.";

  if (isLoading) {
    return (
      <div className="tcs-view" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", color: "var(--text-muted)" }}>
          <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang kết nối Admin Control Center...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="tcs-view" style={{ padding: "32px" }}>
        <div style={{ padding: "24px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--danger)" }}>
          <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "6px" }}>Không thể tải dữ liệu Admin Dashboard</div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>{errorMessage}</p>
          <div style={{ marginTop: "16px" }}>
            <button className="btn btn-secondary" onClick={handleRefresh}>
              <RefreshCw size={14} strokeWidth={1.75} /> Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tcs-view" style={{ height: "100%", overflowY: "auto", position: "relative" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--accent)",
            boxShadow: "var(--shadow-elevated)",
            borderRadius: "8px",
            padding: "12px 18px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div
        className="tcs-view-header"
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="tcs-view-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div className="tcs-title" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Unified Line Icon matching Menu Sidebar */}
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "8px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
                Admin Control Center
                <span className="badge" style={{ fontSize: "11px", letterSpacing: "0.5px", padding: "3px 8px", background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-soft)" }}>
                  ADMIN HQ
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button className="btn btn-secondary" onClick={handleExportCSV} title="Xuất báo cáo CSV">
              <Download size={14} strokeWidth={1.75} /> Xuất Báo cáo CSV
            </button>
            <button className="btn btn-primary" onClick={handleRefresh} title="Làm mới dữ liệu">
              <RefreshCw size={14} strokeWidth={2} /> Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "28px" }}>
        {/* Metric KPI Cards */}
        {stats && (
          <KpiCards stats={stats} adminUsersCount={adminUsersCount} regularUsersCount={regularUsersCount} />
        )}

        {/* User Management Section */}
        <div className="card" style={{ padding: "24px", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Controls Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                <UserCheck size={18} strokeWidth={1.75} style={{ color: "var(--text-primary)" }} />
                Danh sách Người dùng & Quyền hạn
              </h3>
            </div>

            <UserTableToolbar
              totalUsers={users.length}
              adminUsersCount={adminUsersCount}
              regularUsersCount={regularUsersCount}
              roleFilter={roleFilter}
              onRoleFilterChange={setRoleFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          </div>

          <UserTable users={processedUsers} updateCreditsMutation={updateCreditsMutation} updatePlanMutation={updatePlanMutation} onShowToast={showToast} />
        </div>
      </div>
    </div>
  );
}
