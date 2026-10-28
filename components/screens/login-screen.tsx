"use client"

import { useState } from "react"
import { ArrowRight, BookOpenCheck, Check, Eye, EyeOff, GraduationCap, Sparkles } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { getAuthErrorMessage } from "@/lib/auth-errors"

type LoginScreenProps = {
  onLogin: (email: string, password: string) => Promise<void>
  onMicrosoftLogin: () => Promise<void>
  onForgot: () => void
}

export function LoginScreen({ onLogin, onMicrosoftLogin, onForgot }: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setBusy(true)

    const formData = new FormData(event.currentTarget)
    try {
      await onLogin(String(formData.get("email")), String(formData.get("password")))
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError))
    } finally {
      setBusy(false)
    }
  }

  const submitMicrosoftLogin = async () => {
    setError("")
    setBusy(true)
    try {
      await onMicrosoftLogin()
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError))
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <BrandLogo />
        <span className="auth-top-note">Không gian học tập dành cho bạn</span>
      </header>

      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-heading">
          <div className="auth-eyebrow"><Sparkles aria-hidden="true" /> HỌC TẬP THEO CÁCH CỦA BẠN</div>
          <h1 id="auth-heading">Làm chủ tri thức, <span>định hình tương lai.</span></h1>
          <p className="auth-intro">Bài giảng theo môn học, hỏi đáp theo tài liệu và không gian thực hành code - tất cả ở một nơi để bạn học chủ động hơn mỗi ngày.</p>

          <div className="auth-feature-list">
            <div className="auth-feature"><span><BookOpenCheck aria-hidden="true" /></span><div><strong>Tài liệu luôn trong tầm tay</strong><small>Học theo slide của từng môn học</small></div></div>
            <div className="auth-feature"><span><GraduationCap aria-hidden="true" /></span><div><strong>Ôn tập theo nhịp của bạn</strong><small>Quiz và sơ đồ tư duy từ nội dung bài</small></div></div>
          </div>

          <div className="auth-orbit" aria-hidden="true">
            <div className="orbit-circle orbit-circle-large" />
            <div className="orbit-circle orbit-circle-small" />
            <div className="orbit-book"><BookOpenCheck /></div>
            <span className="orbit-spark orbit-spark-one"><Sparkles /></span>
            <span className="orbit-spark orbit-spark-two"><Sparkles /></span>
            <div className="orbit-caption"><span className="orbit-caption-check"><Check /></span><span><strong>Mỗi ngày tiến bộ hơn</strong><small>Gợi ý học tập dành riêng cho bạn</small></span></div>
          </div>
        </section>

        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-card-heading">
            <span className="auth-card-icon"><GraduationCap aria-hidden="true" /></span>
            <div>
              <p className="auth-card-kicker">CHÀO MỪNG TRỞ LẠI</p>
              <h2 id="login-title">Đăng nhập</h2>
            </div>
          </div>
          <p className="auth-card-copy">Tiếp tục hành trình học tập của bạn.</p>

          <form className="auth-form" onSubmit={submitLogin}>
            <label className="form-field">
              <span>Email sinh viên</span>
              <input type="email" name="email" autoComplete="username" placeholder="tenban@st.neu.edu.vn" required disabled={busy} />
            </label>
            <label className="form-field">
              <span>Mật khẩu</span>
              <span className="password-field">
                <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required minLength={6} disabled={busy} />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} disabled={busy}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </span>
            </label>
            <div className="auth-form-meta">
              <button className="text-button" type="button" onClick={onForgot}>Quên mật khẩu?</button>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Đang đăng nhập..." : "Đăng nhập"} {!busy && <ArrowRight aria-hidden="true" />}</button>
          </form>

          <div className="auth-divider"><span>hoặc tiếp tục với</span></div>
          <button className="secondary-button microsoft-button" type="button" onClick={submitMicrosoftLogin} disabled={busy}>
            <span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span>
            {busy ? "Đang kết nối..." : "Microsoft (NEU)"}
          </button>
          <p className="demo-note">Sử dụng tài khoản học tập được cấp bởi trường.</p>
        </section>
      </div>

      <footer className="auth-footer"><span>© 2026 NEULEARN</span><span>Học tốt hơn, mỗi ngày một chút.</span></footer>
    </main>
  )
}
