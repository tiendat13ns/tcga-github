import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

/**
 * Trung tâm thông báo — lưu lịch sử các job nền đã hoàn tất (sinh Requirement / Test Case,
 * xong hoặc thất bại) do JobTrackerContext phát hiện. Lưu localStorage THEO user_id nên còn
 * lại sau F5 và KHÔNG rò rỉ giữa các tài khoản (mỗi user một key riêng; đổi tài khoản là nạp
 * đúng danh sách của user đó). Chuông + dropdown ở footer sidebar đọc từ đây.
 */

export type NotificationKind = "requirement" | "testcase";
export type NotificationStatus = "success" | "error";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  status: NotificationStatus;
  label: string;
  createdAt: number; // epoch ms
  read: boolean;
};

type NotificationContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: { kind: NotificationKind; status: NotificationStatus; label: string }) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const MAX_ITEMS = 50;
const storageKey = (userId: string) => `tcga_notif_${userId}`;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // userIdRef để persist() luôn ghi vào key của ĐÚNG user hiện tại (đọc trong functional
  // updater, tránh ghi nhầm dữ liệu user A sang key user B do closure/timing cũ).
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const persist = (list: AppNotification[]) => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(list));
    } catch { /* localStorage đầy / bị chặn → bỏ qua, vẫn giữ trong bộ nhớ phiên */ }
  };

  // Đổi tài khoản (login/logout/switch): nạp lại danh sách của user mới từ localStorage
  // (rỗng nếu chưa có / đã logout). KHÔNG xoá localStorage khi logout để lần sau đăng nhập
  // lại vẫn còn.
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(userId));
      setNotifications(raw ? (JSON.parse(raw) as AppNotification[]) : []);
    } catch {
      setNotifications([]);
    }
  }, [userId]);

  const addNotification = useCallback((n: { kind: NotificationKind; status: NotificationStatus; label: string }) => {
    setNotifications((prev) => {
      const item: AppNotification = {
        ...n,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        read: false,
      };
      const next = [item, ...prev].slice(0, MAX_ITEMS);
      persist(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      if (!prev.some((n) => !n.read)) return prev;
      const next = prev.map((n) => (n.read ? n : { ...n, read: true }));
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications(() => {
      persist([]);
      return [];
    });
  }, []);

  const unreadCount = notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
