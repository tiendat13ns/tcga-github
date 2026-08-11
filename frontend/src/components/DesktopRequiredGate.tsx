import { ReactNode, useEffect, useState } from "react";
import { LogOut, Monitor } from "lucide-react";

// Test Case Studio và các bảng dữ liệu trong app được thiết kế cho màn hình rộng
// (xem .tcs-table-wrap min-width: 1200px trong styles.css) — dưới ngưỡng này trải
// nghiệm vỡ layout thay vì chỉ xấu đi, nên chặn hẳn bằng màn hình yêu cầu desktop.
const MIN_WIDTH = 1024;

type DesktopRequiredGateProps = {
  onGoHome: () => void;
  onSignOut: () => void;
  children: ReactNode;
};

export default function DesktopRequiredGate({ onGoHome, onSignOut, children }: DesktopRequiredGateProps) {
  const [isTooSmall, setIsTooSmall] = useState(() => window.innerWidth < MIN_WIDTH);

  useEffect(() => {
    const handleResize = () => setIsTooSmall(window.innerWidth < MIN_WIDTH);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isTooSmall) return <>{children}</>;

  return (
    <div className="desktop-required-gate">
      <div className="desktop-required-icon">
        <Monitor size={32} strokeWidth={1.5} />
      </div>
      <h1 className="desktop-required-title">Cần màn hình rộng hơn</h1>
      <p className="desktop-required-text">
        Không gian làm việc của TCGA (Test Case Studio, Dashboard, Admin) được thiết kế cho máy tính.
        Vui lòng mở rộng cửa sổ trình duyệt hoặc dùng máy tính để tiếp tục.
      </p>
      <div className="desktop-required-actions">
        <button className="btn btn-primary" onClick={onGoHome}>
          Về trang chủ
        </button>
        <button className="btn btn-secondary" onClick={onSignOut}>
          <LogOut size={14} strokeWidth={1.75} /> Đăng xuất
        </button>
      </div>
    </div>
  );
}
