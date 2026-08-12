// Danh sách cập nhật tính năng cốt lõi, hiển thị ở trang /whats-new (không hiện trên landing
// page). Thêm entry MỚI vào ĐẦU mảng mỗi khi ra tính năng mới — không cần deploy backend/DB.
export type WhatsNewEntry = {
  version: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  description: string;
  tags?: string[];
};

export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    version: "1.0.0",
    date: "2026-08-12",
    title: "Ra mắt TCGA",
    description:
      "Phiên bản đầu tiên: upload tài liệu SRS/BRD, AI tự động trích xuất Requirement, sinh bộ Test Case Blackbox chuẩn QA, và xuất Excel chỉ trong vài phút.",
    tags: ["Requirement", "Test Case", "Export"],
  },
];
