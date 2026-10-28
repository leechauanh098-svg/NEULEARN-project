export function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại."
  const normalizedMessage = message.toLocaleLowerCase()

  if (message.includes("Invalid login credentials")) {
    return "Email hoặc mật khẩu chưa chính xác."
  }

  if (message.includes("Email not confirmed")) {
    return "Bạn cần xác nhận email trước khi đăng nhập."
  }

  if (
    normalizedMessage.includes("rate limit")
    || normalizedMessage.includes("too many requests")
    || normalizedMessage.includes("over_email_send_rate_limit")
  ) {
    return "Supabase đang giới hạn gửi email khôi phục. Hãy chờ ít nhất 60 giây trước khi thử lại. Nếu vẫn gặp lỗi, quản trị viên cần kiểm tra hạn mức email hoặc cấu hình SMTP riêng."
  }

  if (message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return "Không thể kết nối máy chủ. Kiểm tra mạng và thử lại."
  }

  return message
}