export type AdminRole = "student" | "lecturer" | "admin"

export type AdminUser = {
  id: string
  email: string
  full_name: string
  role: AdminRole
  created_at: string
}

export type AdminUserValues = {
  email: string
  fullName: string
  role: AdminRole
}

export type NewAdminUserValues = AdminUserValues & {
  password: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isAdminUser(value: unknown): value is AdminUser {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.email === "string"
    && typeof value.full_name === "string"
    && (value.role === "student" || value.role === "lecturer" || value.role === "admin")
    && typeof value.created_at === "string"
}

async function adminRequest<T>(
  path: string,
  accessToken: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  payload?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })

  let result: unknown
  try {
    result = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Máy chủ Flask trả về phản hồi không hợp lệ.")
    }
    throw error
  }

  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === "string"
      ? result.error
      : `Yêu cầu quản trị thất bại (${response.status}).`
    throw new Error(message)
  }
  return result as T
}

export async function fetchAdminUsers(accessToken: string) {
  const result = await adminRequest<{ users: unknown }>("/api/admin/users", accessToken, "GET")
  if (!Array.isArray(result.users) || !result.users.every(isAdminUser)) {
    throw new Error("Danh sách người dùng nhận được không đúng định dạng.")
  }
  return result.users
}

export async function createAdminUser(accessToken: string, values: NewAdminUserValues) {
  const result = await adminRequest<{ user: unknown }>("/api/admin/users", accessToken, "POST", values)
  if (!isAdminUser(result.user)) throw new Error("Hồ sơ mới nhận được không đúng định dạng.")
  return result.user
}

export async function updateAdminUser(accessToken: string, userId: string, values: AdminUserValues) {
  const result = await adminRequest<{ user: unknown }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    accessToken,
    "PATCH",
    values,
  )
  if (!isAdminUser(result.user)) throw new Error("Hồ sơ cập nhật nhận được không đúng định dạng.")
  return result.user
}

export async function deleteAdminUser(accessToken: string, userId: string) {
  const result = await adminRequest<{ deleted: unknown }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    accessToken,
    "DELETE",
  )
  if (result.deleted !== true) throw new Error("Máy chủ không xác nhận đã xóa người dùng.")
}
