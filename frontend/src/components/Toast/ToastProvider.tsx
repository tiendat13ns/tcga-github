import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Toast toàn cục — render ở tầng app root nên tồn tại xuyên suốt điều hướng: dùng để báo
 * khi một job chạy nền (sinh Requirement / Test Case) hoàn tất, kể cả khi người dùng đã rời
 * khỏi trang vừa bấm. Xem JobTrackerContext (nơi phát hiện job xong rồi gọi showToast).
 */

export type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextType = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 6000;

const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const AlertIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const InfoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") return <CheckIcon />;
  if (variant === "error") return <AlertIcon />;
  return <InfoIcon />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item is-${t.variant}`} onClick={() => dismiss(t.id)}>
            <span className="toast-item-icon"><ToastIcon variant={t.variant} /></span>
            <span className="toast-item-msg">{t.message}</span>
            <button
              type="button"
              className="toast-item-close"
              aria-label="Đóng"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
