import { Mail } from "lucide-react";
import { TCGAMark } from "../TCGALogo";

const CONTACT_EMAIL = "dat96133@gmail.com";

type LandingFooterProps = {
  onGoToWhatsNew?: () => void;
};

export default function LandingFooter({ onGoToWhatsNew }: LandingFooterProps) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <div className="landing-logo">
            <div className="landing-logo-mark">
              <TCGAMark size={20} />
            </div>
            <span className="landing-logo-text">TCGA</span>
          </div>
          <p className="landing-footer-tagline">
            Trợ lý AI giúp BA và Tester tự động phân tích tài liệu, viết Requirement và sinh Test Case.
          </p>
        </div>

        <div className="landing-footer-col">
          <div className="landing-footer-col-title">Điều hướng</div>
          <a href="#how-it-works">Cách hoạt động</a>
          <a href="#features">Tính năng</a>
          <a href="#who-its-for">Dành cho ai</a>
          <a href="#usage">Usage</a>
          <a href="#faq">FAQ</a>
          {onGoToWhatsNew && (
            <button type="button" onClick={onGoToWhatsNew} className="landing-footer-link-btn">
              Tính năng mới
            </button>
          )}
        </div>

        <div className="landing-footer-col">
          <div className="landing-footer-col-title">Liên hệ</div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="landing-footer-contact">
            <Mail size={13} strokeWidth={1.75} />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="landing-footer-bottom">
        © {new Date().getFullYear()} TCGA — Test Case Generation Assistant. All rights reserved.
      </div>
    </footer>
  );
}
