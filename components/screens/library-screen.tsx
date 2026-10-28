"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, BookOpen, Check, Clock3, FileText, Search, Sparkles } from "lucide-react"
import type { LearningResource, ManagedCourse } from "@/lib/study-data"
import { StudentAppShell } from "@/components/student-app-shell"

type StudyHistorySummary = {
  resource: LearningResource
  studySeconds: number
  questionCount: number
  lastAccessedAt: number
}

type LibraryScreenProps = {
  studyHistory: StudyHistorySummary[]
  resources: LearningResource[]
  managedCourses: ManagedCourse[]
  profileLoadError: string
  learningContentLoaded: boolean
  learningContentError: string
  onRetryLearningContent: () => Promise<void>
  studentName: string
  studentEmail: string
  studentInitials: string
  todayStudySeconds: number
  canManageMaterials: boolean
  isAdmin: boolean
  onHome: () => void
  onManageMaterials: () => void
  onManageUsers: () => void
  onOpenAccount: () => void
  onOpenCourse: (course: string) => void
  onSelectResource: (resource: LearningResource) => void
  onMyDocuments: () => void
  onOpenStats: () => void
  onOpenGuide: () => void
  onLogout: () => void
}

type CourseGroup = ManagedCourse & {
  resources: LearningResource[]
}

function formatStudyTime(seconds: number) {
  if (seconds < 60) return seconds > 0 ? "Dưới 1 phút" : "0 phút"

  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) return `${minutes} phút`
  return remainingMinutes === 0 ? `${hours} giờ` : `${hours} giờ ${remainingMinutes} phút`
}

function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d")
}

function getCourseTone(category: string): "blue" | "mint" | "coral" | "violet" | "gold" {
  const normalizedCategory = normalizeSearchText(category)

  if (normalizedCategory.includes("lap trinh") || normalizedCategory.includes("phat trien phan mem")) return "mint"
  if (normalizedCategory.includes("mang") || normalizedCategory.includes("he thong")) return "blue"
  if (normalizedCategory.includes("du lieu")) return "violet"
  if (normalizedCategory.includes("toan") || normalizedCategory.includes("khoa hoc")) return "gold"
  if (normalizedCategory.includes("phan cung") || normalizedCategory.includes("phan tich")) return "coral"
  return "blue"
}

function formatLastAccessed(timestamp: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

export function LibraryScreen({ studyHistory, resources, managedCourses, profileLoadError, learningContentLoaded, learningContentError, onRetryLearningContent, studentName, studentEmail, studentInitials, todayStudySeconds, canManageMaterials, isAdmin, onHome, onManageMaterials, onManageUsers, onOpenAccount, onOpenCourse, onSelectResource, onMyDocuments, onOpenStats, onOpenGuide, onLogout }: LibraryScreenProps) {
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("Tất cả")
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const courses = useMemo(() => {
    const grouped = new Map<string, CourseGroup>()

    for (const resource of resources) {
      const key = resource.course.toLocaleLowerCase("vi")
      const group = grouped.get(key) ?? {
        id: resource.courseId ?? key,
        name: resource.course,
        category: resource.category,
        description: resource.description,
        resources: [],
      }
      group.resources.push(resource)
      grouped.set(key, group)
    }

    for (const course of managedCourses) {
      const key = course.name.toLocaleLowerCase("vi")
      const group = grouped.get(key)
      if (group) {
        group.id = course.id
        group.category = course.category
        group.description = course.description || group.description
      } else {
        grouped.set(key, { ...course, resources: [] })
      }
    }

    return Array.from(grouped.values())
  }, [managedCourses, resources])

  const categories = ["Tất cả", ...new Set(courses.map((course) => course.category))]
  const normalizedQuery = normalizeSearchText(query.trim())
  const filteredCourses = courses.filter((course) => {
    const matchesCategory = selectedCategory === "Tất cả" || course.category === selectedCategory
    const searchableText = normalizeSearchText(`${course.name} ${course.category} ${course.description} ${course.resources.map((resource) => `${resource.title} ${resource.chapter} ${resource.description}`).join(" ")}`)
    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery))
  })
  const matchedResources = normalizedQuery
    ? resources.filter((resource) => {
      const searchableText = normalizeSearchText(`${resource.title} ${resource.chapter} ${resource.description} ${resource.course} ${resource.category}`)
      return searchableText.includes(normalizedQuery)
    })
    : []
  const searchCourses = normalizedQuery
    ? courses.filter((course) => {
      const searchableText = normalizeSearchText(`${course.name} ${course.category} ${course.description}`)
      return searchableText.includes(normalizedQuery)
    }).slice(0, 5)
    : []
  const stats = [
    { label: "Môn học", value: String(courses.length), detail: "Tất cả học phần", icon: BookOpen, tone: "coral" },
    { label: "Thời gian học", value: formatStudyTime(todayStudySeconds), detail: "Hôm nay", icon: Clock3, tone: "blue" },
    { label: "Tài liệu đã truy cập", value: String(studyHistory.length), detail: "Được lưu trong tài liệu của tôi", icon: Check, tone: "gold" },
  ]

  const scrollToCourses = () => {
    document.getElementById("course-list")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    if (!searchOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }

    window.addEventListener("pointerdown", closeOnOutsideClick)
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick)
  }, [searchOpen])

  return (
    <StudentAppShell
      activeSection="home"
      pageTitle="Trang chủ"
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onHome}
      onNavigateMyDocuments={onMyDocuments}
      onNavigateStats={onOpenStats}
      onNavigateGuide={onOpenGuide}
      onOpenAccount={onOpenAccount}
      onLogout={onLogout}
      canManageMaterials={canManageMaterials}
      isAdmin={isAdmin}
      onManageMaterials={onManageMaterials}
      onManageUsers={onManageUsers}
      topbarActions={
        <>
          <div className="home-search-wrap" ref={searchWrapRef}>
            <label className="student-search home-topbar-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false)
                }}
                placeholder="Tìm môn học, bài giảng..."
                aria-label="Tìm môn học hoặc bài giảng"
                aria-expanded={searchOpen && Boolean(normalizedQuery)}
                aria-controls="home-search-popover"
              />
            </label>
            {searchOpen && normalizedQuery && (
              <div className="home-search-popover" id="home-search-popover" role="region" aria-label="Kết quả tìm kiếm">
                {searchCourses.length > 0 && (
                  <section className="home-search-group" aria-label="Môn học">
                    <p className="home-search-group-title">Môn học</p>
                    {searchCourses.map((course) => (
                      <button className="home-search-result" type="button" key={course.id} onClick={() => {
                        setSearchOpen(false)
                        onOpenCourse(course.name)
                      }}>
                        <BookOpen aria-hidden="true" />
                        <span><strong>{course.name}</strong><small>{course.category} · {course.resources.length} bài giảng</small></span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                )}
                {matchedResources.length > 0 && (
                  <section className="home-search-group" aria-label="Bài giảng">
                    <p className="home-search-group-title">Bài giảng</p>
                    {matchedResources.slice(0, 6).map((resource) => (
                      <button className="home-search-result" type="button" key={resource.id} onClick={() => {
                        setSearchOpen(false)
                        setQuery("")
                        onSelectResource(resource)
                      }}>
                        <FileText aria-hidden="true" />
                        <span><strong>{resource.title}</strong><small>{resource.course} · {resource.chapter}</small></span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    ))}
                  </section>
                )}
                {searchCourses.length === 0 && matchedResources.length === 0 && (
                  <p className="home-search-empty">Không tìm thấy môn học hoặc bài giảng.</p>
                )}
              </div>
            )}
          </div>
          <span className="home-topbar-avatar" aria-hidden="true">{studentInitials}</span>
        </>
      }
    >
      <div className="home-dashboard">
        <section className="home-welcome" aria-labelledby="home-welcome-title">
          <div className="home-welcome-copy">
            <p className="home-welcome-eyebrow"><span className="home-welcome-dot" /> NEULEARN · KHÔNG GIAN HỌC TẬP</p>
            <h1 id="home-welcome-title">Xin chào, {studentName}</h1>
            <p>Sẵn sàng cho một buổi học thật hiệu quả?</p>
            <button className="home-welcome-cta" type="button" onClick={scrollToCourses}>
              Khám phá môn học <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <div className="home-welcome-visual" aria-hidden="true">
            <span className="home-orbit-large" />
            <span className="home-orbit-small" />
            <span className="home-book-icon"><BookOpen /></span>
            <Sparkles className="home-welcome-spark" />
            <span className="home-progress-note">
              <span className="home-progress-note-icon"><Sparkles /></span>
              <span><strong>Mỗi ngày một tiến bộ</strong><small>Học theo nhịp của bạn</small></span>
            </span>
          </div>
        </section>

        <section className="home-stat-grid" aria-label="Tổng quan học tập">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <article className={`home-stat-card home-stat-${stat.tone}`} key={stat.label}>
                <span className={`home-stat-icon tone-${stat.tone}`}><Icon aria-hidden="true" /></span>
                <div className="home-stat-copy">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.detail}</small>
                </div>
              </article>
            )
          })}
        </section>

        <section className="home-activity-section" aria-labelledby="home-activity-title">
          <header className="home-activity-heading">
            <div>
              <h2 id="home-activity-title">Hoạt động gần đây</h2>
              <p>Các bài giảng bạn vừa mở trên toàn bộ môn học</p>
            </div>
            {studyHistory.length > 0 && <button className="home-activity-more" type="button" onClick={onMyDocuments}>Xem tất cả <ArrowRight aria-hidden="true" /></button>}
          </header>

          {studyHistory.length > 0 ? (
            <div className="home-activity-list">
              {studyHistory.slice(0, 3).map(({ resource, studySeconds, questionCount, lastAccessedAt }) => (
                <button className="home-activity-row" type="button" key={resource.id} onClick={() => onSelectResource(resource)}>
                  <span className="home-activity-icon"><FileText aria-hidden="true" /></span>
                  <span className="home-activity-main">
                    <strong>{resource.title}</strong>
                    <small>{resource.course} · {resource.chapter}</small>
                  </span>
                  <span className="home-activity-meta">{formatStudyTime(studySeconds)} · {questionCount} câu hỏi</span>
                  <time dateTime={new Date(lastAccessedAt).toISOString()}>{formatLastAccessed(lastAccessedAt)}</time>
                </button>
              ))}
            </div>
          ) : (
            <div className="home-activity-empty">
              <p>Chưa có lịch sử học. Hãy bắt đầu từ danh sách môn học hoặc xem tài liệu của bạn.</p>
              <div className="home-activity-actions">
                <button className="home-activity-primary" type="button" onClick={scrollToCourses}>Bắt đầu học</button>
                <button className="home-activity-secondary" type="button" onClick={onMyDocuments}>Tài liệu của tôi</button>
              </div>
            </div>
          )}
        </section>

        <section className="home-course-section" id="course-list" aria-labelledby="home-course-title">
          {profileLoadError && (
            <p className="auth-error" role="alert">
              Không tải được hồ sơ và quyền tài khoản: {profileLoadError} Hãy đăng nhập lại sau khi khởi động Flask.
            </p>
          )}
          <header className="home-course-heading">
            <div>
              <h2 id="home-course-title">Môn học của bạn</h2>
              <p className="student-page-description">Mở một môn học để xem slide bài giảng theo từng chương.</p>
            </div>
            <p className="home-course-count"><FileText aria-hidden="true" /> {courses.length} môn học</p>
          </header>

          {learningContentError && (
            <div className="student-empty-state" role="alert">
              <strong>Không tải được danh sách môn học</strong>
              <span>{learningContentError}</span>
              <button className="primary-button" type="button" onClick={() => void onRetryLearningContent()}>
                Tải lại danh sách
              </button>
            </div>
          )}

          <div className="home-course-toolbar">
            <div className="home-course-filters" role="group" aria-label="Lọc môn học theo lĩnh vực">
              {categories.map((category) => (
                <button
                  className={`home-filter-button${selectedCategory === category ? " is-active" : ""}`}
                  type="button"
                  key={category}
                  aria-pressed={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {filteredCourses.length > 0 ? (
            <div className="course-grid home-course-grid">
              {filteredCourses.map((course) => {
                const slideCount = course.resources.reduce((total, resource) => total + resource.slides, 0)

                return (
                  <button
                    className={`course-card course-tone-${getCourseTone(course.category)}`}
                    type="button"
                    key={course.name}
                    onClick={() => onOpenCourse(course.name)}
                    aria-label={`Mở môn học ${course.name}`}
                  >
                    <span className="course-card-topline">
                      <span className="course-card-icon"><BookOpen aria-hidden="true" /></span>
                      <span className="course-category">{course.category}</span>
                    </span>
                    <span className="course-card-title">{course.name}</span>
                    <span className="course-card-description">{course.description || "Chưa có mô tả cho môn học này."}</span>
                    <span className="course-card-meta">
                      <span>{course.resources.length ? `${course.resources.length} bài giảng` : "Chưa có bài giảng"}</span>
                      <span>{slideCount} slide</span>
                      <ArrowRight aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
            </div>
          ) : !learningContentError && !learningContentLoaded ? (
            <div className="student-empty-state" role="status">
              <strong>Đang tải danh sách môn học...</strong>
            </div>
          ) : !learningContentError ? (
            <div className="student-empty-state">
              <Search aria-hidden="true" />
              <strong>{normalizedQuery ? "Không tìm thấy môn học" : "Chưa có môn học"}</strong>
              <span>{normalizedQuery ? "Thử tên môn, tên bài giảng hoặc chương." : "Hãy liên hệ quản trị viên hoặc giảng viên để thêm môn học."}</span>
            </div>
          ) : null}

          {normalizedQuery && matchedResources.length > 0 && (
            <section className="home-search-results" aria-labelledby="home-search-results-title">
              <header className="home-course-heading">
                <div>
                  <p className="student-eyebrow">TÀI LIỆU PHÙ HỢP</p>
                  <h2 id="home-search-results-title">Bài giảng</h2>
                </div>
                <p className="home-course-count"><FileText aria-hidden="true" /> {matchedResources.length} kết quả</p>
              </header>
              <div className="chapter-list">
                {matchedResources.map((resource) => (
                  <button className="chapter-card" type="button" key={resource.id} onClick={() => onSelectResource(resource)}>
                    <span className="chapter-index"><FileText aria-hidden="true" /></span>
                    <span className="chapter-card-content">
                      <span className="chapter-card-label">{resource.course} · {resource.chapter}</span>
                      <strong>{resource.title}</strong>
                      <span className="chapter-card-description">{resource.description}</span>
                    </span>
                    <span className="chapter-card-arrow"><BookOpen aria-hidden="true" /><ArrowRight aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </StudentAppShell>
  )
}
