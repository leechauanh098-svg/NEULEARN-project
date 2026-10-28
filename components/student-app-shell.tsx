"use client"

import type { ReactNode } from "react"
import { ArrowRight, BarChart3, BookOpen, CircleHelp, FileUp, Home, LogOut, UserRound, Users } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

export type StudentSection = "home" | "my-documents" | "study-stats" | null

type StudentAppShellProps = {
  activeSection: StudentSection
  pageTitle: string
  studentName: string
  studentEmail: string
  studentInitials: string
  onNavigateHome: () => void
  onNavigateMyDocuments: () => void
  onNavigateStats: () => void
  onNavigateGuide: () => void
  onOpenAccount: () => void
  onLogout: () => void
  canManageMaterials?: boolean
  isAdmin?: boolean
  onManageMaterials?: () => void
  onManageUsers?: () => void
  topbarActions?: ReactNode
  children: ReactNode
}

export type StudentManagementNavigation = Pick<
  StudentAppShellProps,
  "canManageMaterials" | "isAdmin" | "onManageMaterials" | "onManageUsers" | "onOpenAccount"
>

export function StudentAppShell({
  activeSection,
  pageTitle,
  studentName,
  studentEmail,
  studentInitials,
  onNavigateHome,
  onNavigateMyDocuments,
  onNavigateStats,
  onNavigateGuide,
  onOpenAccount,
  onLogout,
  canManageMaterials = false,
  isAdmin = false,
  onManageMaterials,
  onManageUsers,
  topbarActions,
  children,
}: StudentAppShellProps) {
  return (
    <main className="student-shell">
      <aside className="student-sidebar">
        <div className="student-sidebar-brand">
          <BrandLogo onClick={onNavigateHome} />
        </div>
        <p className="student-sidebar-label">KHÔNG GIAN HỌC TẬP</p>
        <nav className="student-sidebar-nav" aria-label="Điều hướng chính">
          <button
            className={`student-nav-button${activeSection === "home" ? " is-active" : ""}`}
            type="button"
            onClick={onNavigateHome}
            aria-current={activeSection === "home" ? "page" : undefined}
          >
            <Home aria-hidden="true" />
            <span>Trang chủ</span>
          </button>
          <button
            className={`student-nav-button${activeSection === "my-documents" ? " is-active" : ""}`}
            type="button"
            onClick={onNavigateMyDocuments}
            aria-current={activeSection === "my-documents" ? "page" : undefined}
          >
            <BookOpen aria-hidden="true" />
            <span>Tài liệu của tôi</span>
          </button>
          <button
            className={`student-nav-button${activeSection === "study-stats" ? " is-active" : ""}`}
            type="button"
            onClick={onNavigateStats}
            aria-current={activeSection === "study-stats" ? "page" : undefined}
          >
            <BarChart3 aria-hidden="true" />
            <span>Thống kê học tập</span>
          </button>
        </nav>
        {(canManageMaterials || isAdmin) && (
          <nav className="student-sidebar-management" aria-label="Quản lý">
            {canManageMaterials && onManageMaterials && (
              <button className="student-nav-button" type="button" onClick={onManageMaterials}>
                <FileUp aria-hidden="true" />
                <span>Quản lý học liệu</span>
              </button>
            )}
            {isAdmin && onManageUsers && (
              <button className="student-nav-button" type="button" onClick={onManageUsers}>
                <Users aria-hidden="true" />
                <span>Quản lý người dùng</span>
              </button>
            )}
          </nav>
        )}

        <div className="student-sidebar-footer">
          <button className="student-help-card" type="button" onClick={onNavigateGuide}>
            <span className="student-help-icon"><CircleHelp aria-hidden="true" /></span>
            <span className="student-help-copy">
              <strong>Cần trợ giúp?</strong>
              <small>Hướng dẫn học cùng NEULEARN</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button className="student-logout" type="button" onClick={onLogout}>
            <LogOut aria-hidden="true" />
            Đăng xuất
          </button>
          <div className="student-account">
            <button
              className="student-account-avatar-button"
              type="button"
              onClick={onOpenAccount}
              aria-label="Mở quản lý tài khoản"
              title="Quản lý tài khoản"
            >
              <span className="student-account-avatar">{studentInitials || <UserRound aria-hidden="true" />}</span>
            </button>
            <button className="student-account-info" type="button" onClick={onOpenAccount}>
              <span><strong>{studentName}</strong><small>{studentEmail || "Tài khoản học tập"}</small></span>
              <ArrowRight className="student-account-arrow" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="student-main">
        <header className="student-topbar">
          <div className="student-breadcrumb">
            <span>NEULEARN</span>
            <span aria-hidden="true">/</span>
            <strong>{pageTitle}</strong>
          </div>
          {topbarActions ? (
            <div className="student-topbar-actions">{topbarActions}</div>
          ) : (
            <span className="student-topbar-context">KHÔNG GIAN HỌC TẬP</span>
          )}
        </header>
        <div className="student-content">{children}</div>
      </div>
    </main>
  )
}
