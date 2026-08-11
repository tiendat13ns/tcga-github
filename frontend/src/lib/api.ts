// Central nơi quản lý access/refresh token + fetch wrapper tự refresh khi access_token
// hết hạn — trước đây refresh_token được backend trả về nhưng FE bỏ phí, không lưu, nên
// access_token (JWT sống ngắn) hết hạn là user bị đá ra và phải đăng nhập lại.

const ACCESS_TOKEN_KEY = "tcga_token";
const REFRESH_TOKEN_KEY = "tcga_refresh_token";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Build headers kèm Bearer access_token hiện tại. */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Gộp các lần refresh chạy song song (nhiều request 401 cùng lúc) thành 1 lời gọi duy nhất.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.access_token) return false;
        setTokens(data.access_token, data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * fetch wrapper: tự gắn Bearer access_token; nếu response 401 (token hết hạn) thì thử
 * refresh 1 lần rồi gọi lại request gốc. Nếu refresh cũng thất bại, xoá token và bắn sự
 * kiện "tcga:logout" để AuthContext đăng xuất user (module này không có quyền truy cập
 * React context trực tiếp).
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = authHeaders(init.headers as Record<string, string> | undefined);
  let res = await fetch(input, { ...init, headers });

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders = authHeaders(init.headers as Record<string, string> | undefined);
      res = await fetch(input, { ...init, headers: retryHeaders });
    } else {
      clearTokens();
      window.dispatchEvent(new Event("tcga:logout"));
    }
  }

  return res;
}

/** Tải file (yêu cầu auth) dưới dạng blob rồi trigger download — không dùng thẻ <a href>
 * trực tiếp vì trình duyệt không đính kèm Authorization header khi click link. */
export async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const r = await apiFetch(url);
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(d?.detail || "Could not export file.");
  }
  const blob = await r.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
