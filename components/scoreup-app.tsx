"use client"

import { useCallback, useEffect, useState } from "react"
import type { LearningResource, ManagedCourse } from "@/lib/study-data"
import { learningResources } from "@/lib/study-data"
import { CodeLearningScreen } from "@/components/screens/code-learning-screen"
import { CourseScreen } from "@/components/screens/course-screen"
import { AdminUsersScreen } from "@/components/screens/admin-users-screen"
import { AccountScreen } from "@/components/screens/account-screen"
import { ForgotPasswordScreen } from "@/components/screens/forgot-password-screen"
import { LibraryScreen } from "@/components/screens/library-screen"
import { LoginScreen } from "@/components/screens/login-screen"
import { MyDocumentsScreen } from "@/components/screens/my-documents-screen"
import { StudyStatsScreen } from "@/components/screens/study-stats-screen"
import { StudyGuideScreen } from "@/components/screens/study-guide-screen"
import { StudyWorkspaceScreen } from "@/components/screens/study-workspace-screen"
import { ResetPasswordScreen } from "@/components/screens/reset-password-screen"
import {
  TeacherDashboardScreen,
  type BulkUploadMaterialInput,
  type BulkUploadResult,
  type CourseImportInput,
  type CourseImportResult,
} from "@/components/screens/teacher-dashboard-screen"
import { getSupabaseClient } from "@/lib/supabase"
import {
  type AdminUserValues,
  type NewAdminUserValues,
} from "@/lib/admin-api"
import {
  cleanFlaskDailyActivity,
  createFlaskAdminUser,
  createFlaskCourse,
  deleteFlaskAdminUser,
  deleteFlaskCourse,
  deleteFlaskMaterial,
  getFlaskDailyActivity,
  getFlaskLearningContent,
  getFlaskProfile,
  getFlaskSignedUrl,
  getFlaskStudyHistory,
  importFlaskCourses,
  listFlaskAdminUsers,
  saveFlaskStudyActivity,
  toManagedCourse,
  toMaterialResource,
  updateFlaskAdminUser,
  updateFlaskCourse,
  updateFlaskMaterial,
  updateFlaskProfile,
  uploadFlaskMaterial,
} from "@/lib/flask-api"
import type { User } from "@supabase/supabase-js"

type Screen = "login" | "forgot" | "reset-password" | "home" | "course" | "my-documents" | "study-stats" | "guide" | "study" | "code" | "teacher" | "admin-users" | "account"
type StudyReturnScreen = "home" | "course" | "my-documents"
type CodeReturnScreen = StudyReturnScreen | "study"
type PersistedScreen = Exclude<Screen, "login" | "forgot" | "reset-password">
type NavigationSnapshot = {
  screen: PersistedScreen
  selectedCourse: string
  selectedResourceId: string
  studyReturnScreen: StudyReturnScreen
  codeReturnScreen: CodeReturnScreen
}
type StudentRole = "student" | "lecturer" | "admin"
type DocumentHistoryRecord = {
  studySeconds: number
  questionCount: number
  lastAccessedAt: number
}
type DailyStudyActivityRecord = {
  activityDate: string
  resourceId: string
  studySeconds: number
  accessed: boolean
}

const studyReturnScreens: StudyReturnScreen[] = ["home", "course", "my-documents"]

function readNavigationFromLocation(): NavigationSnapshot | null {
  const url = new URL(window.location.href)
  const path = url.pathname.replace(/\/+$/, "") || "/"
  const screenByPath: Record<string, PersistedScreen> = {
    "/": "home",
    "/home": "home",
    "/course": "course",
    "/documents": "my-documents",
    "/study-stats": "study-stats",
    "/guide": "guide",
    "/teacher": "teacher",
    "/admin/users": "admin-users",
    "/account": "account",
    "/study": "study",
    "/code": "code",
  }
  const screen = screenByPath[path]
  if (!screen) return null

  const studyReturnValue = url.searchParams.get("return")
  const codeReturnValue = url.searchParams.get("codeReturn")
  return {
    screen,
    selectedCourse: url.searchParams.get("course") ?? "",
    selectedResourceId: url.searchParams.get("resource") ?? "",
    studyReturnScreen: studyReturnScreens.includes(studyReturnValue as StudyReturnScreen)
      ? studyReturnValue as StudyReturnScreen
      : "course",
    codeReturnScreen: [...studyReturnScreens, "study"].includes(codeReturnValue as CodeReturnScreen)
      ? codeReturnValue as CodeReturnScreen
      : "course",
  }
}

function isPasswordRecoveryUrl() {
  const url = new URL(window.location.href)
  const hashParams = new URLSearchParams(url.hash.slice(1))
  return url.pathname.replace(/\/+$/, "") === "/reset-password"
    || url.searchParams.get("type") === "recovery"
    || hashParams.get("type") === "recovery"
}

function getNavigationPath(snapshot: NavigationSnapshot) {
  const url = new URL("/", window.location.origin)
  const paths: Record<PersistedScreen, string> = {
    home: "/",
    course: "/course",
    "my-documents": "/documents",
    "study-stats": "/study-stats",
    guide: "/guide",
    study: "/study",
    code: "/code",
    teacher: "/teacher",
    "admin-users": "/admin/users",
    account: "/account",
  }
  url.pathname = paths[snapshot.screen]
  if (snapshot.screen === "course") url.searchParams.set("course", snapshot.selectedCourse)
  if (snapshot.screen === "study" || snapshot.screen === "code") {
    url.searchParams.set("resource", snapshot.selectedResourceId)
    url.searchParams.set("return", snapshot.studyReturnScreen)
    url.searchParams.set("codeReturn", snapshot.codeReturnScreen)
  }
  return `${url.pathname}${url.search}`
}

function getUserDisplayName(user: User) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.user_metadata?.display_name
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim()

  const emailName = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim()
  return emailName || "Sinh viên"
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toLocaleUpperCase("vi") || "SV"
}

function getVietnamStudyDate(daysAgo = 0) {
  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = dateParts.find((part) => part.type === "year")?.value
  const month = dateParts.find((part) => part.type === "month")?.value
  const day = dateParts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) throw new Error("Could not determine the current study date.")
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) - daysAgo))
    .toISOString()
    .slice(0, 10)
}

export function ScoreUpApp() {
  const [screen, setScreen] = useState<Screen>("login")
  const [pendingNavigationRestore, setPendingNavigationRestore] = useState<NavigationSnapshot | null>(null)
  const [studyDate, setStudyDate] = useState("")
  const [selectedResource, setSelectedResource] = useState<LearningResource>(learningResources[0])
  const [selectedCourse, setSelectedCourse] = useState(learningResources[0].course)
  const [studyReturnScreen, setStudyReturnScreen] = useState<StudyReturnScreen>("course")
  const [codeReturnScreen, setCodeReturnScreen] = useState<CodeReturnScreen>("course")
  const [documentHistory, setDocumentHistory] = useState<Record<string, DocumentHistoryRecord>>({})
  const [dailyStudyActivity, setDailyStudyActivity] = useState<Record<string, DailyStudyActivityRecord>>({})
  const [studentName, setStudentName] = useState("Sinh viên")
  const [studentEmail, setStudentEmail] = useState("")
  const [studentId, setStudentId] = useState("")
  const [studentRole, setStudentRole] = useState<StudentRole>("student")
  const [profileLoadError, setProfileLoadError] = useState("")
  const [managedCourses, setManagedCourses] = useState<ManagedCourse[]>([])
  const [uploadedResources, setUploadedResources] = useState<LearningResource[]>([])
  const [learningContentLoaded, setLearningContentLoaded] = useState(false)
  const [learningContentError, setLearningContentError] = useState("")
  const studentInitials = getInitials(studentName)
  const allResources = learningContentLoaded ? uploadedResources : []
  const canManageMaterials = studentRole === "lecturer" || studentRole === "admin"

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error("Chưa cấu hình kết nối xác thực.")
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(error.message)
    if (!data.session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.")
    return data.session.access_token
  }, [])

  useEffect(() => {
    const updateStudyDate = () => setStudyDate(getVietnamStudyDate())
    updateStudyDate()
    const intervalId = window.setInterval(updateStudyDate, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (isPasswordRecoveryUrl()) setScreen("reset-password")
  }, [])

  const loadDocumentHistory = useCallback(async (userId: string) => {
    void userId
    try {
      const { history } = await getFlaskStudyHistory(await getAccessToken())
      setDocumentHistory(Object.fromEntries(history.map((record) => [
        record.resource_id,
        {
          studySeconds: record.study_seconds,
          questionCount: record.question_count,
          lastAccessedAt: new Date(record.last_accessed_at).getTime(),
        },
      ])))
    } catch (error) {
      console.error("Could not load study history:", error)
      return
    }
  }, [getAccessToken])

  const cleanupDailyStudyActivity = useCallback(async (userId: string, firstIncludedDate: string) => {
    void userId
    try {
      await cleanFlaskDailyActivity(await getAccessToken(), firstIncludedDate)
    } catch (error) {
      console.error("Could not remove expired daily study activity:", error)
    }
  }, [getAccessToken])

  const loadDailyStudyActivity = useCallback(async (userId: string) => {
    void userId
    try {
      const { activity } = await getFlaskDailyActivity(await getAccessToken(), getVietnamStudyDate(6))
      setDailyStudyActivity(Object.fromEntries(activity.map((record) => {
        const activityDate = record.activity_date
        const resourceId = record.resource_id
        return [`${activityDate}:${resourceId}`, {
          activityDate,
          resourceId,
          studySeconds: record.study_seconds,
          accessed: record.was_accessed,
        }]
      })))
    } catch (error) {
      console.error("Could not load daily study activity:", error)
      return
    }
  }, [getAccessToken])

  useEffect(() => {
    if (!studentId || !studyDate) return
    void cleanupDailyStudyActivity(studentId, getVietnamStudyDate(6))
  }, [cleanupDailyStudyActivity, studentId, studyDate])

  const loadStudentIdentity = useCallback(async (user: User) => {
    setProfileLoadError("")
    try {
      const { profile } = await getFlaskProfile(await getAccessToken())
      setStudentId(profile.id)
      setStudentName(profile.full_name.trim() || getUserDisplayName(user))
      setStudentEmail(profile.email || user.email || "")
      setStudentRole(profile.role === "lecturer" || profile.role === "admin" ? profile.role : "student")
    } catch (error) {
      console.error("Could not load student profile from Flask:", error)
      setProfileLoadError(error instanceof Error ? error.message : "Không tải được hồ sơ và quyền tài khoản.")
    }
  }, [getAccessToken])

  const loadLearningContent = useCallback(async () => {
    setLearningContentError("")
    try {
      const { courses: courseRows, materials } = await getFlaskLearningContent(await getAccessToken())
      const courses = courseRows.map(toManagedCourse)
      setManagedCourses(courses)
      const courseById = new Map(courses.map((course) => [course.id, course]))
      setUploadedResources(materials.map((material) => toMaterialResource(material, courseById.get(material.course_id))))
      setLearningContentLoaded(true)
    } catch (error) {
      console.error("Could not load learning content from Flask:", error)
      setLearningContentLoaded(true)
      setLearningContentError(error instanceof Error ? error.message : "Không tải được danh sách môn học.")
    }
  }, [getAccessToken])

  const recordStudyActivity = useCallback(async (
    resourceId: string,
    activity: { studySeconds?: number; questionCount?: number; accessed?: boolean },
  ) => {
    try {
      await saveFlaskStudyActivity(await getAccessToken(), {
        resourceId,
        studySeconds: activity.studySeconds,
        questionCount: activity.questionCount,
        accessed: activity.accessed,
      })
    } catch (error) {
      console.error("Could not save study activity through Flask:", error)
    }
  }, [getAccessToken])

  const updateDailyStudyActivity = useCallback((resourceId: string, activity: { studySeconds?: number; accessed?: boolean }) => {
    const activityDate = getVietnamStudyDate()
    const key = `${activityDate}:${resourceId}`

    setDailyStudyActivity((previous) => {
      const current = previous[key] ?? { activityDate, resourceId, studySeconds: 0, accessed: false }
      return {
        ...previous,
        [key]: {
          ...current,
          studySeconds: current.studySeconds + (activity.studySeconds ?? 0),
          accessed: current.accessed || (activity.accessed ?? false),
        },
      }
    })
  }, [])

  const restoreNavigation = useCallback((snapshot: NavigationSnapshot | null) => {
    if (!snapshot) {
      setPendingNavigationRestore(null)
      setScreen("home")
      return
    }

    if (snapshot.selectedCourse) setSelectedCourse(snapshot.selectedCourse)
    setStudyReturnScreen(snapshot.studyReturnScreen)
    setCodeReturnScreen(snapshot.codeReturnScreen)

    if (snapshot.screen === "study" || snapshot.screen === "code") {
      if (!snapshot.selectedResourceId) {
        setPendingNavigationRestore(null)
        setScreen(snapshot.studyReturnScreen)
        return
      }

      setPendingNavigationRestore(snapshot)
      setScreen("home")
      return
    }

    setPendingNavigationRestore(null)
    setScreen(snapshot.screen)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  useEffect(() => {
    if (!pendingNavigationRestore) return

    const resource = allResources.find((item) => item.id === pendingNavigationRestore.selectedResourceId)
    if (!resource) {
      if (!learningContentLoaded && getSupabaseClient()) return

      console.error("Could not restore the resource open in this browser tab.")
      setPendingNavigationRestore(null)
      setScreen(pendingNavigationRestore.studyReturnScreen)
      return
    }

    let cancelled = false
    const restoreResource = async () => {
      const isProgrammingCourse = resource.category.trim().toLocaleLowerCase("vi") === "lập trình"
      let resourceWithUrl = { ...resource, hasCode: isProgrammingCourse }

      if (resource.filePath) {
        try {
          const { signedUrl } = await getFlaskSignedUrl(await getAccessToken(), resource.id)
          resourceWithUrl = { ...resource, hasCode: isProgrammingCourse, fileUrl: signedUrl }
        } catch (error) {
          console.error("Could not restore the lecture PDF through Flask:", error)
          setPendingNavigationRestore(null)
          setScreen(pendingNavigationRestore.studyReturnScreen)
          return
        }
      }

      if (cancelled) return
      setSelectedResource(resourceWithUrl)
      setScreen(pendingNavigationRestore.screen === "code" && isProgrammingCourse ? "code" : "study")
      setPendingNavigationRestore(null)
    }

    void restoreResource()
    return () => {
      cancelled = true
    }
  }, [allResources, getAccessToken, learningContentLoaded, pendingNavigationRestore])

  useEffect(() => {
    const handleBrowserNavigation = () => restoreNavigation(readNavigationFromLocation())
    window.addEventListener("popstate", handleBrowserNavigation)
    return () => window.removeEventListener("popstate", handleBrowserNavigation)
  }, [restoreNavigation])

  useEffect(() => {
    if (screen === "login" || screen === "forgot" || screen === "reset-password" || pendingNavigationRestore) return

    const snapshot: NavigationSnapshot = {
      screen,
      selectedCourse,
      selectedResourceId: selectedResource.id,
      studyReturnScreen,
      codeReturnScreen,
    }
    const nextPath = getNavigationPath(snapshot)
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath !== nextPath) window.history.pushState({}, "", nextPath)
  }, [codeReturnScreen, pendingNavigationRestore, screen, selectedCourse, selectedResource.id, studyReturnScreen])

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || isPasswordRecoveryUrl()) {
        setScreen("reset-password")
      } else if (session) {
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
          if (event === "INITIAL_SESSION") {
            restoreNavigation(readNavigationFromLocation())
          } else {
            setScreen((current) => current === "login" || current === "forgot" ? "home" : current)
          }
          window.setTimeout(() => {
            void loadDocumentHistory(session.user.id)
            void loadDailyStudyActivity(session.user.id)
            void loadStudentIdentity(session.user)
            void loadLearningContent()
          }, 0)
        }
      } else if (event === "SIGNED_OUT") {
        setDocumentHistory({})
        setDailyStudyActivity({})
        setStudentName("Sinh viên")
        setStudentEmail("")
        setStudentId("")
        setStudentRole("student")
        setProfileLoadError("")
        setManagedCourses([])
        setUploadedResources([])
        setLearningContentLoaded(false)
        setLearningContentError("")
        setPendingNavigationRestore(null)
        window.history.replaceState({}, "", "/login")
        setScreen("login")
      }
    })

    return () => subscription.unsubscribe()
  }, [loadDailyStudyActivity, loadDocumentHistory, loadLearningContent, loadStudentIdentity, restoreNavigation])

  const recordQuestion = useCallback((resourceId: string) => {
    setDocumentHistory((previous) => {
      const current = previous[resourceId] ?? { studySeconds: 0, questionCount: 0, lastAccessedAt: Date.now() }
      return {
        ...previous,
        [resourceId]: {
          ...current,
          questionCount: current.questionCount + 1,
          lastAccessedAt: Date.now(),
        },
      }
    })
    updateDailyStudyActivity(resourceId, {})
    void recordStudyActivity(resourceId, { questionCount: 1 })
  }, [recordStudyActivity, updateDailyStudyActivity])

  const recordStudySeconds = useCallback((resourceId: string, seconds: number) => {
    if (seconds <= 0) return
    setDocumentHistory((previous) => {
      const current = previous[resourceId]
      if (!current) return previous
      return {
        ...previous,
        [resourceId]: { ...current, studySeconds: current.studySeconds + seconds },
      }
    })
    updateDailyStudyActivity(resourceId, { studySeconds: seconds })
    void recordStudyActivity(resourceId, { studySeconds: seconds })
  }, [recordStudyActivity, updateDailyStudyActivity])

  const openResource = (resource: LearningResource, returnScreen: StudyReturnScreen) => {
    const open = async () => {
      const isProgrammingCourse = resource.category.trim().toLocaleLowerCase("vi") === "lập trình"
      let resourceWithUrl = { ...resource, hasCode: isProgrammingCourse }
      if (resource.filePath) {
        try {
      const { signedUrl } = await getFlaskSignedUrl(await getAccessToken(), resource.id)
      resourceWithUrl = { ...resource, hasCode: isProgrammingCourse, fileUrl: signedUrl }
        } catch (error) {
      console.error("Could not open lecture PDF through Flask:", error)
        }
      }

      setSelectedResource(resourceWithUrl)
      setStudyReturnScreen(returnScreen)
      setDocumentHistory((previous) => {
        const current = previous[resource.id] ?? { studySeconds: 0, questionCount: 0, lastAccessedAt: 0 }
        return {
          ...previous,
          [resource.id]: { ...current, lastAccessedAt: Date.now() },
        }
      })
      updateDailyStudyActivity(resource.id, { accessed: true })
      setScreen("study")
      void recordStudyActivity(resource.id, { accessed: true })
    }

    void open()
  }

  const createCourse = async (name: string, category: string, description: string) => {
    const { course } = await createFlaskCourse(await getAccessToken(), { name, category, description })
    const createdCourse = toManagedCourse(course)
    setManagedCourses((current) => [...current, createdCourse].sort((first, second) => first.name.localeCompare(second.name, "vi")))
  }

  const bulkImportCourses = async (inputs: CourseImportInput[]): Promise<CourseImportResult> => {
    const { created, skipped, failed } = await importFlaskCourses(await getAccessToken(), inputs)
    const newCourses = created.map(toManagedCourse)
    if (newCourses.length) {
      setManagedCourses((current) => [...current, ...newCourses].sort((first, second) => first.name.localeCompare(second.name, "vi")))
    }
    return { created: newCourses.length, skipped, failed }
  }

  const deleteMaterial = async (resourceId: string) => {
    await deleteFlaskMaterial(await getAccessToken(), resourceId)
    setUploadedResources((current) => current.filter((resource) => resource.id !== resourceId))
  }

  const deleteCourse = async (courseId: string) => {
    if (uploadedResources.some((resource) => resource.courseId === courseId)) {
      throw new Error("Môn này còn tài liệu. Hãy xóa tài liệu trước.")
    }

    await deleteFlaskCourse(await getAccessToken(), courseId)
    setManagedCourses((current) => current.filter((course) => course.id !== courseId))
  }

  const updateCourse = async (
    courseId: string,
    values: { name: string; category: string; description: string },
  ) => {
    const currentCourse = managedCourses.find((course) => course.id === courseId)
    const { course } = await updateFlaskCourse(await getAccessToken(), courseId, values)
    const updatedCourse = toManagedCourse(course)
    setManagedCourses((current) => current.map((course) => course.id === courseId ? updatedCourse : course))
    setUploadedResources((current) => current.map((resource) => resource.courseId === courseId
      ? { ...resource, course: updatedCourse.name, category: updatedCourse.category }
      : resource,
    ))
    if (currentCourse) setSelectedCourse((current) => current === currentCourse.name ? updatedCourse.name : current)
  }

  const updateMaterial = async (
    resourceId: string,
    values: { title: string; chapter: string; description: string; slideCount: number },
  ) => {
    const { material } = await updateFlaskMaterial(await getAccessToken(), resourceId, values)
    const course = managedCourses.find((item) => item.id === material.course_id)
    setUploadedResources((current) => current.map((resource) =>
      resource.id === resourceId ? toMaterialResource(material, course) : resource,
    ))
  }

  const bulkUploadMaterials = async (inputs: BulkUploadMaterialInput[]): Promise<BulkUploadResult> => {
    const accessToken = await getAccessToken()
    const coursesByName = new Map(managedCourses.map((course) => [course.name.toLocaleLowerCase("vi"), course]))
    const createdResources: LearningResource[] = []
    const failed: string[] = []

    for (const input of inputs) {
      try {
        const courseKey = input.courseName.toLocaleLowerCase("vi")
        const course = coursesByName.get(courseKey)
        if (!course) throw new Error(`Không tìm thấy môn học "${input.courseName}". Tải lại trang và chọn lại môn.`)
        if (course.category !== input.category) {
          throw new Error(`Môn "${input.courseName}" đã tồn tại với nhóm "${course.category}".`)
        }
        const { material } = await uploadFlaskMaterial(accessToken, {
          courseId: course.id,
          title: input.title,
          chapter: input.chapter,
          description: input.description,
          slideCount: input.slideCount,
          file: input.file,
        })
        createdResources.push(toMaterialResource(material, course))
      } catch (uploadError) {
        failed.push(`${input.title} (${input.file.name}): ${uploadError instanceof Error ? uploadError.message : "Không thể tải lên."}`)
      }
    }
    if (createdResources.length) setUploadedResources((current) => [...createdResources.reverse(), ...current])

    return { uploaded: createdResources.length, failed }
  }

  const openCourse = (course: string) => {
    setSelectedCourse(course)
    setScreen("course")
  }

  const navigateHome = () => {
    if (isPasswordRecoveryUrl()) window.history.replaceState({}, "", "/")
    setScreen("home")
  }
  const navigateToLogin = () => {
    window.history.replaceState({}, "", "/login")
    setScreen("login")
  }
  const navigateMyDocuments = () => setScreen("my-documents")
  const navigateStudyStats = () => setScreen("study-stats")
  const navigateGuide = () => setScreen("guide")
  const navigateManageMaterials = () => setScreen("teacher")
  const navigateManageUsers = () => setScreen("admin-users")
  const navigateAccount = () => setScreen("account")
  const managementNavigation = {
    canManageMaterials,
    isAdmin: studentRole === "admin",
    onManageMaterials: navigateManageMaterials,
    onManageUsers: navigateManageUsers,
    onOpenAccount: navigateAccount,
  }
  const saveAccountName = useCallback(async (fullName: string) => {
    const { profile } = await updateFlaskProfile(await getAccessToken(), fullName)
    setStudentName(profile.full_name || "Sinh viên")
  }, [getAccessToken])
  const loadAdminUsers = useCallback(async () => {
    return (await listFlaskAdminUsers(await getAccessToken())).users
  }, [getAccessToken])
  const createManagedUser = useCallback(async (values: NewAdminUserValues) => {
    await createFlaskAdminUser(await getAccessToken(), values)
  }, [getAccessToken])
  const updateManagedUser = useCallback(async (userId: string, values: AdminUserValues) => {
    await updateFlaskAdminUser(await getAccessToken(), userId, values)
    if (userId === studentId) {
      setStudentName(values.fullName)
      setStudentEmail(values.email)
    }
  }, [getAccessToken, studentId])
  const deleteManagedUser = useCallback(async (userId: string) => {
    await deleteFlaskAdminUser(await getAccessToken(), userId)
  }, [getAccessToken])
  const logout = () => {
    void getSupabaseClient()?.auth.signOut()
    setDocumentHistory({})
    setDailyStudyActivity({})
    setStudentName("Sinh viên")
    setStudentEmail("")
    setStudentId("")
    setScreen("login")
  }

  const login = async (email: string, password: string) => {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error("Ứng dụng chưa được cấu hình xác thực. Vui lòng thêm thông tin Supabase vào biến môi trường.")

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setScreen("home")
  }

  const loginWithMicrosoft = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error("Ứng dụng chưa được cấu hình xác thực. Vui lòng thêm thông tin Supabase vào biến môi trường.")

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: window.location.origin, scopes: "email" },
    })
    if (error) throw error
  }

  const sendPasswordReset = async (email: string) => {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error("Ứng dụng chưa được cấu hình xác thực. Vui lòng thêm thông tin Supabase vào biến môi trường.")

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error("Không thể kết nối dịch vụ xác thực.")

    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    window.history.replaceState({}, "", "/")
    setScreen("home")
  }

  const myDocuments = Object.entries(documentHistory)
    .flatMap(([resourceId, record]) => {
      const resource = allResources.find((item) => item.id === resourceId)
      return resource ? [{ resource, ...record }] : []
    })
    .sort((first, second) => second.lastAccessedAt - first.lastAccessedAt)
  const firstIncludedDate = studyDate ? getVietnamStudyDate(6) : ""
  const dailyStudyStats = Object.values(dailyStudyActivity)
    .filter((activity) => activity.activityDate >= firstIncludedDate && activity.activityDate <= studyDate)
    .reduce((daily, activity) => {
      const summary = daily.get(activity.activityDate) ?? {
        date: activity.activityDate,
        studySeconds: 0,
        documentsAccessed: 0,
      }
      summary.studySeconds += activity.studySeconds
      if (activity.accessed) summary.documentsAccessed += 1
      daily.set(activity.activityDate, summary)
      return daily
    }, new Map<string, { date: string; studySeconds: number; documentsAccessed: number }>())
  const studyStats = Array.from(dailyStudyStats.values()).sort((first, second) => second.date.localeCompare(first.date))
  const todayStudySeconds = Object.values(dailyStudyActivity)
    .filter((activity) => activity.activityDate === studyDate)
    .reduce((total, activity) => total + activity.studySeconds, 0)

  if (screen === "login") {
    return <LoginScreen onLogin={login} onMicrosoftLogin={loginWithMicrosoft} onForgot={() => setScreen("forgot")} />
  }

  if (screen === "forgot") {
    return <ForgotPasswordScreen onBack={navigateToLogin} onSendResetEmail={sendPasswordReset} />
  }

  if (screen === "reset-password") {
    return <ResetPasswordScreen onUpdatePassword={updatePassword} onBack={navigateToLogin} onHome={navigateHome} />
  }

  if (screen === "account") {
    return (
      <AccountScreen
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        studentRole={studentRole}
        onSaveName={saveAccountName}
        onHome={navigateHome}
        onMyDocuments={navigateMyDocuments}
        onOpenStats={navigateStudyStats}
        onOpenGuide={navigateGuide}
        onLogout={logout}
        managementNavigation={managementNavigation}
      />
    )
  }

  if (screen === "admin-users") {
    if (studentRole !== "admin") {
      return <LibraryScreen
        studyHistory={myDocuments}
        resources={allResources}
        managedCourses={managedCourses}
        profileLoadError={profileLoadError}
        learningContentLoaded={learningContentLoaded}
        learningContentError={learningContentError}
        onRetryLearningContent={loadLearningContent}
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        todayStudySeconds={todayStudySeconds}
        canManageMaterials={canManageMaterials}
        isAdmin={false}
        onHome={navigateHome}
        onManageMaterials={navigateManageMaterials}
        onManageUsers={navigateManageUsers}
        onOpenAccount={navigateAccount}
        onOpenCourse={openCourse}
        onSelectResource={(resource) => openResource(resource, "home")}
        onMyDocuments={navigateMyDocuments}
        onOpenStats={navigateStudyStats}
        onOpenGuide={navigateGuide}
        onLogout={logout}
      />
    }

    return <AdminUsersScreen
      currentUserId={studentId}
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onLoadUsers={loadAdminUsers}
      onCreateUser={createManagedUser}
      onUpdateUser={updateManagedUser}
      onDeleteUser={deleteManagedUser}
      onBack={navigateManageMaterials}
      onHome={navigateHome}
      onMyDocuments={navigateMyDocuments}
      onOpenStats={navigateStudyStats}
      onOpenAccount={navigateAccount}
      onLogout={logout}
      onManageUsers={navigateManageUsers}
    />
  }

  if (screen === "teacher") {
    if (!canManageMaterials) {
      return <LibraryScreen
        studyHistory={myDocuments}
        resources={allResources}
        managedCourses={managedCourses}
        profileLoadError={profileLoadError}
        learningContentLoaded={learningContentLoaded}
        learningContentError={learningContentError}
        onRetryLearningContent={loadLearningContent}
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        todayStudySeconds={todayStudySeconds}
        canManageMaterials={false}
        isAdmin={false}
        onHome={navigateHome}
        onManageMaterials={navigateManageMaterials}
        onManageUsers={navigateManageUsers}
        onOpenAccount={navigateAccount}
        onOpenCourse={openCourse}
        onSelectResource={(resource) => openResource(resource, "home")}
        onMyDocuments={navigateMyDocuments}
        onOpenStats={navigateStudyStats}
        onOpenGuide={navigateGuide}
        onLogout={logout}
      />
    }

    return <TeacherDashboardScreen
      courses={managedCourses}
      resources={uploadedResources}
      currentUserId={studentId}
      isAdmin={studentRole === "admin"}
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onCreateCourse={createCourse}
      onBulkImport={bulkUploadMaterials}
      onBulkImportCourses={bulkImportCourses}
      onDeleteMaterial={deleteMaterial}
      onDeleteCourse={deleteCourse}
      onUpdateCourse={updateCourse}
      onUpdateMaterial={updateMaterial}
      onManageMaterials={navigateManageMaterials}
      onManageUsers={navigateManageUsers}
      onOpenAccount={navigateAccount}
      onHome={navigateHome}
      onMyDocuments={navigateMyDocuments}
      onOpenStats={navigateStudyStats}
      onLogout={logout}
    />
  }

  if (screen === "home") {
    return (
      <LibraryScreen
        studyHistory={myDocuments}
        resources={allResources}
        managedCourses={managedCourses}
        profileLoadError={profileLoadError}
        learningContentLoaded={learningContentLoaded}
        learningContentError={learningContentError}
        onRetryLearningContent={loadLearningContent}
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        todayStudySeconds={todayStudySeconds}
        canManageMaterials={canManageMaterials}
        isAdmin={studentRole === "admin"}
        onHome={navigateHome}
        onManageMaterials={navigateManageMaterials}
        onManageUsers={navigateManageUsers}
        onOpenAccount={navigateAccount}
        onOpenCourse={openCourse}
        onSelectResource={(resource) => openResource(resource, "home")}
        onMyDocuments={navigateMyDocuments}
        onOpenStats={navigateStudyStats}
        onOpenGuide={navigateGuide}
        onLogout={logout}
      />
    )
  }

  if (screen === "course") {
    return (
      <CourseScreen
        courseName={selectedCourse}
        courseDescription={managedCourses.find((course) => course.name === selectedCourse)?.description ?? ""}
        resources={allResources}
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        onBack={navigateHome}
        onSelectResource={(resource) => openResource(resource, "course")}
        onMyDocuments={navigateMyDocuments}
        onOpenStats={navigateStudyStats}
        onOpenGuide={navigateGuide}
        onLogout={logout}
        managementNavigation={managementNavigation}
      />
    )
  }

  if (screen === "my-documents") {
    return (
      <MyDocumentsScreen
        documents={myDocuments}
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        onSelectResource={(resource) => openResource(resource, "my-documents")}
        onHome={navigateHome}
        onOpenStats={navigateStudyStats}
        onOpenGuide={navigateGuide}
        onLogout={logout}
        managementNavigation={managementNavigation}
      />
    )
  }

  if (screen === "study-stats") {
    return (
      <StudyStatsScreen
        dailyStats={studyStats}
        today={studyDate}
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        onHome={navigateHome}
        onMyDocuments={navigateMyDocuments}
        onLogout={logout}
        managementNavigation={managementNavigation}
      />
    )
  }

  if (screen === "guide") {
    return (
      <StudyGuideScreen
        studentName={studentName}
        studentEmail={studentEmail}
        studentInitials={studentInitials}
        onHome={navigateHome}
        onMyDocuments={navigateMyDocuments}
        onOpenStats={navigateStudyStats}
        onLogout={logout}
        managementNavigation={managementNavigation}
      />
    )
  }

  if (screen === "code" && selectedResource.category.trim().toLocaleLowerCase("vi") === "lập trình") {
    return (
      <CodeLearningScreen
        resource={selectedResource}
        onBack={() => setScreen(codeReturnScreen)}
        onHome={navigateHome}
      />
    )
  }

  if (screen === "study") {
    return (
      <StudyWorkspaceScreen
        key={selectedResource.id}
        resource={selectedResource}
        studentName={studentName}
        studentInitials={studentInitials}
        onBack={() => setScreen(studyReturnScreen)}
        onHome={navigateHome}
        onLearnCode={() => {
          if (selectedResource.category.trim().toLocaleLowerCase("vi") === "lập trình") {
            setCodeReturnScreen("study")
            setScreen("code")
          }
        }}
        onQuestionAsked={recordQuestion}
        onStudySeconds={recordStudySeconds}
      />
    )
  }

  return (
    <LibraryScreen
      studyHistory={myDocuments}
      resources={allResources}
      managedCourses={managedCourses}
      profileLoadError={profileLoadError}
      learningContentLoaded={learningContentLoaded}
      learningContentError={learningContentError}
      onRetryLearningContent={loadLearningContent}
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      todayStudySeconds={todayStudySeconds}
      canManageMaterials={canManageMaterials}
      isAdmin={studentRole === "admin"}
      onHome={navigateHome}
      onManageMaterials={navigateManageMaterials}
      onManageUsers={navigateManageUsers}
      onOpenAccount={navigateAccount}
      onOpenCourse={openCourse}
      onSelectResource={(resource) => openResource(resource, "home")}
      onMyDocuments={navigateMyDocuments}
      onOpenStats={navigateStudyStats}
      onOpenGuide={navigateGuide}
      onLogout={logout}
    />
  )
}
