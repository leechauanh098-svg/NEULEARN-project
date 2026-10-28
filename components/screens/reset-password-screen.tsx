"use client"

import { useEffect, useState } from "react"
import { ArrowRight, KeyRound } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { getAuthErrorMessage } from "@/lib/auth-errors"

type ResetPasswordScreenProps = {
  onUpdatePassword: (password: string) => Promise<void>
  onBack: () => void
  onHome: () => void
}

export function ResetPasswordScreen({ onUpdatePassword, onBack, onHome }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.slice(1))
    if (url.searchParams.has("error") || url.searchParams.has("error_code") || hashParams.has("error") || hashParams.has("error_code")) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy gửi lại yêu cầu khôi phục mật khẩu.")
    }
  }, [])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (password !== confirmation) {
      setError("Mật khẩu xác nhận chưa khớp.")
      return
    }

    setBusy(true)
    try {
      await onUpdatePassword(password)
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError))
      setBusy(false)
    }
  }

  return (
    <main className="auth-page recovery-page">
      <header className="auth-topbar">
        <BrandLogo onClick={onHome} />
        <button className="back-link" type="button" onClick={onBack}>Quay lại đăng nhập</button>
      </header>

      <div className="recovery-layout">
        <section className="recovery-card" aria-labelledby="reset-title">
          <span className="recovery-icon"><KeyRound aria-hidden="true" /></span>
          <p className="auth-card-kicker">BẢO MẬT TÀI KHOẢN</p>
          <h1 id="reset-title">Đặt mật khẩu mới</h1>
          <p className="recovery-copy">Chọn mật khẩu mới có ít nhất 8 ký tự để tiếp tục sử dụng tài khoản.</p>

          <form className="auth-form" onSubmit={submit}>
            <label className="form-field">
              <span>Mật khẩu mới</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required disabled={busy} />
            </label>
            <label className="form-field">
              <span>Nhập lại mật khẩu</span>
              <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required disabled={busy} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Đang cập nhật..." : "Lưu mật khẩu mới"} {!busy && <ArrowRight aria-hidden="true" />}</button>
          </form>
        </section>
      </div>

      <footer className="auth-footer"><span>© 2026 NEULEARN</span><span>Hỗ trợ học tập dành cho sinh viên</span></footer>
    </main>
  )
}