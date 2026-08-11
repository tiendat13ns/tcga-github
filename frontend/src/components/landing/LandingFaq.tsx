import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "TCGA là gì?",
    a: "TCGA (Test Case Generation Assistant) là công cụ AI giúp BA và Tester tự động phân tích tài liệu yêu cầu (SRS/BRD), trích xuất Requirement và sinh bộ Test Case chuẩn, xuất thẳng ra Excel.",
  },
  {
    q: "TCGA hỗ trợ những định dạng tài liệu nào?",
    a: "TCGA hỗ trợ pdf, docx, txt, md, xlsx, csv và file nén zip chứa nhiều tài liệu cùng lúc.",
  },
  {
    q: "Test Case do AI sinh ra có đủ tin cậy để dùng ngay không?",
    a: "AI sinh Test Case Blackbox bao phủ đầy đủ Positive, Negative, Boundary dựa trên Requirement đã trích xuất. Bạn vẫn nên rà soát và tinh chỉnh trong Test Case Studio trước khi bàn giao, giống như review công việc của một thành viên trong team.",
  },
  {
    q: "Dữ liệu giữa các project có bị lẫn với nhau không?",
    a: "Không. TCGA dùng cơ chế RAG Isolation, cô lập hoàn toàn ngữ cảnh tìm kiếm theo từng project — tài liệu và Requirement của project này không ảnh hưởng tới project khác.",
  },
  {
    q: "Tôi có thể chỉnh sửa Test Case sau khi AI sinh ra không?",
    a: "Có. Test Case Studio cho phép chỉnh sửa từng dòng ngay trên bảng dữ liệu, kèm bộ lọc theo Priority, Status, Type.",
  },
  {
    q: "Credit là gì và dùng hết thì sao?",
    a: "Mỗi thao tác AI (trích xuất Requirement, sinh Test Case, chat phân tích tài liệu) sẽ trừ một số Credit tương ứng. Khi dùng hết Credit ở gói Free, bạn có thể nâng cấp lên Lite hoặc Pro Plan khi các gói này chính thức mở.",
  },
  {
    q: "Tôi có thể xuất báo cáo Test Case ra định dạng nào?",
    a: "TCGA xuất trực tiếp file Excel (.xlsx) chuẩn QA 7 cột, sẵn sàng bàn giao cho team hoặc khách hàng.",
  },
];

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="landing-faq-item">
      <button className="landing-faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{q}</span>
        <ChevronDown size={16} strokeWidth={2} className={`landing-faq-chevron${isOpen ? " is-open" : ""}`} />
      </button>
      {isOpen && <div className="landing-faq-answer">{a}</div>}
    </div>
  );
}

export default function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <section className="landing-faq" id="faq">
      <div className="landing-faq-inner">
        <span className="landing-section-eyebrow">FAQ</span>
        <h2 className="landing-section-title">Câu hỏi thường gặp</h2>

        <div className="landing-faq-list">
          {FAQ_ITEMS.map((item, idx) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
        </div>
      </div>

      {/* Structured data cho Google rich snippet */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </section>
  );
}
