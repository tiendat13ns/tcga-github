import { useState } from "react";
import { Settings, UserRound, CreditCard, Mail, ShieldCheck, CalendarDays, Fingerprint, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useUsageSummary } from "../hooks/useUsage";
import { CreditRing, PlanCard } from "./UsageBilling";

type SettingsTab = "account" | "subscriptions";

type SettingsPageProps = {
  onNavigateToUsage: () => void;
};

function formatJoinDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0", borderBottom: "1px solid var(--border-soft)" }}>
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "8px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-soft)",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{label}</div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function AccountInfoTab() {
  const { user, isAdmin } = useAuth();
  if (!user) return null;

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <div
          className="sidebar-user-avatar"
          style={{
            width: "56px",
            height: "56px",
            fontSize: "20px",
            background: isAdmin ? "var(--accent)" : undefined,
            color: isAdmin ? "#fff" : undefined,
          }}
        >
          {user.email.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>{user.email.split("@")[0]}</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{user.email}</div>
        </div>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "8px 20px" }}>
        <InfoRow icon={<Mail size={15} strokeWidth={1.75} />} label="Email" value={user.email} />
        <InfoRow
          icon={<ShieldCheck size={15} strokeWidth={1.75} />}
          label="Vai trò"
          value={isAdmin ? "Quản trị viên" : "Người dùng"}
        />
        <InfoRow icon={<CalendarDays size={15} strokeWidth={1.75} />} label="Ngày tham gia" value={formatJoinDate(user.created_at)} />
        <div style={{ padding: "14px 0" }}>
          <InfoRow icon={<Fingerprint size={15} strokeWidth={1.75} />} label="User ID" value={user.id} />
        </div>
      </div>

      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "16px", lineHeight: 1.6 }}>
        Tài khoản được xác thực qua Supabase. Để đổi mật khẩu hoặc cập nhật thông tin đăng nhập, vui lòng liên hệ{" "}
        <a href="mailto:dat96133@gmail.com" style={{ color: "var(--accent)" }}>dat96133@gmail.com</a>.
      </p>
    </div>
  );
}

function SubscriptionsTab({ onNavigateToUsage }: { onNavigateToUsage: () => void }) {
  const { data: summary, isLoading } = useUsageSummary();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "60px 0", color: "var(--text-muted)" }}>
        <Sparkles className="animate-spin" size={20} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: "13px" }}>Đang tải thông tin gói dịch vụ...</span>
      </div>
    );
  }

  const balance = summary?.credit_balance ?? 0;
  const used = summary?.total_credits_used ?? 0;
  const plans = summary?.plans ?? [];
  const currentPlanName = summary?.current_plan ?? "Free Plan";

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto" }}>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          marginBottom: "24px",
        }}
      >
        <CreditRing balance={balance} used={used} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Gói hiện tại</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{currentPlanName}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
            Còn <strong style={{ color: "var(--accent)" }}>{balance.toLocaleString()}</strong> / đã dùng{" "}
            <strong style={{ color: "var(--danger)" }}>{used.toLocaleString()}</strong> Credits
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onNavigateToUsage}>
          Xem lịch sử sử dụng
        </button>
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "stretch" }}>
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} isCurrent={plan.name === currentPlanName} />
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage({ onNavigateToUsage }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  const TABS: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: "account", label: "Thông tin tài khoản", icon: <UserRound size={15} strokeWidth={1.75} /> },
    { key: "subscriptions", label: "Gói dịch vụ", icon: <CreditCard size={15} strokeWidth={1.75} /> },
  ];

  return (
    <div className="tcs-view">
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
              <Settings size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>Settings</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "28px", borderBottom: "1px solid var(--border)" }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "10px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === tab.key ? "var(--accent)" : "transparent"}`,
                  color: activeTab === tab.key ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer",
                  marginBottom: "-1px",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "account" ? <AccountInfoTab /> : <SubscriptionsTab onNavigateToUsage={onNavigateToUsage} />}
        </div>
      </div>
    </div>
  );
}
