import type { Step } from "react-joyride";

// Tour định hướng: chỉ giới thiệu Sidebar + Overview Dashboard — tất cả các anchor đều nằm
// trên 1 màn hình (Overview), không cần điều hướng qua các view khác giữa các bước. Xem
// App.tsx startTour() — luôn chuyển activeView về "overview" trước khi bật tour.
export const TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Chào mừng đến với TCGA",
    content: "Hãy cùng điểm qua nhanh các khu vực chính trong không gian làm việc trước khi bắt đầu.",
  },
  {
    target: '[data-tour="nav-overview"]',
    title: "Overview",
    content: "Trang tổng quan: dự án gần đây, thống kê Requirement/Test Case, và lối vào nhanh các khu vực khác.",
  },
  {
    target: '[data-tour="nav-projects"]',
    title: "Projects",
    content: "Quản lý các Project — mỗi Project chứa tài liệu, Requirement và Test Case riêng, tách biệt hoàn toàn với nhau.",
  },
  {
    target: '[data-tour="nav-test-cases"]',
    title: "Tester Studio",
    content: "Nơi xem, lọc, chỉnh sửa từng Test Case do AI sinh ra và xuất file Excel khi sẵn sàng bàn giao.",
  },
  {
    target: '[data-tour="nav-usage"]',
    title: "Usage & Billing",
    content: "Theo dõi số Credit còn lại và lịch sử sử dụng — mỗi thao tác AI (trích xuất Requirement, sinh Test Case, chat) sẽ trừ một số Credit tương ứng.",
  },
  {
    target: '[data-tour="nav-tutorial"]',
    title: "Tutorial",
    content: "Bạn đang ở đây! Quay lại trang này bất cứ lúc nào để xem lại hướng dẫn sử dụng và mẹo Prompt Engineering.",
  },
  {
    target: '[data-tour="overview-new-project"]',
    title: "Bắt đầu từ đây",
    content: "Bấm vào đây để tạo Project đầu tiên — bước khởi đầu của toàn bộ luồng: Upload tài liệu → Trích xuất Requirement → Sinh Test Case.",
  },
  {
    target: '[data-tour="overview-resume"]',
    title: "Tiếp tục công việc",
    content: "Sau khi có Project, khu vực này giúp bạn quay lại đúng Project hoặc Tester Studio đang làm dở chỉ với 1 click.",
  },
  {
    target: '[data-tour="overview-metrics"]',
    title: "Thống kê tổng quan",
    content: "Số liệu tổng hợp toàn tài khoản: số Project, tài liệu, Requirement và Test Case đã tạo.",
  },
];
