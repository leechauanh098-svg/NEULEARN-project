"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react"
import { StudentAppShell } from "@/components/student-app-shell"
import {
  type AdminRole,
  type AdminUser,
  type AdminUserValues,
  type NewAdminUserValues,
} from "@/lib/admin-api"

type AdminUsersScreenProps = {
  currentUserId: string
  studentName: string
  studentEmail: string
  studentInitials: string
  onLoadUsers: () => Promise<AdminUser[]>
  onCreateUser: (values: NewAdminUserValues) => Promise<void>
  onUpdateUser: (userId: string, values: AdminUserValues) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
  onBack: () => void
  onHome: () => void
  onMyDocuments: () => void
  onOpenStats: () => void
  onOpenAccount: () => void
  onLogout: () => void
  onManageUsers: () => void
}

const roleLabels: Record<AdminRole, string> = {
  student: "Sinh viên",
  lecturer: "Giảng viên",
  admin: "Quản trị viên",
}

function formatCreatedDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value))
}

export function AdminUsersScreen({
  currentUserId,
  studentName,
  studentEmail,
  studentInitials,
  onLoadUsers,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onBack,
  onHome,
  onMyDocuments,
  onOpenStats,
  onOpenAccount,
  onLogout,
  onManageUsers,
}: AdminUsersScreenProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AdminRole>("student")
  const [editingUserId, setEditingUserId] = useState("")
  const [editFullName, setEditFullName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<AdminRole>("student")

  const refreshUsers = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setUsers(await onLoadUsers())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách người dùng.")
    } finally {
      setLoading(false)
    }
  }, [onLoadUsers])

  useEffect(() => {
    void refreshUsers()
  }, [refreshUsers])

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onCreateUser({ fullName: fullName.trim(), email: email.trim(), password, role })
      setFullName("")
      setEmail("")
      setPassword("")
      setRole("student")
      setNotice("Đã tạo tài khoản và hồ sơ người dùng.")
      await refreshUsers()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể tạo người dùng.")
    } finally {
      setBusy(false)
    }
  }

  const startEditing = (user: AdminUser) => {
    setEditingUserId(user.id)
    setEditFullName(user.full_name)
    setEditEmail(user.email)
    setEditRole(user.role)
    setError("")
    setNotice("")
  }

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUserId) return

    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onUpdateUser(editingUserId, {
        fullName: editFullName.trim(),
        email: editEmail.trim(),
        role: editRole,
      })
      setEditingUserId("")
      setNotice("Đã cập nhật hồ sơ và phân quyền.")
      await refreshUsers()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật người dùng.")
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (user: AdminUser) => {
    if (!window.confirm(`Xóa tài khoản "${user.email}"? Lịch sử học tập của tài khoản sẽ bị xóa; môn học và tài liệu sẽ chuyển quyền sở hữu cho bạn.`)) return

    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onDeleteUser(user.id)
      setNotice(`Đã xóa tài khoản ${user.email}.`)
      await refreshUsers()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa người dùng.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <StudentAppShell
      activeSection={null}
      pageTitle="Quản lý người dùng"
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onHome}
      onNavigateMyDocuments={onMyDocuments}
      onNavigateStats={onOpenStats}
      onNavigateGuide={onHome}
      onOpenAccount={onOpenAccount}
      onLogout={onLogout}
      canManageMaterials
      isAdmin
      onManageMaterials={onBack}
      onManageUsers={onManageUsers}
    >
      <section className="admin-users-page" aria-labelledby="admin-users-title">
        <button className="student-back-link" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Quay lại quản lý học liệu
        </button>
        <header className="student-page-heading">
          <div>
            <p className="student-eyebrow">QUẢN TRỊ HỆ THỐNG</p>
            <h1 id="admin-users-title">Quản lý người dùng</h1>
            <p className="student-page-description">Tạo tài khoản, cập nhật hồ sơ và phân quyền truy cập.</p>
          </div>
          <span className="admin-users-count"><Users aria-hidden="true" /> {users.length} tài khoản</span>
        </header>

        <div className="admin-users-layout">
          <section className="teacher-panel admin-users-create" aria-labelledby="admin-users-create-title">
            <div className="teacher-panel-heading">
              <span><Plus aria-hidden="true" /></span>
              <div><p className="student-eyebrow">TÀI KHOẢN MỚI</p><h2 id="admin-users-create-title">Tạo người dùng</h2></div>
            </div>
            <form className="auth-form teacher-form" onSubmit={createUser}>
              <label className="form-field">
                <span>Họ và tên</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required maxLength={160} disabled={busy} />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} disabled={busy} />
              </label>
              <label className="form-field">
                <span>Mật khẩu tạm thời (ít nhất 8 ký tự)</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} />
              </label>
              <label className="form-field">
                <span>Vai trò</span>
                <select value={role} onChange={(event) => setRole(event.target.value as AdminRole)} disabled={busy}>
                  {Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <button className="primary-button auth-submit" type="submit" disabled={busy}>
                {busy ? "Đang tạo..." : "Tạo tài khoản"}
              </button>
            </form>
          </section>

          <section className="teacher-panel admin-users-list" aria-labelledby="admin-users-list-title">
            <div className="teacher-panel-heading">
              <span><Users aria-hidden="true" /></span>
              <div><p className="student-eyebrow">DANH SÁCH</p><h2 id="admin-users-list-title">Hồ sơ người dùng</h2></div>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="teacher-success" role="status">{notice}</p>}
            {loading ? (
              <p className="teacher-empty-note" role="status">Đang tải người dùng...</p>
            ) : users.length ? (
              <div className="admin-users-table">
                {users.map((user) => (
                  <article className="admin-user-row" key={user.id}>
                    {editingUserId === user.id ? (
                      <form className="admin-user-edit-form" onSubmit={saveUser}>
                        <label className="form-field"><span>Họ và tên</span><input value={editFullName} onChange={(event) => setEditFullName(event.target.value)} required maxLength={160} disabled={busy} /></label>
                        <label className="form-field"><span>Email</span><input type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required maxLength={254} disabled={busy} /></label>
                        <label className="form-field"><span>Vai trò</span>
                          <select value={editRole} onChange={(event) => setEditRole(event.target.value as AdminRole)} disabled={busy || user.id === currentUserId}>
                            {Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                          </select>
                        </label>
                        {user.id === currentUserId && <small className="admin-user-note">Không thể tự thay đổi vai trò của chính mình.</small>}
                        <div className="teacher-edit-actions">
                          <button className="student-primary-button" type="submit" disabled={busy}><Save aria-hidden="true" /> Lưu</button>
                          <button className="teacher-icon-button" type="button" onClick={() => setEditingUserId("")} aria-label="Hủy sửa" disabled={busy}><X aria-hidden="true" /></button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span className="admin-user-info">
                          <strong>{user.full_name || "Chưa cập nhật tên"}</strong>
                          <small>{user.email}</small>
                          <small>Tạo ngày {formatCreatedDate(user.created_at)}</small>
                        </span>
                        <span className={`admin-user-role is-${user.role}`}>{roleLabels[user.role]}</span>
                        <span className="teacher-course-actions">
                          <button className="teacher-icon-button" type="button" title="Sửa hồ sơ và vai trò" aria-label={`Sửa người dùng ${user.email}`} onClick={() => startEditing(user)} disabled={busy}>
                            <Pencil aria-hidden="true" />
                          </button>
                          <button className="teacher-delete-button" type="button" title="Xóa tài khoản" aria-label={`Xóa người dùng ${user.email}`} onClick={() => void removeUser(user)} disabled={busy || user.id === currentUserId}>
                            <Trash2 aria-hidden="true" />
                          </button>
                        </span>
                      </>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="teacher-empty-note">Chưa có hồ sơ người dùng.</p>
            )}
            {error && <button className="student-primary-button admin-users-retry" type="button" onClick={() => void refreshUsers()} disabled={loading || busy}>Tải lại danh sách</button>}
          </section>
        </div>
      </section>
    </StudentAppShell>
  )
}
