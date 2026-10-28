"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { getAuthErrorMessage } from "@/lib/auth-errors"

type ForgotPasswordScreenProps = {
  onBack: () => void
  onSendResetEmail: (email: string) => Promise<void>
}

export function ForgotPasswordScreen({ onBack, onSendResetEmail }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [retryAfter, setRetryAfter] = useState(0)

  useEffect(() => {
    if (retryAfter === 0) return
    const timerId = window.setTimeout(() => setRetryAfter((remaining) => Math.max(0, remaining - 1)), 1000)
    return () => window.clearTimeout(timerId)
  }, [retryAfter])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      await onSendResetEmail(email)
      setSent(true)
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError))
      const message = resetError instanceof Error ? resetError.message.toLocaleLowerCase() : ""
      if (message.includes("rate limit") || message.includes("too many requests") || message.includes("over_email_send_rate_limit")) {
        setRetryAfter(60)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page recovery-page">
      <header className="auth-topbar">
        <BrandLogo onClick={onBack} actionLabel="Quay lại đăng nhập" />
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Quay lại đăng nhập</button>
      </header>

      <div className="recovery-layout">
        <section className="recovery-card" aria-labelledby="recovery-title">
          <span className="recovery-icon"><Mail aria-hidden="true" /></span>
          <p className="auth-card-kicker">KHÔI PHỤC TÀI KHOẢN</p>
          <h1 id="recovery-title">Quên mật khẩu?</h1>
          <p className="recovery-copy">Nhập email sinh viên bạn đã dùng để đăng ký. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.</p>

          {sent ? (
            <div className="recovery-success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <div><strong>Đã gửi yêu cầu khôi phục</strong><span>Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn trong ít phút.</span></div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <label className="form-field">
                <span>Email sinh viên</span>
                <input type="email" name="email" autoComplete="email" placeholder="tenban@st.neu.edu.vn" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="primary-button auth-submit" type="submit" disabled={busy || retryAfter > 0}>
                {busy ? "Đang gửi..." : retryAfter > 0 ? `Thử lại sau ${retryAfter} giây` : "Gửi hướng dẫn đặt lại"}
                {!busy && retryAfter === 0 && <ArrowRight aria-hidden="true" />}
              </button>
            </form>
          )}

          <div className="recovery-security"><ShieldCheck aria-hidden="true" /><span>Thông tin của bạn được bảo vệ an toàn.</span></div>
          <button className="text-button recovery-back" type="button" onClick={onBack}>Quay lại đăng nhập</button>
        </section>
      </div>

      <footer className="auth-footer"><span>© 2026 NEULEARN</span><span>Hỗ trợ học tập dành cho sinh viên</span></footer>
    </main>
  )
}
