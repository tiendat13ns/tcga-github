import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export type FeedbackType = "bug" | "feature_request" | "other";

async function submitFeedback(payload: { type: FeedbackType; message: string }) {
  const r = await apiFetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.detail || "Không thể gửi phản hồi");
  }
  return r.json();
}

export function useSubmitFeedback() {
  return useMutation({ mutationFn: submitFeedback });
}
