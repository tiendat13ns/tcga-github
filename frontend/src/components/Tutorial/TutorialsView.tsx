import { useState } from "react";
import { BookOpen, Compass, Lightbulb } from "lucide-react";

type TutorialTab = "guide" | "prompt";

type TutorialsViewProps = {
  onStartTour: () => void;
};

type GuideStep = {
  title: string;
  body: string;
};

const USAGE_STEPS: GuideStep[] = [
  {
    title: "1. Tạo Project",
    body: "Vào Overview hoặc Projects, bấm \"Tạo Project mới\". Mỗi Project là 1 không gian làm việc riêng — tài liệu, Requirement và Test Case của các Project không lẫn vào nhau.",
  },
  {
    title: "2. Upload tài liệu",
    body: "Trong Project, vào tab Documents và tải lên tài liệu SRS/BRD (pdf, docx, xlsx, csv, hoặc zip chứa nhiều file). Hệ thống tự trích xuất nội dung và đánh chỉ mục ngữ nghĩa (RAG) theo từng Project.",
  },
  {
    title: "3. Trích xuất Requirement",
    body: "Sau khi tài liệu xử lý xong, bấm \"Generate\" để AI đọc tài liệu và sinh Requirement. Nếu AI đặt câu hỏi làm rõ (clarifying questions), hãy trả lời trong Requirement Viewer trước khi sinh Test Case — câu trả lời sẽ được dùng làm quy tắc nghiệp vụ đã xác nhận, giúp Test Case chính xác hơn.",
  },
  {
    title: "4. Sinh Test Case",
    body: "Từ mỗi Requirement, bấm \"Generate TCs\" để AI sinh bộ Test Case Blackbox chuẩn QA (Positive, Negative, Boundary), theo đúng kỹ thuật ISTQB.",
  },
  {
    title: "5. Test Case Studio",
    body: "Xem toàn bộ Test Case theo từng Requirement, lọc theo Priority/Type, sửa từng dòng qua drawer, theo dõi Execution (Pass/Fail/Blocked), rồi xuất Excel khi sẵn sàng bàn giao.",
  },
  {
    title: "6. AI Chat Workspace",
    body: "Chọn tài liệu rồi dùng Quick Actions (\"Phân tích tài liệu tổng quan\", \"Tạo Requirement\", \"Tạo Test Case\") hoặc chat tự do để hỏi đáp và thao tác ngay trong hội thoại.",
  },
  {
    title: "7. Credit & Plan",
    body: "Mỗi thao tác AI (trích xuất Requirement, sinh Test Case, chat, upload) tiêu tốn một số Credit tương ứng. Theo dõi số dư và lịch sử sử dụng ở mục Usage & Billing.",
  },
];

const PROMPT_TIPS: GuideStep[] = [
  {
    title: "Dùng Markdown Header để chia mục rõ ràng",
    body: "Hệ thống chia nhỏ tài liệu (chunking) dựa theo Heading (#, ##, ###) trước khi đánh chỉ mục ngữ nghĩa. Tài liệu có cấu trúc Header rõ ràng sẽ được tìm kiếm ngữ cảnh chính xác hơn, kéo theo Requirement trích xuất chất lượng hơn.",
  },
  {
    title: "Viết rõ ràng, đừng để AI phải đoán",
    body: "AI không tự bịa nghiệp vụ — nếu tài liệu không nêu rõ validation rule, phân quyền, hay trạng thái (state), các trường tương ứng trong Requirement sẽ để trống. Ghi rõ càng nhiều chi tiết nghiệp vụ càng tốt.",
  },
  {
    title: "Mỗi tính năng — một mục riêng",
    body: "AI tách tài liệu thành các Requirement riêng biệt theo từng use case. Tách mỗi tính năng/luồng nghiệp vụ thành một mục (section) riêng trong tài liệu giúp AI phân tách đúng, tránh gộp nhầm hoặc chia vụn một luồng thống nhất.",
  },
  {
    title: "Ngôn ngữ đầu ra khớp ngôn ngữ đầu vào",
    body: "AI luôn trả lời cùng ngôn ngữ với tài liệu gốc. Muốn Requirement/Test Case tiếng Việt thì viết tài liệu tiếng Việt, và ngược lại.",
  },
  {
    title: "Trả lời Clarifying Questions trước khi sinh Test Case",
    body: "AI tự nêu 3-5 câu hỏi làm rõ cho mỗi Requirement còn mơ hồ. Trả lời trong Requirement Viewer — các câu trả lời này được xem như quy tắc nghiệp vụ đã xác nhận và sẽ sinh thêm Test Case riêng tương ứng.",
  },
  {
    title: "Requirement quá lớn sẽ bị cắt bớt Test Case",
    body: "Mỗi Requirement chỉ sinh tối đa khoảng 12 Test Case — nếu phạm vi quá rộng, AI ưu tiên giữ lại các trường hợp giá trị cao nhất và bỏ bớt phần còn lại. Nên tách một tính năng lớn thành nhiều Requirement nhỏ để được bao phủ đầy đủ hơn.",
  },
];

function StepList({ steps }: { steps: GuideStep[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {steps.map((step) => (
        <div
          key={step.title}
          className="card"
          style={{
            padding: "18px 20px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            {step.title}
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {step.body}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TutorialsView({ onStartTour }: TutorialsViewProps) {
  const [activeTab, setActiveTab] = useState<TutorialTab>("guide");

  const tabChip = (tab: TutorialTab, label: string) => (
    <button
      type="button"
      style={{
        height: "32px",
        padding: "0 16px",
        fontSize: "13px",
        fontWeight: activeTab === tab ? 600 : 500,
        borderRadius: "6px",
        border: "none",
        background: activeTab === tab ? "var(--accent)" : "transparent",
        color: activeTab === tab ? "#ffffff" : "var(--text-secondary)",
        boxShadow: activeTab === tab ? "0 2px 6px rgba(139, 105, 20, 0.25)" : "none",
        cursor: "pointer",
        transition: "all var(--transition)",
      }}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </button>
  );

  return (
    <div className="tcs-view">
      <div className="tcs-view-header">
        <div className="tcs-view-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div className="tcs-title" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="tcs-title-icon" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
              <BookOpen size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 600 }}>Tutorials</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400, marginTop: "2px" }}>
                Hướng dẫn sử dụng và Prompt Engineering
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={onStartTour} style={{ height: "38px", padding: "0 16px" }}>
            <Compass size={16} strokeWidth={2} /> Bắt đầu Tour hướng dẫn
          </button>
        </div>
      </div>

      <div className="tcs-view-body" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "inline-flex", alignSelf: "flex-start", background: "var(--bg-elevated)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {tabChip("guide", "Hướng dẫn sử dụng")}
          {tabChip("prompt", "Prompt Engineering")}
        </div>

        {activeTab === "guide" ? (
          <StepList steps={USAGE_STEPS} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              <Lightbulb size={14} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
              Mẹo dưới đây dựa trên đúng cách AI của TCGA xử lý tài liệu — áp dụng để có Requirement và Test Case chất lượng hơn.
            </div>
            <StepList steps={PROMPT_TIPS} />
          </>
        )}
      </div>
    </div>
  );
}
