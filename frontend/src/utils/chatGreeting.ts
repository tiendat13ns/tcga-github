export const CHAT_GREETING_ID = "ui-chat-greeting";

export type ChatGreetingMessage = {
  id: string;
  role: "ai";
  content: string;
  error?: boolean;
};

export function getChatGreeting(hasSelectedDocuments: boolean): ChatGreetingMessage {
  return {
    id: CHAT_GREETING_ID,
    role: "ai" as const,
    content: hasSelectedDocuments
      ? "Xin chào! Bạn đã chọn tài liệu, hãy đặt câu hỏi hoặc yêu cầu phân tích."
      : "Xin chào! Hãy chọn ít nhất một tài liệu ở cột bên phải để bắt đầu.",
  };
}
