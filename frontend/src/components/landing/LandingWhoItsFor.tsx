import { CheckCircle2, ClipboardList, TestTubeDiagonal, Users } from "lucide-react";

const ROLES = [
  {
    icon: ClipboardList,
    role: "Business Analyst",
    description: "Biến tài liệu SRS thô thành Requirement chuẩn chỉ trong vài phút.",
    points: [
      "Không bỏ sót nghiệp vụ ẩn trong tài liệu dài",
      "Requirement đầy đủ Input/Output, Business Rules, Validation",
      "Đồng bộ lại Requirement mỗi khi tài liệu thay đổi",
    ],
  },
  {
    icon: TestTubeDiagonal,
    role: "Tester / QA",
    description: "Có ngay bộ Test Case Blackbox đầy đủ, không cần thiết kế từ đầu.",
    points: [
      "Bao phủ Positive, Negative, Boundary chuẩn 7 cột QA",
      "Chỉnh sửa nhanh từng Test Case trong Test Case Studio",
      "Export Excel chuẩn để bàn giao báo cáo ngay",
    ],
  },
  {
    icon: Users,
    role: "Trưởng nhóm / PM",
    description: "Quản lý tập trung nhiều dự án, theo dõi tiến độ test theo thời gian thực.",
    points: [
      "Dashboard tổng quan Projects, Requirements, Test Cases",
      "Dữ liệu từng dự án tách biệt (RAG Isolation)",
      "Tăng tốc bàn giao, giảm rủi ro sót yêu cầu",
    ],
  },
];

export default function LandingWhoItsFor() {
  return (
    <section className="landing-whofor" id="who-its-for">
      <div className="landing-whofor-inner">
        <span className="landing-section-eyebrow">Dành cho ai</span>
        <h2 className="landing-section-title">
          Một nền tảng, phục vụ đúng nhu cầu<br />của từng vai trò trong đội ngũ
        </h2>

        <div className="landing-whofor-grid">
          {ROLES.map(({ icon: Icon, role, description, points }) => (
            <div className="landing-whofor-card" key={role}>
              <div className="landing-whofor-card-icon">
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <div className="landing-whofor-card-role">{role}</div>
              <div className="landing-whofor-card-desc">{description}</div>
              <ul className="landing-whofor-card-points">
                {points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={14} strokeWidth={2} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
