"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Code2 } from "lucide-react"
import type { LearningResource } from "@/lib/study-data"
import { StudentAppShell, type StudentManagementNavigation } from "@/components/student-app-shell"

function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d")
}

type CourseScreenProps = {
  courseName: string
  courseDescription: string
  resources: LearningResource[]
  studentName: string
  studentEmail: string
  studentInitials: string
  onBack: () => void
  onSelectResource: (resource: LearningResource) => void
  onMyDocuments: () => void
  onOpenStats: () => void
  onOpenGuide: () => void
  onLogout: () => void
  managementNavigation: StudentManagementNavigation
}

export function CourseScreen({
  courseName,
  courseDescription,
  resources: allResources,
  studentName,
  studentEmail,
  studentInitials,
  onBack,
  onSelectResource,
  onMyDocuments,
  onOpenStats,
  onOpenGuide,
  onLogout,
  managementNavigation,
}: CourseScreenProps) {
  const [query, setQuery] = useState("")
  const resources = allResources.filter((resource) => resource.course === courseName)
  const normalizedQuery = normalizeSearchText(query.trim())
  const filteredResources = resources.filter((resource) => {
    const searchableText = normalizeSearchText(`${resource.title} ${resource.chapter} ${resource.description}`)
    return !normalizedQuery || searchableText.includes(normalizedQuery)
  })
  const slideCount = resources.reduce((total, resource) => total + resource.slides, 0)

  return (
    <StudentAppShell
      activeSection="home"
      pageTitle={courseName}
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onBack}
      onNavigateMyDocuments={onMyDocuments}
      onNavigateStats={onOpenStats}
      onNavigateGuide={onOpenGuide}
      onLogout={onLogout}
      {...managementNavigation}
    >
      <section className="course-detail-page" aria-labelledby="course-detail-title">
        <button className="student-back-link" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Tất cả môn học
        </button>
        <header className="student-page-heading course-detail-heading">
          <div>
            <p className="student-eyebrow">{resources[0]?.category ?? "MÔN HỌC"}</p>
            <h1 id="course-detail-title">{courseName}</h1>
            <p className="student-page-description">{courseDescription || "Chọn một chương để mở slide bài giảng."}</p>
          </div>
          <span className="course-total">{filteredResources.length}{normalizedQuery ? `/${resources.length}` : ""} bài giảng · {slideCount} slide</span>
        </header>

        {resources.length > 0 && (
          <label className="student-search course-resource-search">
            <BookOpen aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bài giảng, chương..." aria-label={`Tìm bài giảng trong môn ${courseName}`} />
          </label>
        )}

        {filteredResources.length > 0 ? (
          <div className="chapter-list" aria-label={`Bài giảng môn ${courseName}`}>
            {filteredResources.map((resource, index) => (
              <button
                className="chapter-card"
                type="button"
                key={resource.id}
                onClick={() => onSelectResource(resource)}
                aria-label={`Mở ${resource.chapter}: ${resource.title}`}
              >
                <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="chapter-card-content">
                  <span className="chapter-card-label">{resource.chapter} · {resource.slides} slide</span>
                  <strong>{resource.title}</strong>
                  <span className="chapter-card-description">{resource.description}</span>
                </span>
                {resource.hasCode && <span className="chapter-code-tag"><Code2 aria-hidden="true" /> Có thực hành code</span>}
                <span className="chapter-card-arrow"><BookOpen aria-hidden="true" /><ArrowRight aria-hidden="true" /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="student-empty-state">
            <BookOpen aria-hidden="true" />
            <strong>{resources.length ? "Không tìm thấy bài giảng" : "Chưa có bài giảng cho môn học này"}</strong>
            <span>{resources.length ? "Thử tìm theo tên bài, chương hoặc mô tả." : "Hãy quay lại danh sách môn học để chọn nội dung khác."}</span>
          </div>
        )}
      </section>
    </StudentAppShell>
  )
}
