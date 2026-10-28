"use client"

import { ArrowRight, BookOpen, CircleHelp } from "lucide-react"
import { StudentAppShell, type StudentManagementNavigation } from "@/components/student-app-shell"

type StudyGuideScreenProps = {
  studentName: string
  studentEmail: string
  studentInitials: string
  onHome: () => void
  onMyDocuments: () => void
  onOpenStats: () => void
  onLogout: () => void
  managementNavigation: StudentManagementNavigation
}

const guideSteps = [
  {
    title: "Chọn môn học",
    description: "Mở Trang chủ và chọn môn bạn muốn học. Danh sách bài giảng được sắp xếp theo từng chương.",
  },
  {
    title: "Mở bài giảng",
    description: "Chọn một chương để xem slide, đọc nội dung chính và chuyển qua lại giữa các trang slide.",
  },
  {
    title: "Ôn tập và hỏi đáp",
    description: "Dùng khung hỏi đáp ngay trong tài liệu để ghi lại câu hỏi, tóm tắt nội dung hoặc tạo hoạt động ôn tập.",
  },
  {
    title: "Xem lại tài liệu đã học",
    description: "Tài liệu của tôi lưu những bài giảng bạn đã mở, số câu hỏi và thời gian học của từng tài liệu. Mục Thống kê học tập theo dõi thời gian và số tài liệu đã mở mỗi ngày.",
  },
]

export function StudyGuideScreen({ studentName, studentEmail, studentInitials, onHome, onMyDocuments, onOpenStats, onLogout, managementNavigation }: StudyGuideScreenProps) {
  return (
    <StudentAppShell
      activeSection={null}
      pageTitle="Hướng dẫn học"
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onHome}
      onNavigateMyDocuments={onMyDocuments}
      onNavigateStats={onOpenStats}
      onNavigateGuide={() => {}}
      onLogout={onLogout}
      {...managementNavigation}
    >
      <article className="study-guide-page" aria-labelledby="study-guide-title">
        <p className="student-eyebrow"><CircleHelp aria-hidden="true" /> HƯỚNG DẪN NHANH</p>
        <h1 id="study-guide-title">Cách học cùng NEULEARN</h1>
        <p className="student-page-description">Một vài bước đơn giản để tìm bài giảng, học slide và xem lại nội dung của bạn.</p>

        <ol className="study-guide-steps">
          {guideSteps.map((step, index) => (
            <li className="study-guide-step" key={step.title}>
              <span className="study-guide-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="study-guide-note">
          <BookOpen aria-hidden="true" />
          <p><strong>Mẹo nhỏ:</strong> Học từng chương, ghi lại câu hỏi quan trọng và quay lại Tài liệu của tôi để theo dõi thời gian học.</p>
        </div>
        <button className="student-primary-button" type="button" onClick={onHome}>
          Về trang chủ <ArrowRight aria-hidden="true" />
        </button>
      </article>
    </StudentAppShell>
  )
}
