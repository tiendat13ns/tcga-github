import { FileStack, ListChecks, RefreshCcw, Timer } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

const PAIN_POINTS = [
  {
    icon: FileStack,
    title: "Tài liệu quá dài, quá rối",
    description: "Đọc và phân tích SRS/BRD hàng trăm trang thủ công, dễ bỏ sót yêu cầu nghiệp vụ quan trọng ẩn trong tài liệu.",
  },
  {
    icon: Timer,
    title: "Viết Requirement tốn hàng giờ",
    description: "Diễn giải tài liệu thô thành Requirement chuẩn đòi hỏi kinh nghiệm phân tích nghiệp vụ, dễ hiểu sai ý đồ ban đầu.",
  },
  {
    icon: ListChecks,
    title: "Thiết kế Test Case Blackbox không dễ",
    description: "Cần bao phủ đủ các trường hợp Positive, Negative, Boundary mà không bỏ sót edge case — tốn nhiều công sức rà soát.",
  },
  {
    icon: RefreshCcw,
    title: "Tài liệu thay đổi, làm lại từ đầu",
    description: "Mỗi lần cập nhật SRS là một lần rà soát thủ công toàn bộ Requirement và Test Case liên quan.",
  },
];

export default function LandingPainPoints() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="landing-pain">
      <div className="landing-pain-inner landing-reveal" ref={revealRef}>
        <span className="landing-section-eyebrow">Vấn đề thường gặp</span>
        <h2 className="landing-section-title">
          Phân tích tài liệu và viết test case thủ công<br />đang tốn quá nhiều thời gian của bạn
        </h2>

        <div className="landing-pain-grid landing-reveal-stagger">
          {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
            <div className="landing-pain-card" key={title}>
              <div className="landing-pain-card-icon">
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <div className="landing-pain-card-title">{title}</div>
              <div className="landing-pain-card-desc">{description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
