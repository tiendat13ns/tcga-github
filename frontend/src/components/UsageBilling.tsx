import { useUsageSummary, useUsageLogs, UsagePlan } from "../hooks/useUsage";
import {
  Sparkles,
  CreditCard,
  Zap,
  FileText,
  FolderGit2,
  HardDrive,
  ListChecks,
  CheckSquare,
  MessageSquare,
  Settings,
} from "lucide-react";

/* ── Helpers ─────────────────────────────────────────────── */
type OperationMeta = {
  label: string;
  IconComponent: React.ElementType;
};

const OPERATION_LABELS: Record<string, OperationMeta> = {
  DOCUMENT_INGESTION: {
    label: "Upload Tài liệu",
    IconComponent: FileText,
  },
  REQUIREMENT_EXTRACTION: {
    label: "Trích xuất Requirement",
    IconComponent: ListChecks,
  },
  TEST_CASE_GENERATION: {
    label: "Sinh Test Case",
    IconComponent: CheckSquare,
  },
  COPILOT_CHAT: {
    label: "AI Chat / Phân tích tài liệu",
    IconComponent: MessageSquare,
  },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " VNĐ";
}

/* ── Credit Ring ─────────────────────────────────────────── */
export function CreditRing({ balance, used }: { balance: number; used: number }) {
  const total = balance + used || 1;
  const pct = Math.min((balance / total) * 100, 100);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)">
        {balance.toLocaleString()}
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="9" fill="var(--text-muted)">
        Credits
      </text>
    </svg>
  );
}

/* ── Plan Card ───────────────────────────────────────────── */
export function PlanCard({ plan, isCurrent }: { plan: UsagePlan; isCurrent: boolean }) {
  // Nếu là gói hiện tại của user thì ưu tiên nhãn ACTIVE — không hiện "coming soon" nữa
  // (admin có thể đã gán trực tiếp gói Lite/Pro dù chúng chưa mở mua tự phục vụ).
  const isComingSoon = plan.status === "coming_soon" && !isCurrent;

  return (
    <div
      style={{
        background: isCurrent ? "var(--accent-glow)" : "var(--bg-surface)",
        border: `1.5px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "12px",
        padding: "20px",
        flex: 1,
        minWidth: "160px",
        position: "relative",
        opacity: isComingSoon ? 0.75 : 1,
      }}
    >
      {isCurrent && (
        <span
          style={{
            position: "absolute",
            top: "-10px",
            left: "16px",
            background: "var(--accent)",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: "20px",
            letterSpacing: "0.05em",
          }}
        >
          ACTIVE
        </span>
      )}
      {isComingSoon && (
        <span
          style={{
            position: "absolute",
            top: "-10px",
            left: "16px",
            background: "var(--border)",
            color: "var(--text-muted)",
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: "20px",
            letterSpacing: "0.05em",
          }}
        >
          COMING SOON
        </span>
      )}

      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
        {plan.name}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 800, color: isCurrent ? "var(--accent)" : "var(--text-primary)", marginBottom: "14px" }}>
        {plan.price_vnd === 0 ? "Miễn phí" : fmtPrice(plan.price_vnd) + " / tháng"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Zap size={13} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
          <span>{plan.credits_per_month.toLocaleString()} Credits / tháng</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <FileText size={13} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
          <span>{plan.max_documents ?? "Không giới hạn"} tài liệu</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <FolderGit2 size={13} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
          <span>{plan.max_projects ?? "Không giới hạn"} projects</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <HardDrive size={13} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
          <span>{plan.storage_mb >= 1024 ? `${plan.storage_mb / 1024}GB` : `${plan.storage_mb}MB`} Storage</span>
        </div>
      </div>

      {isComingSoon && (
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-soft)" }}>
          <a
            href="mailto:dat96133@gmail.com"
            style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}
          >
            Liên hệ admin để nâng cấp gói
          </a>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export default function UsageBilling() {
  const { data: summary, isLoading: loading } = useUsageSummary();
  const { data: logsData, isLoading: logsLoading } = useUsageLogs();
  const logs = logsData?.items ?? [];
  const totalLogs = logsData?.total ?? 0;

  if (loading) {
    return (
      <div className="tcs-view" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", color: "var(--text-muted)" }}>
          <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải dữ liệu Usage & Billing...</span>
        </div>
      </div>
    );
  }

  const balance = summary?.credit_balance ?? 0;
  const used = summary?.total_credits_used ?? 0;
  const plans = summary?.plans ?? [];
  const currentPlanName = summary?.current_plan ?? "Free Plan";

  return (
    <div className="tcs-view">
      {/* Header Banner (Unified styling matching Overview & Admin) */}
      <div className="tcs-view-header">
        <div className="tcs-view-title-row">
          <div className="tcs-title" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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
              <CreditCard size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>Usage &amp; Billing</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          {/* ── Credit + Plans ── */}
          <div style={{ display: "flex", gap: "24px", marginBottom: "32px", flexWrap: "wrap" }}>
            {/* Credit card */}
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                padding: "24px",
                display: "flex",
                alignItems: "center",
                gap: "24px",
                flex: "0 0 auto",
                minWidth: "220px",
              }}
            >
              <CreditRing balance={balance} used={used} />
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Số dư Credit</div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                  {balance.toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                  Đã dùng tổng: <strong style={{ color: "var(--danger)" }}>{used.toLocaleString()}</strong> Credits
                </div>
              </div>
            </div>

            {/* Plan cards */}
            <div style={{ display: "flex", gap: "12px", flex: 1, flexWrap: "wrap", alignItems: "stretch" }}>
              {plans.map((plan) => (
                <PlanCard key={plan.name} plan={plan} isCurrent={plan.name === currentPlanName} />
              ))}
            </div>
          </div>

          {/* ── Recent Logs ── */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Lịch sử sử dụng
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{totalLogs} giao dịch</span>
            </div>

            {logsLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "32px 0", color: "var(--text-muted)" }}>
                <Sparkles className="animate-spin" size={20} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: "13px" }}>Đang tải lịch sử...</span>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>
                Chưa có giao dịch nào. Hãy bắt đầu sử dụng tính năng AI để ghi nhận lịch sử!
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["OPERATION", "TÀI LIỆU / PROJECT", "CREDITS DÙNG", "THỜI GIAN"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            fontSize: "11px",
                            letterSpacing: "0.06em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const meta = OPERATION_LABELS[log.operation] ?? {
                        label: log.operation,
                        IconComponent: Settings,
                      };
                      const { IconComponent } = meta;

                      return (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                          <td style={{ padding: "12px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  background: "var(--bg-elevated)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text-primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <IconComponent size={14} strokeWidth={1.75} />
                              </div>
                              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{meta.label}</span>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: "12px 12px",
                              color: "var(--text-secondary)",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {log.target_name ?? "—"}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <span
                              style={{
                                background: "var(--danger-dim)",
                                color: "var(--danger)",
                                fontWeight: 700,
                                padding: "3px 10px",
                                borderRadius: "20px",
                                fontSize: "12px",
                              }}
                            >
                              -{log.credits_used}
                            </span>
                          </td>
                          <td style={{ padding: "12px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {formatDate(log.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
