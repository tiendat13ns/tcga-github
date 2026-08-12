import { useState } from "react";
import { Menu, X } from "lucide-react";
import { TCGAMark } from "../TCGALogo";

type LandingHeaderProps = {
  isAuthenticated: boolean;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onGoToDashboard: () => void;
};

const NAV_LINKS = [
  { href: "#product", label: "Sản phẩm" },
  { href: "#how-it-works", label: "Cách hoạt động" },
  { href: "#features", label: "Tính năng" },
  { href: "#who-its-for", label: "Dành cho ai" },
  { href: "#usage", label: "Usage" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingHeader({ isAuthenticated, onGoToLogin, onGoToRegister, onGoToDashboard }: LandingHeaderProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <div className="landing-logo">
          <div className="landing-logo-mark">
            <TCGAMark size={22} />
          </div>
          <span className="landing-logo-text">TCGA</span>
        </div>

        <nav className="landing-header-nav">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="landing-header-actions">
          {isAuthenticated ? (
            <button className="btn btn-primary" onClick={onGoToDashboard}>
              Vào Dashboard
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onGoToLogin}>
                Đăng nhập
              </button>
              <button className="btn btn-primary" onClick={onGoToRegister}>
                Dùng thử miễn phí
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="landing-header-menu-btn"
          onClick={() => setIsMobileNavOpen((v) => !v)}
          aria-label={isMobileNavOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={isMobileNavOpen}
        >
          {isMobileNavOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
        </button>
      </div>

      {isMobileNavOpen && (
        <div className="landing-header-mobile-nav">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setIsMobileNavOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="landing-header-mobile-actions">
            {isAuthenticated ? (
              <button className="btn btn-primary" onClick={onGoToDashboard}>
                Vào Dashboard
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={onGoToLogin}>
                  Đăng nhập
                </button>
                <button className="btn btn-primary" onClick={onGoToRegister}>
                  Dùng thử miễn phí
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
