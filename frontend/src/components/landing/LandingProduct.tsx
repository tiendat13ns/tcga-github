import { CheckCircle2, FlaskConical, Info, NotebookPen } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

const ASSETS = [
  {
    icon: NotebookPen,
    accent: "requirement",
    badge: "Đầu ra của BA",
    title: "Requirement",
    description:
      "Yêu cầu nghiệp vụ được AI đọc hiểu và viết chuẩn từ tài liệu SRS/BRD gốc — đúng vai trò một Business Analyst giàu kinh nghiệm.",
    tags: ["Input/Output", "Business Rules", "Validation", "Luồng ngoại lệ", "Actor", "Precondition"],
    tracks: [
      ["Nguồn tài liệu gốc", "Actor liên quan"],
      ["Business Rules", "Input / Output"],
      ["Validation Rules", "Trạng thái rà soát"],
      ["Độ ưu tiên nghiệp vụ", "Test Case liên kết"],
    ],
  },
  {
    icon: FlaskConical,
    accent: "testcase",
    badge: "Đầu ra của QA",
    title: "Test Case",
    description:
      "Bộ Test Case Blackbox được sinh tự động từ mỗi Requirement, bao phủ đủ Positive / Negative / Boundary, sẵn sàng thực thi.",
    tags: ["Test Case ID", "Precondition", "Test Steps", "Test Data", "Expected Output", "Priority"],
    tracks: [
      ["Loại (Positive/Negative/Boundary)", "Requirement gốc"],
      ["Mức độ ưu tiên", "Test Steps chi tiết"],
      ["Trạng thái thực thi", "Test Data mẫu"],
      ["Bug liên kết", "Người thực thi"],
    ],
  },
];

export default function LandingProduct() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="landing-product" id="product">
      <div className="landing-product-inner landing-reveal" ref={revealRef}>
        <span className="landing-section-eyebrow">Sản phẩm</span>
        <h2 className="landing-section-title">
          Tạo và quản lý hai tài sản cốt lõi<br />trong quy trình kiểm thử của bạn
        </h2>

        <div className="landing-product-grid landing-reveal-stagger">
          {ASSETS.map(({ icon: Icon, accent, badge, title, description, tags, tracks }) => (
            <div className={`landing-product-card landing-product-card-${accent}`} key={title}>
              <div className="landing-product-card-head">
                <div className="landing-product-card-icon">
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <span className="landing-product-card-badge">{badge}</span>
              </div>

              <h3 className="landing-product-card-title">{title}</h3>
              <p className="landing-product-card-desc">{description}</p>

              <div className="landing-product-card-tags-label">Thành phần</div>
              <div className="landing-product-card-tags">
                {tags.map((tag) => (
                  <span className="landing-product-tag" key={tag}>{tag}</span>
                ))}
              </div>

              <div className="landing-product-card-divider" />

              <div className="landing-product-card-tracks-label">TCGA theo dõi</div>
              <div className="landing-product-card-tracks">
                {tracks.map(([left, right]) => (
                  <div className="landing-product-track-row" key={left}>
                    <span className="landing-product-track-item">
                      <CheckCircle2 size={14} strokeWidth={2} />
                      {left}
                    </span>
                    <span className="landing-product-track-item">
                      <CheckCircle2 size={14} strokeWidth={2} />
                      {right}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="landing-product-note">
          <Info size={16} strokeWidth={1.75} />
          <span>
            Test Case không phải là tài sản độc lập — mỗi Test Case luôn được sinh ra và gắn liền với đúng một
            Requirement mà nó kiểm thử.
          </span>
        </div>
      </div>
    </section>
  );
}
