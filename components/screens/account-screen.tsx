"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, BarChart3, BookOpen, Check, UserRound } from "lucide-react"
import { StudentAppShell, type StudentManagementNavigation } from "@/components/student-app-shell"

type AccountScreenProps = {
  studentName: string
  studentEmail: string
  studentInitials: string
  studentRole: "student" | "lecturer" | "admin"
  onSaveName: (fullName: string) => Promise<void>
  onHome: () => void
  onMyDocuments: () => void
  onOpenStats: () => void
  onOpenGuide: () => void
  onLogout: () => void
  managementNavigation: StudentManagementNavigation
}

const roleLabels = {
  student: "Sinh viên",
  lecturer: "Giảng viên",
  admin: "Quản trị viên",
}

export function AccountScreen({
  studentName,
  studentEmail,
  studentInitials,
  studentRole,
  onSaveName,
  onHome,
  onMyDocuments,
  onOpenStats,
  onOpenGuide,
  onLogout,
  managementNavigation,
}: AccountScreenProps) {
  const [fullName, setFullName] = useState(studentName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setError("Vui lòng nhập họ tên.")
      return
    }

    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onSaveName(trimmedName)
      setNotice("Đã cập nhật tên tài khoản.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể cập nhật tên tài khoản.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <StudentAppShell
      activeSection={null}
      pageTitle="Quản lý tài khoản"
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onHome}
      onNavigateMyDocuments={onMyDocuments}
      onNavigateStats={onOpenStats}
      onNavigateGuide={onOpenGuide}
      onLogout={onLogout}
      {...managementNavigation}
    >
      <section className="account-page" aria-labelledby="account-page-title">
        <header className="student-page-heading">
          <div>
            <p className="student-eyebrow">HỒ SƠ CÁ NHÂN</p>
            <h1 id="account-page-title">Quản lý tài khoản</h1>
            <p className="student-page-description">Cập nhật tên hiển thị và xem lại hoạt động học tập của bạn.</p>
          </div>
        </header>

        <div className="account-layout">
          <section className="teacher-panel account-profile-panel" aria-labelledby="account-profile-title">
            <div className="account-profile-heading">
              <span className="account-profile-avatar">{studentInitials || <UserRound aria-hidden="true" />}</span>
              <div>
                <p className="student-eyebrow">{roleLabels[studentRole]}</p>
                <h2 id="account-profile-title">{studentName}</h2>
                <p>{studentEmail}</p>
              </div>
            </div>

            <form className="auth-form teacher-form account-name-form" onSubmit={saveName}>
              <label className="form-field">
                <span>Họ và tên hiển thị</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                  maxLength={160}
                  disabled={busy}
                />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {notice && <p className="teacher-success" role="status"><Check aria-hidden="true" /> {notice}</p>}
              <button className="primary-button auth-submit" type="submit" disabled={busy || fullName.trim() === studentName}>
                {busy ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </form>
          </section>

          <section className="teacher-panel account-links-panel" aria-labelledby="account-links-title">
            <div className="teacher-panel-heading">
              <span><UserRound aria-hidden="true" /></span>
              <div><p className="student-eyebrow">KHÔNG GIAN CỦA BẠN</p><h2 id="account-links-title">Hoạt động học tập</h2></div>
            </div>
            <button className="account-link-card" type="button" onClick={onMyDocuments}>
              <span className="account-link-icon"><BookOpen aria-hidden="true" /></span>
              <span><strong>Tài liệu của tôi</strong><small>Xem các bài giảng đã truy cập</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button className="account-link-card" type="button" onClick={onOpenStats}>
              <span className="account-link-icon"><BarChart3 aria-hidden="true" /></span>
              <span><strong>Thống kê học tập</strong><small>Theo dõi thời gian học và tài liệu mỗi ngày</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
          </section>
        </div>
      </section>
    </StudentAppShell>
  )
}
