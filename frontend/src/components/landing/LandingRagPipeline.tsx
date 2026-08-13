import { useEffect, useState } from "react";
import { UploadCloud, Layers, Database, Sparkles } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

const AUTOPLAY_INTERVAL_MS = 3500;

const STAGES = [
  {
    accent: "extract",
    icon: UploadCloud,
    label: "Nạp & Trích xuất",
    title: "Nạp tài liệu & trích xuất nội dung",
    description:
      "Tài liệu SRS/BRD (pdf, docx, xlsx, csv, zip...) được tải lên và lưu theo từng project. Hệ thống dùng bộ trích xuất riêng cho từng định dạng để lấy toàn bộ nội dung văn bản gốc.",
    sample: "SRS_v2.pdf  →  extracted_text (12,480 ký tự)",
    tags: ["pdf / docx / xlsx / csv", "Theo project"],
  },
  {
    accent: "chunk",
    icon: Layers,
    label: "Chia nhỏ & Embedding",
    title: "Chia nhỏ văn bản & tạo vector embedding",
    description:
      "Văn bản được chia thành các đoạn (chunk) theo section, tối đa ~1500 ký tự mỗi chunk và có phần overlap để giữ ngữ cảnh. Mỗi chunk sau đó được chuyển thành vector embedding.",
    sample: "chunk_03 (1500 ký tự)  →  [0.0182, -0.0091, 0.0347, …] (1536 chiều)",
    tags: ["Section-based chunking", "text-embedding-3-small"],
  },
  {
    accent: "store",
    icon: Database,
    label: "Lưu trữ & Truy xuất",
    title: "Lưu vector & truy xuất ngữ nghĩa",
    description:
      "Vector được lưu vào PostgreSQL (pgvector), cô lập hoàn toàn theo từng project — RAG Isolation. Khi cần trả lời, hệ thống tìm các chunk liên quan nhất bằng tìm kiếm ngữ nghĩa HNSW cosine similarity.",
    sample: "query_vector  →  ORDER BY embedding <=> query_vector LIMIT 12",
    tags: ["pgvector", "HNSW cosine search", "RAG Isolation"],
  },
  {
    accent: "generate",
    icon: Sparkles,
    label: "AI sinh nội dung",
    title: "AI sinh Requirement & Test Case",
    description:
      "Các chunk liên quan nhất được đưa vào AI để viết Requirement đầy đủ (Input/Output, Business Rules, Validation...). Từ mỗi Requirement, AI tiếp tục sinh bộ Test Case Blackbox chuẩn QA.",
    sample: "12 chunks liên quan  →  REQ-014  →  TC-014-01 … TC-014-07",
    tags: ["Retrieval-Augmented Generation", "Requirement → Test Case"],
  },
];

export default function LandingRagPipeline() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const revealRef = useScrollReveal<HTMLDivElement>();
  const active = STAGES[activeIndex];
  const isAutoPlaying = !hasInteracted && !isPaused && !prefersReducedMotion;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const handleChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STAGES.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAutoPlaying]);

  return (
    <section className="landing-rag" id="rag-pipeline">
      <div className="landing-rag-inner landing-reveal" ref={revealRef}>
        <span className="landing-section-eyebrow">Công nghệ lõi</span>
        <h2 className="landing-section-title">
          Tài liệu của bạn được xử lý ra sao<br />bên trong hệ thống RAG?
        </h2>
        <p className="landing-rag-subtitle">
          Bấm vào từng bước để xem chi tiết cách TCGA biến tài liệu thô thành dữ liệu AI có thể hiểu và trích dẫn.
        </p>

        <div
          className={`landing-rag-flow${isAutoPlaying ? " is-autoplaying" : ""}`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div className="landing-rag-flow-item" key={stage.accent}>
                <button
                  type="button"
                  className={`landing-rag-node landing-rag-node-${stage.accent}${idx === activeIndex ? " is-active" : ""}`}
                  onClick={() => {
                    setHasInteracted(true);
                    setActiveIndex(idx);
                  }}
                  aria-pressed={idx === activeIndex}
                >
                  <span className="landing-rag-node-icon">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="landing-rag-node-label">{stage.label}</span>
                </button>
                {idx < STAGES.length - 1 && (
                  <div className={`landing-rag-connector${idx < activeIndex ? " is-filled" : ""}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="landing-rag-detail" key={activeIndex}>
          <div className="landing-rag-detail-badge">Bước {activeIndex + 1}/{STAGES.length}</div>
          <h3 className="landing-rag-detail-title">{active.title}</h3>
          <p className="landing-rag-detail-desc">{active.description}</p>
          <div className={`landing-rag-detail-sample landing-rag-detail-sample-${active.accent}`}>
            {active.sample}
          </div>
          <div className="landing-rag-detail-tags">
            {active.tags.map((tag) => (
              <span className="landing-rag-tag" key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
