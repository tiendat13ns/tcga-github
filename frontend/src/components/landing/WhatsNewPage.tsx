import "./landing.css";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TCGAMark } from "../TCGALogo";
import { WHATS_NEW_ENTRIES } from "../../data/whatsNew";
import LandingFooter from "./LandingFooter";

type WhatsNewPageProps = {
  isAuthenticated: boolean;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onGoToDashboard: () => void;
  onGoToLanding: () => void;
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function WhatsNewPage({ isAuthenticated, onGoToLogin, onGoToRegister, onGoToDashboard, onGoToLanding }: WhatsNewPageProps) {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header-inner">
          <button type="button" className="landing-logo" onClick={onGoToLanding} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div className="landing-logo-mark">
              <TCGAMark size={22} />
            </div>
            <span className="landing-logo-text">TCGA</span>
          </button>

          <nav className="landing-header-nav">
            <button type="button" className="whats-new-back-link" onClick={onGoToLanding}>
              <ArrowLeft size={14} strokeWidth={2} /> Về trang chủ
            </button>
          </nav>

          <div className="landing-header-actions">
            {isAuthenticated ? (
              <button className="btn btn-primary" onClick={onGoToDashboard}>Vào Dashboard</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={onGoToLogin}>Đăng nhập</button>
                <button className="btn btn-primary" onClick={onGoToRegister}>Dùng thử miễn phí</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="whats-new-hero">
          <div className="whats-new-hero-inner">
            <span className="landing-hero-badge">
              <Sparkles size={13} strokeWidth={2} /> Changelog
            </span>
            <h1 className="landing-section-title">Tính năng mới</h1>
            <p className="whats-new-hero-subtitle">
              Những cập nhật gần đây nhất cho các tính năng cốt lõi của TCGA — Requirement, Test Case, và quy trình làm việc.
            </p>
          </div>
        </section>

        <section className="whats-new-timeline-section">
          <div className="whats-new-timeline">
            {WHATS_NEW_ENTRIES.map((entry) => (
              <article className="whats-new-entry" key={entry.version}>
                <div className="whats-new-entry-marker" />
                <div className="whats-new-entry-body">
                  <div className="whats-new-entry-meta">
                    <span className="whats-new-entry-version">v{entry.version}</span>
                    <span className="whats-new-entry-date">{formatDate(entry.date)}</span>
                  </div>
                  <h2 className="whats-new-entry-title">{entry.title}</h2>
                  <p className="whats-new-entry-desc">{entry.description}</p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="whats-new-entry-tags">
                      {entry.tags.map((tag) => (
                        <span className="whats-new-entry-tag" key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}

