import { FileText, FolderGit2, HardDrive, Zap } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

// Khớp đúng dữ liệu thật trả về từ backend: GET /api/usage/summary (backend/app/routers/usage.py)
const PLANS = [
  {
    name: "Free Plan",
    status: "active" as const,
    creditsPerMonth: 200,
    maxDocuments: 5,
    maxProjects: 3,
    storageMb: 50,
  },
  {
    name: "Lite Plan",
    status: "coming_soon" as const,
    creditsPerMonth: 600,
    maxDocuments: 15,
    maxProjects: 10,
    storageMb: 500,
  },
  {
    name: "Pro Plan",
    status: "coming_soon" as const,
    creditsPerMonth: 1500,
    maxDocuments: null,
    maxProjects: null,
    storageMb: 2048,
  },
];

function formatStorage(mb: number) {
  return mb >= 1024 ? `${mb / 1024}GB Storage` : `${mb}MB Storage`;
}

type LandingUsageProps = {
  isAuthenticated: boolean;
  onPrimaryCta: () => void;
};

export default function LandingUsage({ isAuthenticated, onPrimaryCta }: LandingUsageProps) {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="landing-usage" id="usage">
      <div className="landing-usage-inner landing-reveal" ref={revealRef}>
        <span className="landing-section-eyebrow">Usage</span>
        <h2 className="landing-section-title">
          Trả phí theo mức sử dụng thực tế,<br />không cam kết dài hạn
        </h2>
        <p className="landing-usage-subtitle">
          Mỗi thao tác AI (trích xuất Requirement, sinh Test Case, chat phân tích tài liệu) tiêu tốn Credit.
          Bắt đầu miễn phí, nâng cấp khi cần nhiều Credit hơn.
        </p>

        <div className="landing-usage-grid landing-reveal-stagger">
          {PLANS.map((plan) => {
            const isComingSoon = plan.status === "coming_soon";
            return (
              <div className={`landing-usage-card${isComingSoon ? " is-coming-soon" : ""}`} key={plan.name}>
                {isComingSoon && <span className="landing-usage-badge">Sắp ra mắt</span>}
                {!isComingSoon && <span className="landing-usage-badge landing-usage-badge-active">Đang mở</span>}

                <div className="landing-usage-card-name">{plan.name}</div>

                <ul className="landing-usage-card-specs">
                  <li>
                    <Zap size={13} strokeWidth={1.75} />
                    <span>{plan.creditsPerMonth.toLocaleString()} Credits / tháng</span>
                  </li>
                  <li>
                    <FileText size={13} strokeWidth={1.75} />
                    <span>{plan.maxDocuments ?? "Không giới hạn"} tài liệu</span>
                  </li>
                  <li>
                    <FolderGit2 size={13} strokeWidth={1.75} />
                    <span>{plan.maxProjects ?? "Không giới hạn"} projects</span>
                  </li>
                  <li>
                    <HardDrive size={13} strokeWidth={1.75} />
                    <span>{formatStorage(plan.storageMb)}</span>
                  </li>
                </ul>

                {isComingSoon ? (
                  <a href="mailto:dat96133@gmail.com" className="btn btn-secondary landing-usage-card-btn">
                    Liên hệ admin để nâng cấp gói
                  </a>
                ) : (
                  <button className="btn btn-primary landing-usage-card-btn" onClick={onPrimaryCta}>
                    {isAuthenticated ? "Vào Dashboard" : "Bắt đầu miễn phí"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
