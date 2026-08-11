import { FileSearch, FlaskConical, MessageSquareText, NotebookPen, Rows3, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Phân tích tài liệu chi tiết, đa định dạng",
    description: "Hỗ trợ pdf, docx, xlsx, csv, zip... RAG Semantic Search tìm đúng ngữ cảnh liên quan nhất trong tài liệu dài hàng trăm trang.",
  },
  {
    icon: NotebookPen,
    title: "Tự động viết Requirement chuẩn BA",
    description: "Đầy đủ Input/Output, Business Rules, Validation Rules, luồng ngoại lệ — như một Business Analyst giàu kinh nghiệm viết tay.",
  },
  {
    icon: FlaskConical,
    title: "Sinh Test Case Blackbox toàn diện",
    description: "Bao phủ Positive, Negative, Boundary theo chuẩn 7 cột QA, gán sẵn mức độ ưu tiên — đúng góc nhìn của một Tester.",
  },
  {
    icon: Rows3,
    title: "Test Case Studio — quản lý như một bảng dữ liệu",
    description: "Xem toàn bộ Test Case theo từng Requirement, chỉnh sửa nhanh từng dòng, lọc động theo Priority, Status, Type.",
  },
  {
    icon: ShieldCheck,
    title: "Cô lập dữ liệu theo từng Project",
    description: "RAG Isolation đảm bảo ngữ cảnh tìm kiếm không bị trộn lẫn giữa các dự án khác nhau, dù chạy trên cùng một tài khoản.",
  },
  {
    icon: MessageSquareText,
    title: "AI Chat Workspace",
    description: "Hỏi đáp trực tiếp về nội dung tài liệu, dùng Quick Actions để tạo Requirement hoặc Test Case ngay trong hội thoại.",
  },
];

export default function LandingFeatures() {
  return (
    <section className="landing-features" id="features">
      <div className="landing-features-inner">
        <span className="landing-section-eyebrow">Tính năng</span>
        <h2 className="landing-section-title">
          Mọi công cụ Tester & BA cần,<br />gói gọn trong một nền tảng
        </h2>

        <div className="landing-features-grid">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div className="landing-feature-card" key={title}>
              <div className="landing-feature-card-icon">
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <div className="landing-feature-card-title">{title}</div>
              <div className="landing-feature-card-desc">{description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
