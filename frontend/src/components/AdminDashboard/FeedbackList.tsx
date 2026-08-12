import { useState } from "react";
import { Bug, CheckCircle2, Inbox, Lightbulb, MessageCircleMore } from "lucide-react";
import { AdminFeedback, useUpdateFeedbackStatus } from "../../hooks/useAdmin";

type FeedbackListProps = {
  feedback: AdminFeedback[];
  onShowToast: (msg: string) => void;
};

const TYPE_META: Record<AdminFeedback["type"], { label: string; icon: React.ElementType }> = {
  bug: { label: "Báo lỗi", icon: Bug },
  feature_request: { label: "Đề xuất tính năng", icon: Lightbulb },
  other: { label: "Khác", icon: MessageCircleMore },
};

export default function FeedbackList({ feedback, onShowToast }: FeedbackListProps) {
  const updateStatus = useUpdateFeedbackStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleMarkReviewed = async (item: AdminFeedback) => {
    try {
      await updateStatus.mutateAsync({ feedbackId: item.id, status: "reviewed" });
      onShowToast(`Đã đánh dấu đã xem phản hồi từ ${item.user_email}`);
    } catch (err: any) {
      alert(err.message || "Cập nhật trạng thái thất bại");
    }
  };

  if (feedback.length === 0) {
    return (
      <div style={{ padding: "36px", textAlign: "center", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "8px" }}>
        <div style={{ display: "inline-flex", padding: "10px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", marginBottom: "8px", color: "var(--text-muted)" }}>
          <Inbox size={24} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: "14px", fontWeight: 500 }}>Chưa có phản hồi nào từ người dùng.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Người gửi</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Loại</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Nội dung</th>
            <th style={{ padding: "12px 16px", fontWeight: 600 }}>Thời gian</th>
            <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {feedback.map((item) => {
            const meta = TYPE_META[item.type] ?? TYPE_META.other;
            const Icon = meta.icon;
            const isExpanded = expandedId === item.id;
            const isUpdatingThis = updateStatus.isPending && updateStatus.variables?.feedbackId === item.id;

            return (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--border-soft)" }} className="table-row-hover">
                <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {item.user_email}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span className="badge" style={{ fontSize: "11px", fontWeight: 600, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-soft)", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                    <Icon size={12} strokeWidth={1.75} /> {meta.label}
                  </span>
                </td>
                <td
                  style={{ padding: "12px 16px", color: "var(--text-secondary)", maxWidth: "420px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  title={isExpanded ? "Bấm để thu gọn" : "Bấm để xem đầy đủ"}
                >
                  <div style={isExpanded ? undefined : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.message}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
                  {item.created_at ? new Date(item.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  {item.status === "reviewed" ? (
                    <span className="badge badge-completed" style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={12} strokeWidth={1.75} /> Đã xem
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      style={{ height: "28px", padding: "0 10px", fontSize: "12px" }}
                      onClick={() => handleMarkReviewed(item)}
                      disabled={isUpdatingThis}
                    >
                      {isUpdatingThis ? "Đang lưu..." : "Đánh dấu đã xem"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
