"use client"

import { ArrowRight, BookOpen, Clock3, FileText, MessageCircle } from "lucide-react"
import type { LearningResource } from "@/lib/study-data"
import { StudentAppShell, type StudentManagementNavigation } from "@/components/student-app-shell"

export type MyDocumentItem = {
  resource: LearningResource
  studySeconds: number
  questionCount: number
  lastAccessedAt: number
}

type MyDocumentsScreenProps = {
  documents: MyDocumentItem[]
  studentName: string
  studentEmail: string
  studentInitials: string
  onSelectResource: (resource: LearningResource) => void
  onHome: () => void
  onOpenStats: () => void
  onOpenGuide: () => void
  onLogout: () => void
  managementNavigation: StudentManagementNavigation
}

function formatStudyTime(seconds: number) {
  if (seconds < 60) return seconds > 0 ? "Dưới 1 phút" : "Chưa ghi nhận"
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) return `${minutes} phút`
  return remainingMinutes === 0 ? `${hours} giờ` : `${hours} giờ ${remainingMinutes} phút`
}

export function MyDocumentsScreen({ documents, studentName, studentEmail, studentInitials, onSelectResource, onHome, onOpenStats, onOpenGuide, onLogout, managementNavigation }: MyDocumentsScreenProps) {
  return (
    <StudentAppShell
      activeSection="my-documents"
      pageTitle="Tài liệu của tôi"
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onHome}
      onNavigateMyDocuments={() => {}}
      onNavigateStats={onOpenStats}
      onNavigateGuide={onOpenGuide}
      onLogout={onLogout}
      {...managementNavigation}
    >
      <section className="my-documents-page" aria-labelledby="my-documents-title">
        <header className="student-page-heading">
          <div>
            <p className="student-eyebrow">LỊCH SỬ HỌC TẬP</p>
            <h1 id="my-documents-title">Tài liệu của tôi</h1>
            <p className="student-page-description">Các bài giảng bạn đã mở, thời gian học và số câu hỏi đã trao đổi.</p>
          </div>
          <span className="course-total">{documents.length} tài liệu</span>
        </header>

        {documents.length > 0 ? (
          <div className="history-grid">
            {documents.map(({ resource, studySeconds, questionCount, lastAccessedAt }) => (
              <article className="history-card" key={resource.id}>
                <div className="history-card-heading">
                  <span className="history-file-icon"><FileText aria-hidden="true" /></span>
                  <div>
                    <p>{resource.course} · {resource.chapter}</p>
                    <h2>{resource.title}</h2>
                  </div>
                </div>
                <div className="history-card-meta">
                  <span><Clock3 aria-hidden="true" /> {formatStudyTime(studySeconds)}</span>
                  <span><MessageCircle aria-hidden="true" /> {questionCount} câu hỏi</span>
                  <span className="history-last-opened">
                    Mở gần nhất {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(lastAccessedAt)}
                  </span>
                </div>
                <button className="history-open-button" type="button" onClick={() => onSelectResource(resource)}>
                  Mở tài liệu <ArrowRight aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-empty-state history-empty-state">
            <BookOpen aria-hidden="true" />
            <strong>Chưa có tài liệu nào được truy cập</strong>
            <span>Bài giảng bạn mở sẽ xuất hiện tại đây cùng thời gian học và số câu hỏi.</span>
            <button className="student-primary-button" type="button" onClick={onHome}>Chọn môn học <ArrowRight aria-hidden="true" /></button>
          </div>
        )}
      </section>
    </StudentAppShell>
  )
}
