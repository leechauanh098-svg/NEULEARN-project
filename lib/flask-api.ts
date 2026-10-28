import type { LearningResource, ManagedCourse } from "@/lib/study-data"
import type { AdminUser, AdminUserValues, NewAdminUserValues } from "@/lib/admin-api"

export type ProfileResponse = {
  id: string
  email: string
  full_name: string
  role: "student" | "lecturer" | "admin"
}

export type CourseRow = {
  id: string
  name: string
  category: string
  description: string
  created_by: string
}

export type MaterialRow = {
  id: string
  course_id: string
  title: string
  chapter: string
  description: string
  teacher_name: string
  file_path: string
  slide_count: number
  created_at: string
  uploaded_by: string
}

export type HistoryRow = {
  resource_id: string
  study_seconds: number
  question_count: number
  last_accessed_at: string
}

export type DailyActivityRow = {
  activity_date: string
  resource_id: string
  study_seconds: number
  was_accessed: boolean
}

export type BulkCourseInput = {
  course: string
  category: string
  description: string
}

export type MaterialUploadInput = {
  courseId: string
  title: string
  chapter: string
  description: string
  slideCount: number
  file: File
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getFlaskApiUrl(path: string) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_FLASK_API_URL?.trim()
  if (configuredBaseUrl) return `${configuredBaseUrl.replace(/\/+$/, "")}${path}`

  if (typeof window !== "undefined" && ["3000", "3001"].includes(window.location.port)) {
    return `http://127.0.0.1:5000${path}`
  }

  return path
}

async function requestFlask<T>(
  path: string,
  accessToken: string,
  options: { method?: string; body?: BodyInit; json?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` })
  let body = options.body
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.json)
  }
  let response: Response
  try {
    response = await fetch(getFlaskApiUrl(path), {
      method: options.method ?? "GET",
      headers,
      body,
      cache: "no-store",
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Không kết nối được Flask. Hãy chạy `python app.py` hoặc kiểm tra NEXT_PUBLIC_FLASK_API_URL.")
    }
    throw error
  }

  const responseText = await response.text()
  let result: unknown
  if (responseText) {
    try {
      result = JSON.parse(responseText)
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      if (response.status === 404) {
        throw new Error("Không tìm thấy API Flask. Hãy chạy Flask hoặc kiểm tra NEXT_PUBLIC_FLASK_API_URL.")
      }
      if (response.status >= 500) {
        throw new Error(`Flask gặp lỗi máy chủ (${response.status}).`)
      }
      if (response.headers.get("content-type")?.includes("text/html")) {
        throw new Error("API nhận trang HTML thay vì dữ liệu. Hãy chạy lại Flask và kiểm tra NEXT_PUBLIC_FLASK_API_URL.")
      }
      throw new Error("Máy chủ Flask trả về phản hồi không hợp lệ.")
    }
  }
  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === "string"
      ? result.error
      : `Yêu cầu Flask thất bại (${response.status}).`
    throw new Error(message)
  }
  if (result === undefined) throw new Error("Máy chủ Flask không trả về dữ liệu.")
  return result as T
}

export function getFlaskProfile(accessToken: string) {
  return requestFlask<{ profile: ProfileResponse }>("/api/profile", accessToken)
}

export function updateFlaskProfile(accessToken: string, fullName: string) {
  return requestFlask<{ profile: ProfileResponse }>("/api/profile", accessToken, {
    method: "PATCH",
    json: { fullName },
  })
}

export function getFlaskLearningContent(accessToken: string) {
  return requestFlask<{ courses: CourseRow[]; materials: MaterialRow[] }>("/api/learning", accessToken)
}

export function getFlaskStudyHistory(accessToken: string) {
  return requestFlask<{ history: HistoryRow[] }>("/api/study/history", accessToken)
}

export function getFlaskDailyActivity(accessToken: string, firstDate: string) {
  return requestFlask<{ activity: DailyActivityRow[] }>(
    `/api/study/daily?from=${encodeURIComponent(firstDate)}`,
    accessToken,
  )
}

export function cleanFlaskDailyActivity(accessToken: string, firstDate: string) {
  return requestFlask<{ deleted: boolean }>(
    `/api/study/daily?from=${encodeURIComponent(firstDate)}`,
    accessToken,
    { method: "DELETE" },
  )
}

export function saveFlaskStudyActivity(
  accessToken: string,
  activity: { resourceId: string; studySeconds?: number; questionCount?: number; accessed?: boolean },
) {
  return requestFlask<{ saved: boolean }>("/api/study/activity", accessToken, {
    method: "POST",
    json: activity,
  })
}

export function getFlaskSignedUrl(accessToken: string, resourceId: string) {
  return requestFlask<{ signedUrl: string }>(
    `/api/materials/${encodeURIComponent(resourceId)}/signed-url`,
    accessToken,
  )
}

export function createFlaskCourse(
  accessToken: string,
  course: { name: string; category: string; description: string },
) {
  return requestFlask<{ course: CourseRow }>("/api/courses", accessToken, {
    method: "POST",
    json: course,
  })
}

export function importFlaskCourses(accessToken: string, courses: BulkCourseInput[]) {
  return requestFlask<{ created: CourseRow[]; skipped: number; failed: string[] }>(
    "/api/courses/import",
    accessToken,
    { method: "POST", json: { courses } },
  )
}

export function updateFlaskCourse(
  accessToken: string,
  courseId: string,
  course: { name: string; category: string; description: string },
) {
  return requestFlask<{ course: CourseRow }>(`/api/courses/${encodeURIComponent(courseId)}`, accessToken, {
    method: "PATCH",
    json: course,
  })
}

export function deleteFlaskCourse(accessToken: string, courseId: string) {
  return requestFlask<{ deleted: boolean }>(`/api/courses/${encodeURIComponent(courseId)}`, accessToken, {
    method: "DELETE",
  })
}

export async function uploadFlaskMaterial(accessToken: string, input: MaterialUploadInput) {
  const formData = new FormData()
  formData.set("courseId", input.courseId)
  formData.set("title", input.title)
  formData.set("chapter", input.chapter)
  formData.set("description", input.description)
  formData.set("slideCount", String(input.slideCount))
  formData.set("file", input.file)
  return requestFlask<{ material: MaterialRow }>("/api/materials", accessToken, {
    method: "POST",
    body: formData,
  })
}

export function updateFlaskMaterial(
  accessToken: string,
  materialId: string,
  values: { title: string; chapter: string; description: string; slideCount: number },
) {
  return requestFlask<{ material: MaterialRow }>(`/api/materials/${encodeURIComponent(materialId)}`, accessToken, {
    method: "PATCH",
    json: values,
  })
}

export function deleteFlaskMaterial(accessToken: string, materialId: string) {
  return requestFlask<{ deleted: boolean }>(`/api/materials/${encodeURIComponent(materialId)}`, accessToken, {
    method: "DELETE",
  })
}

export function listFlaskAdminUsers(accessToken: string) {
  return requestFlask<{ users: AdminUser[] }>("/api/admin/users", accessToken)
}

export function createFlaskAdminUser(accessToken: string, values: NewAdminUserValues) {
  return requestFlask<{ user: AdminUser }>("/api/admin/users", accessToken, { method: "POST", json: values })
}

export function updateFlaskAdminUser(accessToken: string, userId: string, values: AdminUserValues) {
  return requestFlask<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(userId)}`, accessToken, {
    method: "PATCH",
    json: values,
  })
}

export function deleteFlaskAdminUser(accessToken: string, userId: string) {
  return requestFlask<{ deleted: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}`, accessToken, {
    method: "DELETE",
  })
}

export function toManagedCourse(row: CourseRow): ManagedCourse {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    createdBy: row.created_by,
  }
}

export function toMaterialResource(row: MaterialRow, course?: ManagedCourse): LearningResource {
  return {
    id: row.id,
    title: row.title,
    course: course?.name ?? "Môn học",
    category: course?.category ?? "Cơ sở ngành",
    chapter: row.chapter,
    description: row.description,
    slides: row.slide_count,
    duration: "Tài liệu PDF",
    updated: `Cập nhật ${new Date(row.created_at).toLocaleDateString("vi-VN")}`,
    progress: 0,
    hasCode: course?.category.trim().toLocaleLowerCase("vi") === "lập trình",
    teacher: row.teacher_name,
    coverTone: "blue",
    courseId: row.course_id,
    filePath: row.file_path,
    uploadedBy: row.uploaded_by,
  }
}
