import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, FileText, FlaskConical, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { useNotifications, type AppNotification } from "../../contexts/NotificationContext";

/** Chuông thông báo ở footer sidebar + dropdown lịch sử job đã sinh xong/thất bại.
 * Dropdown render qua portal, neo theo nút chuông để không bị cắt bởi overflow của sidebar. */

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(ts).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function NotificationRow({ n }: { n: AppNotification }) {
  const KindIcon = n.kind === "requirement" ? FileText : FlaskConical;
  const kindLabel = n.kind === "requirement" ? "Requirement" : "Test Case";
  const ok = n.status === "success";
  return (
    <div className={`notif-row${n.read ? "" : " is-unread"}`}>
      <span className={`notif-row-status ${ok ? "is-success" : "is-error"}`}>
        {ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      </span>
      <div className="notif-row-body">
        <div className="notif-row-title">
          <KindIcon size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
          <span>{ok ? `Đã tạo xong ${kindLabel}` : `Sinh ${kindLabel} thất bại`}</span>
        </div>
        <div className="notif-row-label" title={n.label}>{n.label}</div>
        <div className="notif-row-time">{formatRelativeTime(n.createdAt)}</div>
      </div>
    </div>
  );
}

export default function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  const openPanel = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // Neo panel phía TRÊN nút chuông (footer nằm sát đáy màn hình).
      setPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    }
    setOpen(true);
    markAllRead();
  };

  // Đóng khi bấm ra ngoài / nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Giữ panel bám đúng vị trí nếu cửa sổ đổi kích thước khi đang mở.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    };
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="notif-bell-btn icon-btn-ghost"
        onClick={() => (open ? setOpen(false) : openPanel())}
        title="Thông báo"
        aria-label="Thông báo"
        style={{ position: "relative", padding: "6px", flexShrink: 0 }}
      >
        <Bell size={collapsed ? 18 : 16} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="notif-panel"
          style={{ position: "fixed", bottom: pos.bottom, left: pos.left }}
          role="dialog"
          aria-label="Danh sách thông báo"
        >
          <div className="notif-panel-header">
            <span className="notif-panel-title">Thông báo</span>
            {notifications.length > 0 && (
              <button type="button" className="notif-clear-btn" onClick={clearAll} title="Xoá tất cả">
                <Trash2 size={13} /> Xoá tất cả
              </button>
            )}
          </div>
          <div className="notif-panel-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={22} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                <span>Chưa có thông báo nào</span>
                <span className="notif-empty-sub">Kết quả sinh Requirement / Test Case sẽ hiện ở đây.</span>
              </div>
            ) : (
              notifications.map((n) => <NotificationRow key={n.id} n={n} />)
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
