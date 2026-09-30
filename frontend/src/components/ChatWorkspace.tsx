import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useAuth } from "../contexts/AuthContext";
import { formatAgentMessage } from "../utils/formatAgentMessage";
import { TCGAAppIcon } from "./TCGALogo";
import ConfirmDialog from "./ConfirmDialog";
import { getChatGreeting } from "../utils/chatGreeting";

export type Message = {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  error?: boolean;
};

type ChatWorkspaceProps = {
  projectId: string;
  selectedDocumentIds: string[];
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  // Gọi khi người dùng xác nhận xóa lịch sử — dùng để xóa luôn bản lưu ở DB (nếu có),
  // tách riêng khỏi việc reset UI cục bộ mà component này tự lo.
  onClearHistory?: () => void;
};

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

export default function ChatWorkspace({ projectId, selectedDocumentIds, initialMessages = [], onMessagesChange, onClearHistory }: ChatWorkspaceProps) {
  const { token, refreshUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Track whether we're past the initial mount to avoid redundant save on first render
  const isMounted = useRef(false);
  // Cho phép hủy request đang stream khi người dùng bấm "Dừng"
  const abortControllerRef = useRef<AbortController | null>(null);
  // Trong lúc đang stream token, dùng scroll "auto" (tức thì) thay vì "smooth" cho từng
  // token — gọi smooth-scroll liên tục nhiều lần/giây gây giật lag. Chỉ smooth-scroll khi
  // thêm message mới (đầu câu hỏi / đầu câu trả lời).
  const isStreamingRef = useRef(false);
  // Map id -> DOM node của từng tin nhắn user, dùng để nhảy nhanh tới đúng câu hỏi từ
  // thanh điều hướng cạnh scrollbar (giống ChatGPT).
  const userMessageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showMessageNav, setShowMessageNav] = useState(false);
  // Câu hỏi đang hiển thị trong khung nhìn hiện tại — dùng để in đậm đúng vạch tương ứng
  // trên thanh điều hướng, giúp biết mình đang ở đoạn nào của cuộc hội thoại.
  const [activeUserMessageId, setActiveUserMessageId] = useState<string | null>(null);
  const userMessages = messages.filter((m) => m.role === "user");
  const visibleMessages = messages.length > 0
    ? messages
    : [getChatGreeting(selectedDocumentIds.length > 0)];

  const scrollToMessage = (id: string) => {
    userMessageRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Xác định câu hỏi "đang được xem": câu hỏi cuối cùng có mép trên đã cuộn qua khỏi
  // đỉnh khung nhìn (cộng thêm 1 khoảng đệm nhỏ) — tức là đoạn nội dung ngay dưới nó
  // đang hiển thị trên màn hình.
  const updateActiveUserMessage = () => {
    const container = chatScrollRef.current;
    if (!container || userMessages.length === 0) return;
    const containerTop = container.getBoundingClientRect().top;
    const threshold = containerTop + 80;
    let current: string | null = userMessages[0].id;
    for (const m of userMessages) {
      const el = userMessageRefs.current.get(m.id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= threshold) {
        current = m.id;
      } else {
        break;
      }
    }
    setActiveUserMessageId(current);
  };

  useEffect(() => {
    updateActiveUserMessage();
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom — lần đầu load lịch sử cũ (mở lại "Work with Agent") thì nhảy
  // thẳng xuống tin nhắn gần nhất luôn (behavior "auto", không hoạt ảnh), tránh cảnh cuộn
  // trôi từ tin nhắn đầu tiên xuống dưới mỗi lần vào lại. Chỉ dùng "smooth" cho tin nhắn
  // MỚI phát sinh trong phiên đang mở (isMounted đã true lúc đó).
  useEffect(() => {
    const behavior: ScrollBehavior = (!isMounted.current || isStreamingRef.current) ? "auto" : "smooth";
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages]);

  // Auto-resize textarea theo nội dung nhập (tối đa 120px, khớp với maxHeight ở style)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputValue]);

  // Persist messages to parent whenever they change (after initial mount)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    onMessagesChange?.(messages);
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const confirmClearChat = () => {
    setMessages([]);
    onClearHistory?.();
  };

  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || selectedDocumentIds.length === 0) return;
    
    // Add user message
    const userContent = text.trim();
    const newUserMsg: Message = { id: Date.now().toString(), role: "user", content: userContent };
    
    // Build chat history for the API
    const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
    
    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);
    setInputValue("");
    
    // Tạo sẵn một message rỗng cho AI để append dần nội dung stream vào
    const aiMessageId = (Date.now() + 1).toString();
    setActiveAiMessageId(aiMessageId);
    setMessages((prev) => [...prev, { id: aiMessageId, role: "ai", content: "" }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      };
      if (token) {
        reqHeaders["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/chat/message`, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          document_ids: selectedDocumentIds,
          message: userContent,
          chat_history: historyForApi,
          stream: true,
          project_id: projectId
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("Lỗi kết nối API");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (reader) {
        let aiContent = "";
        let buffer = "";
        isStreamingRef.current = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          
          // Giữ lại dòng cuối cùng chưa hoàn chỉnh (không có \n ở cuối) vào buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const dataObj = JSON.parse(dataStr);
                if (dataObj.chunk) {
                  aiContent += dataObj.chunk;
                  setMessages((prev) => 
                    prev.map(msg => msg.id === aiMessageId ? { ...msg, content: aiContent } : msg)
                  );
                }
              } catch (err) {
                console.error("Lỗi parse SSE chunk:", err, dataStr);
              }
            }
          }
        }
      }
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") {
        // Người dùng chủ động bấm Dừng — giữ nguyên phần nội dung đã stream được, không báo lỗi
      } else {
        console.error(error);
        setMessages((prev) =>
          prev.map(msg => msg.id === aiMessageId ? { ...msg, content: msg.content || "❌ Đã có lỗi xảy ra khi gọi AI Agent. Vui lòng thử lại.", error: true } : msg)
        );
      }
    } finally {
      isStreamingRef.current = false;
      setIsLoading(false);
      setActiveAiMessageId(null);
      abortControllerRef.current = null;
      refreshUser?.();
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  // Gợi ý dạng số hiện khi chat còn trống (chỉ có lời chào) — bấm vào gửi thẳng, riêng mục
  // "Hỏi đáp" chỉ focus input vì đây là câu hỏi mở, không có 1 câu lệnh cố định để gửi sẵn.
  const emptyStateSuggestions = [
    { label: "Phân tích tài liệu tổng quan", action: () => sendMessage("Phân tích tài liệu tổng quan") },
    { label: "Tạo Requirement từ tài liệu", action: () => sendMessage("Hãy tạo Requirement cho các tài liệu này.") },
    { label: "Tạo Test Case cho Requirement", action: () => sendMessage("Tạo Test Case.") },
    { label: "Hỏi đáp về nghiệp vụ trong tài liệu", action: () => inputRef.current?.focus() },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", position: "relative" }}>
      {/* Nút xóa lịch sử nổi ở góc trên-phải thay vì có riêng 1 thanh header — breadcrumb ở
          ProjectDetailDashboard đã đảm nhiệm phần điều hướng/tiêu đề, đặt thêm thanh riêng
          chỉ để chứa 1 nút sẽ tạo ra khoảng trống thừa phía trên khung chat. */}
      <button
        onClick={() => setShowClearConfirm(true)}
        className="icon-btn-ghost"
        style={{
          position: "absolute",
          top: "10px",
          right: "18px",
          zIndex: 3,
          width: "28px",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--danger)",
          padding: 0,
          background: "var(--bg)",
          borderRadius: "6px",
        }}
        title="Xóa lịch sử chat"
      >
        <TrashIcon />
      </button>

      {/* Chat History */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <div className="chat-history-scroll" ref={chatScrollRef} onScroll={updateActiveUserMessage}>
      <div className="chat-history-inner">
        {visibleMessages.map((msg, idx) => {
          // Gộp avatar + nhãn "TCGA" cho các tin nhắn AI liên tiếp — chỉ hiện ở tin đầu
          // tiên của cụm, tránh lặp lại avatar/nhãn cho từng message riêng lẻ.
          const isFirstOfGroup = idx === 0 || visibleMessages[idx - 1].role !== msg.role;
          return (
          <div
            key={msg.id}
            ref={msg.role === "user" ? (el) => {
              if (el) userMessageRefs.current.set(msg.id, el);
              else userMessageRefs.current.delete(msg.id);
            } : undefined}
            style={{
              display: "flex",
              width: "100%",
              boxSizing: "border-box",
              flexDirection: msg.role === "ai" ? "row" : "column",
              alignItems: "flex-end",
              gap: msg.role === "ai" ? "8px" : 0,
            }}
          >
            {msg.role === "ai" && (
              <div style={{ flexShrink: 0, width: "28px" }}>
                {isFirstOfGroup && <TCGAAppIcon size={28} />}
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                minWidth: 0,
                flex: msg.role === "ai" ? 1 : "unset",
                // Đặt giới hạn 80% ở đây (cha có width:100% xác định rõ ràng) thay vì ở
                // bubble bên trong — nếu đặt max-width% ngay trên phần tử đang tự co theo
                // nội dung (fit-content) thì % đó tham chiếu tới 1 kích thước chưa xác định,
                // trình duyệt xử lý không nhất quán và bubble bị đẩy lệch khỏi mép phải.
                maxWidth: msg.role === "user" ? "80%" : undefined,
                width: msg.role === "user" ? "fit-content" : undefined,
              }}
            >
              {msg.role === "ai" && isFirstOfGroup && (
                <div style={{ marginBottom: "3px", fontSize: "12px", color: "var(--accent)", fontWeight: 500 }}>
                  TCGA
                </div>
              )}
              <div
                style={{
                  width: msg.role === "ai" ? "100%" : "auto",
                  padding: msg.role === "ai" ? (msg.error ? "12px 16px" : "2px 0") : "10px 14px",
                  borderRadius: msg.role === "ai" ? (msg.error ? "12px" : 0) : "16px",
                  background: msg.role === "user" ? "var(--accent-dim)" : (msg.error ? "var(--bg-hover)" : "transparent"),
                  color: "var(--text-primary)",
                  border: msg.error ? "1px solid var(--danger)" : (msg.role === "user" ? "1px solid var(--accent)" : "none"),
                  lineHeight: 1.55,
                  fontSize: "14px",
                  boxShadow: "none",
                }}
              >
                {msg.role === "ai" ? (
                  <>
                    {msg.content ? (
                      <div className="markdown-body" style={{ width: "100%", overflowX: "auto" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{formatAgentMessage(msg.content)}</ReactMarkdown>
                      </div>
                    ) : null}
                    {(isLoading && activeAiMessageId === msg.id) && (
                      <div className="chat-typing-indicator" style={{ marginTop: msg.content ? "10px" : "0" }}>
                        <span style={{ fontSize: "13px", fontStyle: "italic" }}>
                          {msg.content ? "Đang tiếp tục xử lý..." : "Đang xử lý"}
                        </span>
                        <span className="typing-dot">.</span>
                        <span className="typing-dot">.</span>
                        <span className="typing-dot">.</span>
                      </div>
                    )}
                    {msg.error && (
                      <button
                        onClick={() => {
                          const prevMsg = visibleMessages[idx - 1];
                          if (prevMsg?.role === "user") sendMessage(prevMsg.content);
                        }}
                        disabled={isLoading}
                        className="btn btn-secondary btn-xs"
                        style={{ marginTop: "10px" }}
                      >
                        🔄 Thử lại
                      </button>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          </div>
          );
        })}

        {messages.length === 0 && selectedDocumentIds.length > 0 && (
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ width: "28px", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px", color: "var(--text-primary)" }}>
                Bạn muốn tôi giúp:
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {emptyStateSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={s.action}
                    disabled={isLoading}
                    className="chat-suggestion-item"
                  >
                    <span style={{ color: "var(--text-muted)", width: "16px", flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ flexShrink: 0 }}></span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} style={{ height: "20px", flexShrink: 0 }} />
      </div>
      </div>

      {/* Thanh điều hướng câu hỏi — hover để xem toàn bộ câu hỏi đã gửi, bấm để nhảy
          nhanh tới đúng chỗ, giống thanh minimap của ChatGPT. Chỉ hiện khi có ít nhất 2
          câu hỏi trở lên, vì đoạn hội thoại ngắn không cần điều hướng riêng. */}
      {userMessages.length > 1 && (
        <>
          <div
            className="chat-msg-navigator"
            onMouseEnter={() => setShowMessageNav(true)}
          >
            {userMessages.map((m) => (
              <button
                key={m.id}
                className={`chat-msg-navigator-tick${m.id === activeUserMessageId ? " active" : ""}`}
                title={m.content.length > 60 ? `${m.content.slice(0, 60)}…` : m.content}
                onClick={() => scrollToMessage(m.id)}
              />
            ))}
          </div>
          {/* Vùng cầu nối vô hình phủ từ cụm vạch tới popup — chỉ tồn tại khi popup đang
              mở, để việc rê chuột từ vạch sang popup không bị coi là "rời khỏi" khu vực
              (tránh mất hover) mà không cần cho 2 khối này chồng/đè lên nhau về mặt hình ảnh. */}
          {showMessageNav && (
            <div
              className="chat-msg-navigator-bridge"
              onMouseLeave={() => setShowMessageNav(false)}
            >
              <div className="chat-msg-navigator-popup">
                {userMessages.map((m) => (
                  <button
                    key={m.id}
                    className={`chat-msg-navigator-item${m.id === activeUserMessageId ? " active" : ""}`}
                    onClick={() => scrollToMessage(m.id)}
                  >
                    {m.content.length > 44 ? `${m.content.slice(0, 44)}…` : m.content}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* Bottom Panel (Quick Actions + Input Area with Gradient Overlay) */}
      <div className="chat-bottom-panel">
      <div className="chat-bottom-inner">
        {/* Quick Actions */}
        <div className="chat-quick-actions" style={{ padding: "8px 0 12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => sendMessage("Phân tích tài liệu tổng quan")}
            className="btn btn-secondary btn-xs"
            disabled={selectedDocumentIds.length === 0 || isLoading}
          >
            Phân tích tài liệu tổng quan
          </button>
          <button
            onClick={() => sendMessage("Hãy tạo Requirement cho tài liệu này.")}
            className="btn btn-secondary btn-xs"
            disabled={selectedDocumentIds.length === 0 || isLoading}
          >
            Tạo Requirement
          </button>
          <button
            onClick={() => sendMessage("Hãy tạo Test Case cho tài liệu này.")}
            className="btn btn-secondary btn-xs"
            disabled={selectedDocumentIds.length === 0 || isLoading}
          >
            Tạo Test Case
          </button>
        </div>

        {/* Input Area */}
        <div style={{ padding: "8px 0 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              background: isLoading ? "var(--accent-glow)" : "var(--bg-hover)",
              borderRadius: "20px",
              padding: "4px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              transition: "background 0.2s ease",
            }}
          >
            <textarea
              ref={inputRef}
              value={inputValue}
              rows={1}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                // Enter gửi tin nhắn, Shift+Enter xuống dòng (giữ hành vi mặc định của textarea)
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputValue);
                }
              }}
              placeholder={selectedDocumentIds.length > 0 ? "Yêu cầu sinh test case hoặc phân tích tài liệu... (Shift+Enter để xuống dòng)" : "Vui lòng chọn tài liệu ở cột phải trước khi bắt đầu..."}
              disabled={selectedDocumentIds.length === 0 || isLoading}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                maxHeight: "120px",
                padding: "8px 16px",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                fontSize: "14px",
                lineHeight: 1.4,
              }}
            />
            {isLoading ? (
              <button
                onClick={stopGeneration}
                title="Dừng phản hồi"
                style={{
                  background: "var(--danger)",
                  color: "#c56666",
                  border: "none",
                  borderRadius: "20px",
                  padding: "8px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ■
              </button>
            ) : (
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || selectedDocumentIds.length === 0}
                title="Gửi"
                aria-label="Gửi"
                style={{
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: "20px",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: (!inputValue.trim() || selectedDocumentIds.length === 0) ? "not-allowed" : "pointer",
                  opacity: (!inputValue.trim() || selectedDocumentIds.length === 0) ? 0.5 : 1,
                }}
              >
                <img src="https://img.icons8.com/?size=100&id=AMroJOFoBCM9&format=png&color=000000g" alt="" width={18} height={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Xóa lịch sử chat"
        message="Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat không? Hành động này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={confirmClearChat}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
