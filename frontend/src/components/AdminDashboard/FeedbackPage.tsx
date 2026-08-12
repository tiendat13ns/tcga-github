import { useMemo, useState } from "react";
import { CheckCircle2, MessageCircleMore, RefreshCw, Sparkles } from "lucide-react";
import { useAdminFeedback } from "../../hooks/useAdmin";
import FeedbackList from "./FeedbackList";

export default function FeedbackPage() {
  const { data: feedback = [], isLoading, isError, error, refetch } = useAdminFeedback();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const newFeedbackCount = useMemo(() => feedback.filter((f) => f.status === "new").length, [feedback]);

  if (isLoading) {
    return (
      <div className="tcs-view" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", color: "var(--text-muted)" }}>
          <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải phản hồi...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="tcs-view" style={{ padding: "32px" }}>
        <div style={{ padding: "24px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--danger)" }}>
          <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "6px" }}>Không thể tải danh sách phản hồi</div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>{(error as Error)?.message || "Đã xảy ra lỗi."}</p>
          <div style={{ marginTop: "16px" }}>
            <button className="btn btn-secondary" onClick={() => refetch()}>
              <RefreshCw size={14} strokeWidth={1.75} /> Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tcs-view" style={{ height: "100%", overflowY: "auto", position: "relative" }}>
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

      {/* Header Banner — cùng chuẩn kích thước/icon với các view khác (44px icon box) */}
      <div className="tcs-view-header">
        <div className="tcs-view-title-row">
          <div className="tcs-title">
            <div className="tcs-title-icon">
              <MessageCircleMore size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
                Phản hồi từ người dùng
                {newFeedbackCount > 0 && (
                  <span className="badge badge-processing" style={{ fontSize: "11px" }}>{newFeedbackCount} mới</span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                Toàn bộ báo lỗi & đề xuất người dùng gửi từ trong app
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => refetch()} title="Làm mới dữ liệu">
            <RefreshCw size={14} strokeWidth={2} /> Làm mới
          </button>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px 32px" }}>
        <FeedbackList feedback={feedback} onShowToast={showToast} />
      </div>
    </div>
  );
}
