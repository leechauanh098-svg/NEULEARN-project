export type CoverTone = "blue" | "mint" | "coral" | "violet" | "gold" | "sky"

export type ManagedCourse = {
  id: string
  name: string
  category: string
  description: string
  createdBy?: string
}

export type LearningResource = {
  id: string
  title: string
  course: string
  category: string
  chapter: string
  description: string
  slides: number
  duration: string
  updated: string
  progress: number
  hasCode?: boolean
  filePath?: string
  fileUrl?: string
  courseId?: string
  uploadedBy?: string
  teacher: string
  coverTone: CoverTone
}

export const learningResources: LearningResource[] = [
  {
    id: "networking-tcp-ip",
    title: "Giao thức TCP/IP và mạng Internet",
    course: "Mạng máy tính",
    category: "Cơ sở ngành",
    chapter: "CHƯƠNG 05",
    description: "Nắm vững các tầng giao thức và cách dữ liệu di chuyển trên Internet.",
    slides: 18,
    duration: "45 phút",
    updated: "Cập nhật 24/10/2026",
    progress: 42,
    teacher: "ThS. Minh Anh",
    coverTone: "blue",
  },
  {
    id: "python-loops",
    title: "Vòng lặp và hàm trong Python",
    course: "Lập trình Python",
    category: "Lập trình",
    hasCode: true,
    chapter: "BÀI 08",
    description: "Thực hành for, while và viết hàm để giải quyết bài toán nhỏ.",
    slides: 24,
    duration: "60 phút",
    updated: "Cập nhật 21/10/2026",
    progress: 68,
    teacher: "ThS. Hoàng Nam",
    coverTone: "mint",
  },
  {
    id: "data-structures",
    title: "Cấu trúc dữ liệu: cây nhị phân",
    course: "Cấu trúc dữ liệu",
    category: "Lập trình",
    hasCode: true,
    chapter: "CHƯƠNG 04",
    description: "Tìm hiểu cách tổ chức, duyệt và tìm kiếm trên cây nhị phân.",
    slides: 22,
    duration: "55 phút",
    updated: "Cập nhật 19/10/2026",
    progress: 15,
    teacher: "TS. Quỳnh Chi",
    coverTone: "coral",
  },
  {
    id: "database-sql",
    title: "Truy vấn dữ liệu với SQL",
    course: "Cơ sở dữ liệu",
    category: "Cơ sở ngành",
    chapter: "CHƯƠNG 03",
    description: "Viết câu truy vấn rõ ràng với SELECT, JOIN và GROUP BY.",
    slides: 16,
    duration: "40 phút",
    updated: "Cập nhật 17/10/2026",
    progress: 0,
    teacher: "ThS. Minh Anh",
    coverTone: "violet",
  },
  {
    id: "discrete-math",
    title: "Logic mệnh đề và suy luận",
    course: "Toán rời rạc",
    category: "Toán học",
    chapter: "CHƯƠNG 02",
    description: "Ôn tập các phép toán logic, bảng chân trị và quy tắc suy luận.",
    slides: 20,
    duration: "50 phút",
    updated: "Cập nhật 15/10/2026",
    progress: 84,
    teacher: "TS. Thu Hà",
    coverTone: "gold",
  },
  {
    id: "computer-architecture",
    title: "CPU, bộ nhớ và kiến trúc máy tính",
    course: "Kiến trúc máy tính",
    category: "Cơ sở ngành",
    chapter: "CHƯƠNG 01",
    description: "Khám phá các thành phần cốt lõi tạo nên một hệ thống máy tính.",
    slides: 14,
    duration: "35 phút",
    updated: "Cập nhật 12/10/2026",
    progress: 26,
    teacher: "ThS. Hoàng Nam",
    coverTone: "sky",
  },
]

export const resourceCategories = ["Tất cả", "Lập trình", "Cơ sở ngành", "Toán học"]

export const starterCode = `name = "Châu Anh"
scores = [8, 9, 10]

average = sum(scores) / len(scores)
print(f"Xin chào, {name}!")
print(f"Điểm trung bình: {average:.1f}")`
