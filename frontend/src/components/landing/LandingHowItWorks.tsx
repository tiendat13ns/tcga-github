import { useScrollReveal } from "./useScrollReveal";

const STEPS = [
  {
    number: "01",
    title: "Upload tài liệu",
    description:
      "Tải lên tài liệu SRS/BRD ở bất kỳ định dạng nào (pdf, docx, xlsx, csv, zip...). Hệ thống tự trích xuất nội dung và đánh chỉ mục ngữ nghĩa (RAG) theo từng project, không lẫn dữ liệu giữa các dự án.",
  },
  {
    number: "02",
    title: "AI phân tích nghiệp vụ & viết Requirement",
    description:
      "AI đọc toàn bộ tài liệu, phân tích nghiệp vụ và tự động viết Requirement đầy đủ: Input/Output, Business Rules, Validation, luồng ngoại lệ — đúng vai trò một BA giàu kinh nghiệm.",
  },
  {
    number: "03",
    title: "Sinh Test Case Blackbox",
    description:
      "Từ mỗi Requirement, AI sinh bộ Test Case chuẩn QA 7 cột (Feature, Test Case ID, Precondition, Test Steps, Test Data, Expected Output), bao phủ đủ Positive / Negative / Boundary.",
  },
  {
    number: "04",
    title: "Chỉnh sửa & Export",
    description:
      "Rà soát, chỉnh sửa từng Test Case ngay trong Test Case Studio như một bảng dữ liệu liền mạch, rồi xuất file Excel chuyên nghiệp sẵn sàng bàn giao chỉ với 1 click.",
  },
];

export default function LandingHowItWorks() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="landing-how" id="how-it-works">
      <div className="landing-how-inner landing-reveal" ref={revealRef}>
        <span className="landing-section-eyebrow">Cách hoạt động</span>
        <h2 className="landing-section-title">
          Từ tài liệu thô đến bộ Test Case hoàn chỉnh<br />chỉ trong 4 bước
        </h2>

        <div className="landing-how-steps landing-reveal-stagger">
          {STEPS.map((step, idx) => (
            <div className="landing-how-step" key={step.number}>
              <div className="landing-how-step-number-col">
                <div className="landing-how-step-number">{step.number}</div>
                {idx < STEPS.length - 1 && <div className="landing-how-step-line" />}
              </div>
              <div className="landing-how-step-content">
                <div className="landing-how-step-title">{step.title}</div>
                <div className="landing-how-step-desc">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
