import { useState } from "react";
import { Bug, CheckCircle2, Lightbulb, MessageCircleMore } from "lucide-react";
import ModalDialog from "./ModalDialog";
import { useSubmitFeedback, type FeedbackType } from "../hooks/useFeedback";

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const TYPES: { key: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { key: "bug", label: "Báo lỗi", icon: <Bug size={14} strokeWidth={1.75} /> },
  { key: "feature_request", label: "Đề xuất tính năng", icon: <Lightbulb size={14} strokeWidth={1.75} /> },
  { key: "other", label: "Khác", icon: <MessageCircleMore size={14} strokeWidth={1.75} /> },
];

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const submitFeedback = useSubmitFeedback();

  const handleClose = () => {
    submitFeedback.reset();
    setType("bug");
    setMessage("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    submitFeedback.mutate(
      { type, message: message.trim() },
      { onSuccess: () => setMessage("") }
    );
  };

  return (
    <ModalDialog isOpen={isOpen} onClose={handleClose} title="Feedback" width="440px">
      {submitFeedback.isSuccess ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "16px 0" }}>
          <CheckCircle2 size={32} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Đã gửi phản hồi!</div>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
            Cảm ơn bạn — team sẽ xem xét sớm nhất có thể.
          </p>
          <button type="button" className="btn btn-secondary" onClick={handleClose} style={{ marginTop: "4px" }}>
            Đóng
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "4px" }}>
          {submitFeedback.isError && (
            <div className="error-message" style={{ color: "var(--danger)", fontSize: "13px", padding: "8px 10px", backgroundColor: "rgba(220, 38, 38, 0.1)", borderRadius: "6px" }}>
              {(submitFeedback.error as Error)?.message || "Không thể gửi phản hồi."}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Loại phản hồi</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    borderRadius: "999px",
                    border: `1px solid ${type === t.key ? "var(--accent)" : "var(--border)"}`,
                    background: type === t.key ? "var(--accent-glow)" : "var(--bg-elevated)",
                    color: type === t.key ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all var(--transition)",
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Nội dung</label>
            <textarea
              autoFocus
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mô tả lỗi bạn gặp phải, hoặc tính năng bạn mong muốn..."
              rows={5}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "13px",
                lineHeight: 1.6,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={!message.trim() || submitFeedback.isPending}>
              {submitFeedback.isPending ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
