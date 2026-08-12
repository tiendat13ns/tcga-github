import { useState } from "react";
import { Edit3, Save, Search, ShieldCheck, Users, X, Zap } from "lucide-react";
import { AdminUser, PlanKey, useUpdateUserCredits, useUpdateUserPlan } from "../../hooks/useAdmin";

type UserTableProps = {
  users: AdminUser[];
  updateCreditsMutation: ReturnType<typeof useUpdateUserCredits>;
  updatePlanMutation: ReturnType<typeof useUpdateUserPlan>;
  onShowToast: (msg: string) => void;
};

const PLAN_OPTIONS: { key: PlanKey; label: string; planName: string }[] = [
  { key: "free", label: "Free", planName: "Free Plan" },
  { key: "lite", label: "Lite", planName: "Lite Plan" },
  { key: "pro", label: "Pro", planName: "Pro Plan" },
];

export default function UserTable({ users, updateCreditsMutation, updatePlanMutation, onShowToast }: UserTableProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCreditValue, setEditCreditValue] = useState<number>(0);

  const handleStartEdit = (user: AdminUser) => {
    setEditingUserId(user.id);
    setEditCreditValue(user.credit_balance);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
  };

  const handleSaveCredit = async (userId: string, targetEmail: string) => {
    try {
      await updateCreditsMutation.mutateAsync({ userId, credit_balance: editCreditValue });
      setEditingUserId(null);
      onShowToast(`Đã cập nhật credit cho ${targetEmail} thành ${editCreditValue}`);
    } catch (err: any) {
      alert(err.message || "Cập nhật credit thất bại");
    }
  };

  // Đổi gói của user (độc lập với credit_balance) — plan quyết định quota upload/project.
  const handleChangePlan = async (user: AdminUser, planKey: PlanKey, planLabel: string) => {
    try {
      await updatePlanMutation.mutateAsync({ userId: user.id, plan: planKey });
      onShowToast(`Đã chuyển ${user.email} sang gói ${planLabel}`);
    } catch (err: any) {
      alert(err.message || "Đổi gói thất bại");
    }
  };

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Người dùng</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Vai trò</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Gói Plan</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Số dư Credit</th>
            <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "center" }}>Projects</th>
            <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "center" }}>Requirements</th>
            <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "center" }}>Test Cases</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Ngày khởi tạo</th>
            <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Thao tác Admin</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: "36px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ display: "inline-flex", padding: "10px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", marginBottom: "8px", color: "var(--text-muted)" }}>
                  <Search size={24} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: "14px", fontWeight: 500 }}>Không tìm thấy người dùng nào phù hợp với bộ lọc.</div>
              </td>
            </tr>
          ) : (
            users.map((u) => {
              const isAdmin = u.role === "admin";
              const userPlan = u.plan || (isAdmin || u.credit_balance >= 1500 ? "Pro Plan" : u.credit_balance >= 600 ? "Lite Plan" : "Free Plan");
              const isEditing = editingUserId === u.id;
              const isUpdatingThisUser = updateCreditsMutation.isPending && updateCreditsMutation.variables?.userId === u.id;

              return (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: "1px solid var(--border-soft)",
                    transition: "background var(--transition)",
                  }}
                  className="table-row-hover"
                >
                  {/* User Email & Avatar */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "50%",
                          background: isAdmin
                            ? "var(--accent)"
                            : "var(--bg-elevated)",
                          color: isAdmin ? "#fff" : "var(--text-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "13px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.email}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {u.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role Badge */}
                  <td style={{ padding: "12px 16px" }}>
                    {isAdmin ? (
                      <span className="badge" style={{ fontSize: "11px", fontWeight: 600, background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-soft)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={12} strokeWidth={1.75} /> ADMIN
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: "11px", fontWeight: 500, background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-soft)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Users size={12} strokeWidth={1.75} /> USER
                      </span>
                    )}
                  </td>

                  {/* Plan Badge + đổi gói (plan độc lập với credit) */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
                      {userPlan === "Pro Plan" ? (
                        <span className="badge" style={{ fontSize: "11px", fontWeight: 600, background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-soft)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Zap size={12} strokeWidth={1.75} /> Pro Plan
                        </span>
                      ) : userPlan === "Lite Plan" ? (
                        <span className="badge" style={{ fontSize: "11px", fontWeight: 600, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-soft)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Zap size={12} strokeWidth={1.75} /> Lite Plan
                        </span>
                      ) : (
                        <span className="badge" style={{ fontSize: "11px", fontWeight: 500, background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border-soft)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          Free Plan
                        </span>
                      )}

                      {!isAdmin && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          {PLAN_OPTIONS.map(({ key, label, planName }) => {
                            const isCurrent = userPlan === planName;
                            const isUpdatingThis = updatePlanMutation.isPending && updatePlanMutation.variables?.userId === u.id && updatePlanMutation.variables?.plan === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={isCurrent || isUpdatingThis}
                                style={{
                                  height: "22px",
                                  padding: "0 9px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  borderRadius: "4px",
                                  background: isCurrent ? "var(--accent)" : "var(--bg-elevated)",
                                  color: isCurrent ? "#fff" : "var(--text-secondary)",
                                  border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border-soft)"}`,
                                  cursor: isCurrent ? "default" : "pointer",
                                  transition: "all var(--transition)",
                                  whiteSpace: "nowrap",
                                }}
                                onClick={() => handleChangePlan(u, key, label)}
                                title={isCurrent ? `User đang ở gói ${label}` : `Đổi sang gói ${label}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Credit Balance */}
                  <td style={{ padding: "12px 16px" }}>
                    {isEditing ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          height: "32px",
                          padding: "0 10px",
                          width: "120px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--accent)",
                          borderRadius: "var(--radius-input)",
                          boxShadow: "0 0 0 3px var(--accent-glow)",
                        }}
                      >
                        <Zap size={14} strokeWidth={1.75} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <input
                          type="number"
                          value={editCreditValue}
                          onChange={(e) => setEditCreditValue(parseInt(e.target.value) || 0)}
                          style={{
                            width: "100%",
                            minWidth: 0,
                            height: "100%",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: "var(--text-primary)",
                            fontSize: "13px",
                            fontWeight: 700,
                            padding: 0,
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
                        <Zap size={14} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
                        <span style={{ fontSize: "14px", color: u.credit_balance < 20 ? "var(--danger)" : "var(--text-primary)" }}>
                          {u.credit_balance.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Projects */}
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "var(--bg-surface)", border: "1px solid var(--border-soft)" }}>
                      {u.projects_count}
                    </span>
                  </td>

                  {/* Requirements */}
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "var(--bg-surface)", border: "1px solid var(--border-soft)" }}>
                      {u.requirements_count}
                    </span>
                  </td>

                  {/* Test Cases */}
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "var(--bg-surface)", border: "1px solid var(--border-soft)" }}>
                      {u.test_cases_count}
                    </span>
                  </td>

                  {/* Registration Date */}
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
                    {u.created_at ? new Date(u.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                        <button
                          className="btn btn-primary"
                          style={{ height: "30px", padding: "0 10px", fontSize: "12px" }}
                          onClick={() => handleSaveCredit(u.id, u.email)}
                          disabled={isUpdatingThisUser}
                        >
                          <Save size={12} strokeWidth={1.75} /> {isUpdatingThisUser ? "Đang lưu..." : "Lưu"}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ height: "30px", padding: "0 8px", fontSize: "12px" }}
                          onClick={handleCancelEdit}
                          disabled={isUpdatingThisUser}
                        >
                          <X size={12} strokeWidth={1.75} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        style={{ height: "30px", padding: "0 10px", fontSize: "12px" }}
                        onClick={() => handleStartEdit(u)}
                        title="Sửa số dư Credit"
                      >
                        <Edit3 size={12} strokeWidth={1.75} /> Sửa Credit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
