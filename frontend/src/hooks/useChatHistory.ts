import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { Message } from "../components/ChatWorkspace";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const DEFAULT_GREETING: Message[] = [
  { id: "1", role: "ai", content: "Xin chào! Bạn đã chọn tài liệu, hãy đặt câu hỏi hoặc yêu cầu phân tích." },
];

export const chatHistoryKeys = {
  byProject: (projectId: string) => ["chat-history", projectId] as const,
};

type ChatHistoryApiMessage = { id: string; role: "user" | "ai" | "system"; content: string; error: boolean };

async function fetchChatHistory(projectId: string): Promise<Message[]> {
  const r = await apiFetch(`${API_BASE}/api/chat/history?project_id=${projectId}`);
  if (!r.ok) throw new Error("Không tải được lịch sử chat");
  const data: { messages: ChatHistoryApiMessage[] } = await r.json();
  if (data.messages.length === 0) return DEFAULT_GREETING;
  return data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, error: m.error || undefined }));
}

async function deleteChatHistoryAPI(projectId: string): Promise<void> {
  const r = await apiFetch(`${API_BASE}/api/chat/history?project_id=${projectId}`, {
    method: "DELETE",
  });
  if (!r.ok && r.status !== 204) throw new Error("Không xóa được lịch sử chat");
}

/** Lấy lịch sử chat đã lưu ở DB cho 1 project — nguồn sự thật khi mở lại "Work with Agent". */
export function useChatHistory(projectId: string | null) {
  return useQuery({
    queryKey: chatHistoryKeys.byProject(projectId ?? ""),
    queryFn: () => fetchChatHistory(projectId as string),
    enabled: !!projectId,
    staleTime: Infinity, // tin nhắn mới trong phiên hiện tại được cập nhật bằng setQueryData, không cần refetch
  });
}

/** Cập nhật cache cục bộ ngay khi có tin nhắn mới trong phiên đang mở — backend đã tự lưu
 * DB trong lúc xử lý /api/chat/message, hook này chỉ giữ UI đồng bộ, không gọi API lại. */
export function useSyncChatHistoryCache(projectId: string | null) {
  const queryClient = useQueryClient();
  return (messages: Message[]) => {
    if (!projectId) return;
    queryClient.setQueryData(chatHistoryKeys.byProject(projectId), messages);
  };
}

/** Xóa lịch sử chat đã lưu ở DB + reset cache cục bộ về lời chào mặc định. */
export function useClearChatHistory(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteChatHistoryAPI(projectId as string),
    onSuccess: () => {
      if (!projectId) return;
      queryClient.setQueryData(chatHistoryKeys.byProject(projectId), DEFAULT_GREETING);
    },
  });
}
