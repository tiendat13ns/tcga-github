import React, { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { TCGAAppIcon } from "./TCGALogo";

type LoginScreenProps = {
  onLoginSuccess: (token: string, refreshToken?: string | null, email?: string) => void;
  initialMode?: "login" | "register";
  onGoToLanding?: () => void;
};


/* ── Animated circuit grid dots (pure CSS, no libs) ─────── */
function GridPattern() {
  return (
    <svg
      className="auth-grid-pattern"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(139,105,20,0.12)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

export default function LoginScreen({ onLoginSuccess, initialMode = "login", onGoToLanding }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  // Bước "2. Verify" thật sự — trước đây stepper có sẵn UI cho bước này nhưng chưa từng
  // được dùng: đăng ký xong (khi Confirm Email đang bật, không có access_token trả về)
  // bị nhảy thẳng về tab Sign In với message chung chung, không hề nhắc user đi check mail.
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState("");

  // Sync URL when switching between login/register
  const switchMode = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setErrorMsg("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
    setAwaitingVerification(false);
    const path = toLogin ? "/login" : "/register";
    window.history.pushState(null, "", path);
  };

  // Listen for browser back/forward on auth pages
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setIsLogin(p !== "/register");
      setAwaitingVerification(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp");
      setLoading(false);
      return;
    }
    // Chỉ validate độ dài/độ phức tạp khi ĐĂNG KÝ — không áp cho đăng nhập, vì user cũ có
    // thể đã tạo mật khẩu từ trước khi policy này được siết chặt (8 ký tự + đủ loại ký tự),
    // validate khi login sẽ khoá nhầm user hợp lệ ra khỏi tài khoản của chính họ.
    if (!isLogin) {
      if (password.length < 8) {
        setErrorMsg("Mật khẩu phải có ít nhất 8 ký tự");
        setLoading(false);
        return;
      }
      const hasLower = /[a-z]/.test(password);
      const hasUpper = /[A-Z]/.test(password);
      const hasDigit = /[0-9]/.test(password);
      const hasSymbol = /[^A-Za-z0-9]/.test(password);
      if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
        setErrorMsg("Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt");
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const contentType = res.headers.get("content-type");
      let data: any = {};
      if (contentType?.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || "Lỗi máy chủ, vui lòng thử lại sau ít phút!");
      }

      if (!res.ok) throw new Error(data.detail || data.message || "Xác thực thất bại");

      if (isLogin) {
        onLoginSuccess(data.access_token, data.refresh_token, email);
      } else {
        if (data.access_token) {
          onLoginSuccess(data.access_token, data.refresh_token, email);
        } else {
          setPendingVerifyEmail(email);
          setAwaitingVerification(true);
          setPassword("");
          setConfirmPassword("");
        }
      }

    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2-root auth2-root--centered">
      {/* Background decorations */}
      <GridPattern />
      <div className="auth2-glow-blob auth2-glow-blob--1" />
      <div className="auth2-glow-blob auth2-glow-blob--2" />

      {onGoToLanding && (
        <button type="button" className="auth2-back-home" onClick={onGoToLanding}>
          <ArrowLeft size={15} /> Về trang chủ
        </button>
      )}

      {/* Centered glass card */}
      <div className="auth2-glass-card">
        {/* Logo */}
        <div className="auth2-brand" style={{ justifyContent: "center", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <TCGAAppIcon size={54} />
          <div style={{ textAlign: "center" }}>
            <span className="auth2-brand-name" style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.04em" }}>TCGA</span>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", fontWeight: 400 }}>Test Case Generation Assistant</div>
          </div>
        </div>

        {awaitingVerification ? (
          <>
            {/* Header */}
            <div className="auth2-form-header">
              <h1 className="auth2-form-title">Check your email</h1>
              <p className="auth2-form-sub">Xác nhận email để hoàn tất đăng ký</p>
            </div>

            {/* Stepper — bước 2 (Verify) đang active */}
            <div className="auth2-stepper">
              <div className="auth2-step">
                <div className="auth2-step-num">1</div>
                <span>Account</span>
              </div>
              <div className="auth2-step-line" />
              <div className="auth2-step active">
                <div className="auth2-step-num">2</div>
                <span>Verify</span>
              </div>
            </div>

            <div className="auth2-msg auth2-msg--success" style={{ marginTop: "16px", alignItems: "flex-start" }}>
              <CheckCircle2 size={15} style={{ marginTop: "2px", flexShrink: 0 }} />
              <span>
                Chúng tôi đã gửi email xác nhận tới <strong>{pendingVerifyEmail}</strong>.
                Vui lòng kiểm tra hộp thư (kể cả mục Spam) và bấm vào link xác nhận trước khi đăng nhập.
              </span>
            </div>

            <button
              type="button"
              className="auth2-submit-btn"
              style={{ marginTop: "16px" }}
              onClick={() => switchMode(true)}
            >
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            {/* Tab switcher */}
            <div className="auth2-tabs">
              <button
                type="button"
                className={`auth2-tab ${isLogin ? "active" : ""}`}
                onClick={() => switchMode(true)}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth2-tab ${!isLogin ? "active" : ""}`}
                onClick={() => switchMode(false)}
              >
                Register
              </button>
              <div className="auth2-tab-indicator" style={{ transform: `translateX(${isLogin ? "0%" : "100%"})` }} />
            </div>

            {/* Header */}
            <div className="auth2-form-header">
              <h1 className="auth2-form-title">
                {isLogin ? "Welcome back" : "Create account"}
              </h1>
              <p className="auth2-form-sub">
                {isLogin ? "Sign in to your workspace" : "Start your test journey for free"}
              </p>
            </div>

            {/* Register stepper */}
            {!isLogin && (
              <div className="auth2-stepper">
                <div className="auth2-step active">
                  <div className="auth2-step-num">1</div>
                  <span>Account</span>
                </div>
                <div className="auth2-step-line" />
                <div className="auth2-step">
                  <div className="auth2-step-num">2</div>
                  <span>Verify</span>
                </div>
              </div>
            )}

            {/* Messages */}
            {successMsg && (
              <div className="auth2-msg auth2-msg--success">
                <CheckCircle2 size={15} />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="auth2-msg auth2-msg--error">
                {errorMsg}
              </div>
            )}

            {/* Form */}
            <form className="auth2-form" onSubmit={handleSubmit}>
              <div className="auth2-field">
                <label className="auth2-label">Email</label>
                <div className="auth2-input-wrap">
                  <Mail size={16} className="auth2-input-icon" />
                  <input
                    type="email"
                    className="auth2-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="auth2-field">
                <div className="auth2-label-row">
                  <label className="auth2-label">Password</label>
                  {isLogin && <span className="auth2-forgot">Forgot?</span>}
                </div>
                <div className="auth2-input-wrap">
                  <Lock size={16} className="auth2-input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="auth2-input"
                    placeholder={isLogin ? "Enter your password" : "Min. 8 characters, mix of upper/lower/digit/symbol"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isLogin ? undefined : 8}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="auth2-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="auth2-field">
                  <label className="auth2-label">Confirm Password</label>
                  <div className="auth2-input-wrap">
                    <Lock size={16} className="auth2-input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="auth2-input"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="auth2-submit-btn" disabled={loading}>
                {loading ? (
                  <Loader2 size={18} className="auth2-spinner" />
                ) : isLogin ? (
                  "Sign In"
                ) : (
                  <>Continue <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p className="auth2-switch-text">
              {isLogin ? (
                <>Don't have an account?{" "}
                  <span className="auth2-switch-link" onClick={() => switchMode(false)}>Create one</span>
                </>
              ) : (
                <>Already registered?{" "}
                  <span className="auth2-switch-link" onClick={() => switchMode(true)}>Sign in</span>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
