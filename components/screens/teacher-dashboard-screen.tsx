"use client"

import { useRef, useState, type FormEvent } from "react"
import { ArrowLeft, FileUp, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react"
import type { LearningResource, ManagedCourse } from "@/lib/study-data"
import { getPdfPageCount } from "@/lib/pdf-page-count"
import { StudentAppShell } from "@/components/student-app-shell"

export type BulkUploadMaterialInput = {
  courseName: string
  category: string
  title: string
  chapter: string
  description: string
  slideCount: number
  file: File
}

export type BulkUploadResult = {
  uploaded: number
  failed: string[]
}

export type CourseImportInput = {
  course: string
  category: string
  description: string
}

export type CourseImportResult = {
  created: number
  skipped: number
  failed: string[]
}

function getPdfTitle(file: File) {
  return file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 180)
}

type TeacherDashboardScreenProps = {
  courses: ManagedCourse[]
  resources: LearningResource[]
  currentUserId: string
  isAdmin: boolean
  studentName: string
  studentEmail: string
  studentInitials: string
  onCreateCourse: (name: string, category: string, description: string) => Promise<void>
  onBulkImport: (inputs: BulkUploadMaterialInput[]) => Promise<BulkUploadResult>
  onBulkImportCourses: (courses: CourseImportInput[]) => Promise<CourseImportResult>
  onDeleteMaterial: (resourceId: string) => Promise<void>
  onDeleteCourse: (courseId: string) => Promise<void>
  onUpdateCourse: (courseId: string, values: { name: string; category: string; description: string }) => Promise<void>
  onUpdateMaterial: (resourceId: string, values: { title: string; chapter: string; description: string; slideCount: number }) => Promise<void>
  onManageMaterials: () => void
  onManageUsers: () => void
  onHome: () => void
  onMyDocuments: () => void
  onOpenStats: () => void
  onOpenAccount: () => void
  onLogout: () => void
}

export function TeacherDashboardScreen({
  courses,
  resources,
  currentUserId,
  isAdmin,
  studentName,
  studentEmail,
  studentInitials,
  onCreateCourse,
  onBulkImport,
  onBulkImportCourses,
  onDeleteMaterial,
  onDeleteCourse,
  onUpdateCourse,
  onUpdateMaterial,
  onManageMaterials,
  onManageUsers,
  onHome,
  onMyDocuments,
  onOpenStats,
  onOpenAccount,
  onLogout,
}: TeacherDashboardScreenProps) {
  const [courseName, setCourseName] = useState("")
  const [category, setCategory] = useState("")
  const [courseDescription, setCourseDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [bulkTitles, setBulkTitles] = useState<string[]>([])
  const [bulkCourseId, setBulkCourseId] = useState("")
  const [bulkChapter, setBulkChapter] = useState("")
  const [bulkDescription, setBulkDescription] = useState("")
  const [bulkFailures, setBulkFailures] = useState<string[]>([])
  const bulkPdfInput = useRef<HTMLInputElement>(null)
  const [courseJsonRows, setCourseJsonRows] = useState<CourseImportInput[]>([])
  const [courseJsonError, setCourseJsonError] = useState("")
  const [courseJsonNotice, setCourseJsonNotice] = useState("")
  const [courseJsonFailures, setCourseJsonFailures] = useState<string[]>([])
  const [editingItem, setEditingItem] = useState<{ kind: "course"; id: string } | { kind: "material"; id: string } | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editChapter, setEditChapter] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editSlideCount, setEditSlideCount] = useState(1)

  const createCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onCreateCourse(courseName.trim(), category.trim(), courseDescription.trim())
      setCourseName("")
      setCategory("")
      setCourseDescription("")
      setNotice("Đã tạo môn học.")
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể tạo môn học.")
    } finally {
      setBusy(false)
    }
  }

  const importBulk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setNotice("")
    setBulkFailures([])

    const course = courses.find((item) => item.id === bulkCourseId)
    if (!course) {
      setError("Chọn môn học trước khi tải tài liệu.")
      return
    }
    if (!pdfFiles.length) {
      setError("Chọn ít nhất một file PDF.")
      return
    }

    setBusy(true)
    const uploadInputs: BulkUploadMaterialInput[] = []
    const failures: string[] = []

    try {
      for (const [index, file] of pdfFiles.entries()) {
        const title = bulkTitles[index]?.trim() ?? getPdfTitle(file)
        if (!title) {
          failures.push(`${file.name}: tên file không tạo được tên bài giảng hợp lệ.`)
          continue
        }
        try {
          const slideCount = await getPdfPageCount(file)
          uploadInputs.push({
            courseName: course.name,
            category: course.category,
            title,
            chapter: bulkChapter.trim(),
            description: bulkDescription.trim(),
            slideCount,
            file,
          })
        } catch (fileError) {
          failures.push(`${file.name}: ${fileError instanceof Error ? fileError.message : "Không đọc được PDF."}`)
        }
      }

      if (uploadInputs.length) {
        const result = await onBulkImport(uploadInputs)
        failures.push(...result.failed)
        setNotice(`Đã tải ${result.uploaded}/${pdfFiles.length} PDF.`)
      }
    } catch (importError) {
      failures.push(importError instanceof Error ? importError.message : "Không thể nhập tài liệu.")
    } finally {
      setBusy(false)
    }

    setBulkFailures(failures)
    setPdfFiles([])
    setBulkTitles([])
    if (bulkPdfInput.current) bulkPdfInput.current.value = ""
    setBulkChapter("")
    setBulkDescription("")
  }

  const readCourseJson = async (file?: File) => {
    setCourseJsonRows([])
    setCourseJsonError("")
    setCourseJsonNotice("")
    setCourseJsonFailures([])
    if (!file) return

    try {
      if (!file.name.toLocaleLowerCase().endsWith(".json")) throw new Error("File môn học phải có đuôi .json.")
      const parsed: unknown = JSON.parse(await file.text())
      const rawCourses = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "courses" in parsed && Array.isArray(parsed.courses)
          ? parsed.courses
          : []
      if (!rawCourses.length) throw new Error("JSON chưa có môn học. Dùng mảng hoặc object có thuộc tính courses.")

      const rows = rawCourses.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Môn ở vị trí ${index + 1} không hợp lệ.`)
        const row = raw as Record<string, unknown>
        const course = String(row.course ?? "").trim()
        const courseCategory = String(row.category ?? "").trim()
        const description = String(row.description ?? "").trim()
        if (!course || !courseCategory) throw new Error(`Môn ở vị trí ${index + 1} cần có course và category.`)
        return { course, category: courseCategory, description }
      })

      const seen = new Set<string>()
      for (const row of rows) {
        const key = row.course.toLocaleLowerCase("vi")
        if (seen.has(key)) throw new Error(`Môn "${row.course}" bị lặp trong JSON.`)
        seen.add(key)
      }

      setCourseJsonRows(rows)
      setCourseJsonNotice(`Đã đọc ${rows.length} môn học.`)
    } catch (parseError) {
      setCourseJsonError(parseError instanceof Error ? parseError.message : "Không đọc được JSON môn học.")
    }
  }

  const importCourses = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCourseJsonError("")
    setCourseJsonNotice("")
    setCourseJsonFailures([])
    if (!courseJsonRows.length) {
      setCourseJsonError("Chọn file JSON môn học hợp lệ trước.")
      return
    }

    setBusy(true)
    try {
      const result = await onBulkImportCourses(courseJsonRows)
      setCourseJsonNotice(`Đã thêm ${result.created} môn; bỏ qua ${result.skipped} môn đã có.`)
      setCourseJsonFailures(result.failed)
    } catch (importError) {
      setCourseJsonError(importError instanceof Error ? importError.message : "Không nhập được danh sách môn học.")
    } finally {
      setBusy(false)
    }
  }

  const removeMaterial = async (resource: LearningResource) => {
    if (!window.confirm(`Xóa tài liệu "${resource.title}"? Thao tác này không thể hoàn tác.`)) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onDeleteMaterial(resource.id)
      setNotice(`Đã xóa tài liệu "${resource.title}".`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa tài liệu.")
    } finally {
      setBusy(false)
    }
  }

  const removeCourse = async (course: ManagedCourse) => {
    if (!window.confirm(`Xóa môn "${course.name}"?`)) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await onDeleteCourse(course.id)
      setNotice(`Đã xóa môn "${course.name}".`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa môn học.")
    } finally {
      setBusy(false)
    }
  }

  const editCourse = (course: ManagedCourse) => {
    setEditingItem({ kind: "course", id: course.id })
    setEditTitle(course.name)
    setEditCategory(course.category)
    setEditDescription(course.description)
    setError("")
    setNotice("")
  }

  const editMaterial = (resource: LearningResource) => {
    setEditingItem({ kind: "material", id: resource.id })
    setEditTitle(resource.title)
    setEditChapter(resource.chapter)
    setEditDescription(resource.description)
    setEditSlideCount(resource.slides)
    setError("")
    setNotice("")
  }

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingItem) return

    setBusy(true)
    setError("")
    setNotice("")
    try {
      if (editingItem.kind === "course") {
        await onUpdateCourse(editingItem.id, {
          name: editTitle.trim(),
          category: editCategory.trim(),
          description: editDescription.trim(),
        })
      } else {
        await onUpdateMaterial(editingItem.id, {
          title: editTitle.trim(),
          chapter: editChapter.trim(),
          description: editDescription.trim(),
          slideCount: editSlideCount,
        })
        setNotice("Đã cập nhật thông tin bài giảng.")
      }
      setEditingItem(null)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật thông tin.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <StudentAppShell
      activeSection={null}
      pageTitle="Quản lý học liệu"
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
      isAdmin={isAdmin}
      onManageMaterials={onManageMaterials}
      onManageUsers={onManageUsers}
    >
      <section className="teacher-dashboard" aria-labelledby="teacher-dashboard-title">
        <button className="student-back-link" type="button" onClick={onHome}>
          <ArrowLeft aria-hidden="true" /> Trang chủ
        </button>
        <header className="student-page-heading">
          <div>
            <p className="student-eyebrow">{isAdmin ? "QUẢN TRỊ HỆ THỐNG" : "KHÔNG GIAN GIẢNG VIÊN"}</p>
            <h1 id="teacher-dashboard-title">Quản lý học liệu</h1>
            <p className="student-page-description">Tạo môn học và đưa bài giảng PDF lên thư viện sinh viên.</p>
          </div>
        </header>

        <div className="teacher-dashboard-grid">
          <section className="teacher-panel" aria-labelledby="create-course-title">
            <div className="teacher-panel-heading">
              <span><Plus aria-hidden="true" /></span>
              <div><p className="student-eyebrow">BƯỚC 1</p><h2 id="create-course-title">Tạo môn học</h2></div>
            </div>
            <form className="auth-form teacher-form" onSubmit={createCourse}>
              <label className="form-field">
                <span>Tên môn</span>
                <input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Ví dụ: Cơ sở dữ liệu" required maxLength={120} disabled={busy} />
              </label>
              <label className="form-field">
                <span>Nhóm môn</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ví dụ: Cơ sở ngành" required maxLength={80} disabled={busy} />
              </label>
              <label className="form-field">
                <span>Mô tả môn học</span>
                <textarea className="teacher-description-input" value={courseDescription} onChange={(event) => setCourseDescription(event.target.value)} placeholder="Mục tiêu hoặc nội dung chính của môn" maxLength={500} rows={3} disabled={busy} />
              </label>
              <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Tạo môn học"}</button>
            </form>
            <div className="teacher-course-list" aria-label="Môn học đã tạo">
              {courses.length ? courses.map((course) => (
                <div className="teacher-course-row" key={course.id}>
                  {editingItem?.kind === "course" && editingItem.id === course.id ? (
                    <form className="teacher-inline-edit" onSubmit={saveEdit}>
                      <label className="form-field"><span>Tên môn</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required maxLength={120} disabled={busy} /></label>
                      <label className="form-field"><span>Nhóm môn</span><input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} required maxLength={80} disabled={busy} /></label>
                      <label className="form-field"><span>Mô tả</span><textarea className="teacher-description-input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={500} rows={2} disabled={busy} /></label>
                      <div className="teacher-edit-actions"><button className="student-primary-button" type="submit" disabled={busy}><Save aria-hidden="true" /> Lưu</button><button className="teacher-icon-button" type="button" onClick={() => setEditingItem(null)} aria-label="Hủy sửa" disabled={busy}><X aria-hidden="true" /></button></div>
                    </form>
                  ) : (
                    <>
                      <span className="teacher-course-info"><strong>{course.name}</strong><small>{course.description}</small></span>
                      <span className="teacher-course-category">{course.category}</span>
                      <span className="teacher-course-actions">
                        {(isAdmin || course.createdBy === currentUserId) && <>
                          <button className="teacher-icon-button" type="button" title="Sửa thông tin môn" aria-label={`Sửa môn ${course.name}`} onClick={() => editCourse(course)} disabled={busy}><Pencil aria-hidden="true" /></button>
                          <button className="teacher-delete-button" type="button" title="Xóa môn học trống" aria-label={`Xóa môn ${course.name}`} onClick={() => void removeCourse(course)} disabled={busy || resources.some((resource) => resource.courseId === course.id)}><Trash2 aria-hidden="true" /></button>
                        </>}
                      </span>
                    </>
                  )}
                </div>
              )) : <p className="teacher-empty-note">Chưa có môn học. Tạo môn trước khi tải bài giảng.</p>}
            </div>
            <p className="teacher-empty-note">Muốn xóa môn, hãy xóa hết bài giảng trong môn đó trước.</p>
          </section>

          <section className="teacher-panel" aria-labelledby="upload-material-title">
            <div className="teacher-panel-heading">
              <span><FileUp aria-hidden="true" /></span>
              <div><p className="student-eyebrow">BƯỚC 2</p><h2 id="upload-material-title">Tải bài giảng PDF</h2></div>
            </div>
            <form className="teacher-bulk-form" onSubmit={importBulk}>
              <label className="form-field">
                <span>Môn học</span>
                <select value={bulkCourseId} onChange={(event) => setBulkCourseId(event.target.value)} required disabled={busy || courses.length === 0}>
                  <option value="" disabled>Chọn môn học</option>
                  {courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Chọn một hoặc nhiều file PDF (tối đa 50 MB mỗi file)</span>
                <input
                  ref={bulkPdfInput}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  required
                  disabled={busy}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    setPdfFiles(files)
                    setBulkTitles(files.map(getPdfTitle))
                    setBulkFailures([])
                    setError("")
                    setNotice("")
                  }}
                />
              </label>
              {pdfFiles.map((file, index) => (
                <label className="form-field" key={`${file.name}:${file.size}:${file.lastModified}:${index}`}>
                  <span>Tên bài · {file.name}</span>
                  <input
                    value={bulkTitles[index] ?? ""}
                    onChange={(event) => setBulkTitles((current) => current.map((title, titleIndex) => titleIndex === index ? event.target.value : title))}
                    required
                    maxLength={180}
                    disabled={busy}
                  />
                </label>
              ))}
              <label className="form-field">
                <span>Chương / bài (áp dụng cho tất cả PDF)</span>
                <input value={bulkChapter} onChange={(event) => setBulkChapter(event.target.value)} required maxLength={80} disabled={busy} />
              </label>
              <label className="form-field">
                <span>Mô tả (dùng chung, không bắt buộc)</span>
                <input value={bulkDescription} onChange={(event) => setBulkDescription(event.target.value)} maxLength={500} disabled={busy} />
              </label>
              <p className="teacher-bulk-summary">{pdfFiles.length} PDF đã chọn · tên bài lấy từ tên file, số trang tự động đếm khi tải lên</p>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {notice && <p className="teacher-success" role="status">{notice}</p>}
              {bulkFailures.length > 0 && <ul className="teacher-bulk-errors" aria-label="Các file chưa tải được">{bulkFailures.map((failure, index) => <li key={`${index}-${failure}`}>{failure}</li>)}</ul>}
              <button className="primary-button auth-submit" type="submit" disabled={busy || courses.length === 0 || pdfFiles.length === 0}>
                <Upload aria-hidden="true" /> {busy ? "Đang đếm trang / tải lên..." : pdfFiles.length > 1 ? "Tải các PDF lên" : "Tải bài giảng lên"}
              </button>
              {courses.length === 0 && <p className="teacher-empty-note">Tạo ít nhất một môn học trước khi upload.</p>}
            </form>
          </section>
        </div>

        <section className="teacher-panel teacher-bulk-panel" aria-labelledby="manage-materials-title">
          <div className="teacher-panel-heading">
            <span><FileUp aria-hidden="true" /></span>
            <div><p className="student-eyebrow">ĐÃ ĐĂNG</p><h2 id="manage-materials-title">Quản lý tài liệu</h2></div>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="teacher-success" role="status">{notice}</p>}
          {resources.length ? (
            <div className="teacher-course-list">
              {resources.map((resource) => (
                <div className="teacher-course-row" key={resource.id}>
                  {editingItem?.kind === "material" && editingItem.id === resource.id ? (
                    <form className="teacher-inline-edit" onSubmit={saveEdit}>
                      <label className="form-field"><span>Tên bài giảng</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required maxLength={180} disabled={busy} /></label>
                      <label className="form-field"><span>Chương / bài</span><input value={editChapter} onChange={(event) => setEditChapter(event.target.value)} required maxLength={80} disabled={busy} /></label>
                      <label className="form-field"><span>Mô tả</span><textarea className="teacher-description-input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={500} rows={2} disabled={busy} /></label>
                      <label className="form-field"><span>Số trang / slide</span><input type="number" min="1" max="1000" value={editSlideCount} onChange={(event) => setEditSlideCount(Number(event.target.value))} required disabled={busy} /></label>
                      <div className="teacher-edit-actions"><button className="student-primary-button" type="submit" disabled={busy}><Save aria-hidden="true" /> Lưu</button><button className="teacher-icon-button" type="button" onClick={() => setEditingItem(null)} aria-label="Hủy sửa" disabled={busy}><X aria-hidden="true" /></button></div>
                    </form>
                  ) : (
                    <>
                      <span className="teacher-course-info teacher-material-info"><strong>{resource.title}</strong><small>{resource.course} · {resource.chapter}</small></span>
                      <span className="teacher-course-actions">
                        {(isAdmin || resource.uploadedBy === currentUserId) && <>
                          <button className="teacher-icon-button" type="button" title="Sửa thông tin tài liệu" aria-label={`Sửa tài liệu ${resource.title}`} onClick={() => editMaterial(resource)} disabled={busy}><Pencil aria-hidden="true" /></button>
                          <button className="teacher-delete-button" type="button" title="Xóa tài liệu" aria-label={`Xóa tài liệu ${resource.title}`} onClick={() => void removeMaterial(resource)} disabled={busy}><Trash2 aria-hidden="true" /></button>
                        </>}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="teacher-empty-note">Chưa có tài liệu nào được đăng.</p>}
        </section>

        <section className="teacher-panel teacher-bulk-panel" aria-labelledby="course-json-title">
          <div className="teacher-panel-heading">
            <span><FileUp aria-hidden="true" /></span>
            <div><p className="student-eyebrow">DANH SÁCH MÔN</p><h2 id="course-json-title">Nhập môn học từ JSON</h2></div>
          </div>
          <form className="teacher-bulk-form" onSubmit={importCourses}>
            <label className="form-field">
              <span>File JSON môn học</span>
              <input type="file" accept=".json,application/json" required disabled={busy} onChange={(event) => void readCourseJson(event.target.files?.[0])} />
            </label>
            <p className="teacher-bulk-summary">{courseJsonRows.length} môn hợp lệ đã đọc</p>
            {courseJsonError && <p className="auth-error" role="alert">{courseJsonError}</p>}
            {courseJsonNotice && <p className="teacher-success" role="status">{courseJsonNotice}</p>}
            {courseJsonFailures.length > 0 && <ul className="teacher-bulk-errors" aria-label="Các môn chưa nhập được">{courseJsonFailures.map((failure, index) => <li key={`${index}-${failure}`}>{failure}</li>)}</ul>}
            <button className="primary-button auth-submit" type="submit" disabled={busy || courseJsonRows.length === 0}>
              <Upload aria-hidden="true" /> {busy ? "Đang nhập..." : "Nhập môn học"}
            </button>
          </form>
          <details className="teacher-manifest-help">
            <summary>Format JSON</summary>
            <p>Mỗi object chỉ cần tên môn, nhóm môn và mô tả.</p>
            <div className="teacher-manifest-downloads"><a href="/course-manifest.example.json" download>Mẫu JSON môn học</a></div>
            <pre>{`[
  { "course": "Mạng máy tính", "category": "Cơ sở ngành", "description": "Kiến thức mạng và Internet" }
]`}</pre>
          </details>
        </section>

      </section>
    </StudentAppShell>
  )
}