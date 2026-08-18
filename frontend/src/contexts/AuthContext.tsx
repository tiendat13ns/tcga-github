import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, setTokens, clearTokens, API_BASE } from "../lib/api";

type User = {
  id: string;
  email: string;
  role: string;
  plan?: string;
  credit_balance: number;
  created_at?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (token: string, refreshToken?: string | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          setUser(data);
        } else {
          logout();
        }
      } else {
        // Token might be expired or invalid
        logout();
      }
    } catch (e) {
      console.error("Failed to fetch user:", e);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // apiFetch (lib/api.ts) bắn sự kiện này khi access_token hết hạn VÀ refresh cũng thất
  // bại — không thể gọi logout() từ đó trực tiếp vì module đó nằm ngoài React context.
  useEffect(() => {
    const handleForcedLogout = () => logout();
    window.addEventListener("tcga:logout", handleForcedLogout);
    return () => window.removeEventListener("tcga:logout", handleForcedLogout);
  }, []);

  const login = (newToken: string, refreshToken?: string | null) => {
    // cancelQueries TRƯỚC clear(): clear() không hủy request đang bay, nên nếu 1 query của
    // tài khoản cũ chưa kịp trả lời thì response trễ đó vẫn bị ghi vào cache sau khi clear(),
    // hiện nhầm data của user cũ cho tài khoản mới cho tới khi có refetch khác ghi đè.
    queryClient.cancelQueries();
    queryClient.clear();
    setTokens(newToken, refreshToken);
    setToken(newToken);
  };

  const logout = () => {
    queryClient.cancelQueries();
    queryClient.clear();
    clearTokens();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isLoading,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
