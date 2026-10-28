"use client"

import { BarChart3, BookOpen, Clock3 } from "lucide-react"
import { StudentAppShell, type StudentManagementNavigation } from "@/components/student-app-shell"

export type DailyStudySummary = {
  date: string
  studySeconds: number
  documentsAccessed: number
}

type StudyStatsScreenProps = {
  dailyStats: DailyStudySummary[]
  today: string
  studentName: string
  studentEmail: string
  studentInitials: string
  onHome: () => void
  onMyDocuments: () => void
  onLogout: () => void
  managementNavigation: StudentManagementNavigation
}

function formatStudyTime(seconds: number) {
  if (seconds < 60) return seconds > 0 ? "Dưới 1 phút" : "0 phút"
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) return `${minutes} phút`
  return remainingMinutes === 0 ? `${hours} giờ` : `${hours} giờ ${remainingMinutes} phút`
}

function formatActivityDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`))
}

function formatShortActivityDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${date}T00:00:00+07:00`))
}

type DailyActivityChartProps = {
  title: string
  summaries: DailyStudySummary[]
  getValue: (summary: DailyStudySummary) => number
  formatValue: (value: number) => string
  formatAccessibleValue: (value: number) => string
  color: "study" | "documents"
}

function DailyActivityChart({
  title,
  summaries,
  getValue,
  formatValue,
  formatAccessibleValue,
  color,
}: DailyActivityChartProps) {
  const maxValue = Math.max(...summaries.map(getValue), 1)

  return (
    <figure className={`study-stats-chart study-stats-chart-${color}`}>
      <figcaption>{title}</figcaption>
      <div className="study-stats-chart-plot" role="img" aria-label={`${title} trong ${summaries.length} ngày gần nhất`}>
        {summaries.map((summary) => {
          const value = getValue(summary)
          const barHeight = value > 0 ? Math.max((value / maxValue) * 112, 4) : 0

          return (
            <div className="study-stats-chart-column" key={summary.date} title={`${formatActivityDate(summary.date)}: ${formatAccessibleValue(value)}`}>
              <span className="study-stats-chart-value">{formatValue(value)}</span>
              <div className="study-stats-chart-track">
                <span style={{ height: `${barHeight}px` }} />
              </div>
              <time dateTime={summary.date}>{formatShortActivityDate(summary.date)}</time>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

export function StudyStatsScreen({ dailyStats, today, studentName, studentEmail, studentInitials, onHome, onMyDocuments, onLogout, managementNavigation }: StudyStatsScreenProps) {
  const todayStats = dailyStats.find((summary) => summary.date === today)
  const recentStats = [...dailyStats].reverse()

  return (
    <StudentAppShell
      activeSection="study-stats"
      pageTitle="Thống kê học tập"
      studentName={studentName}
      studentEmail={studentEmail}
      studentInitials={studentInitials}
      onNavigateHome={onHome}
      onNavigateMyDocuments={onMyDocuments}
      onNavigateStats={() => {}}
      onNavigateGuide={onHome}
      onLogout={onLogout}
      {...managementNavigation}
    >
      <section className="study-stats-page" aria-labelledby="study-stats-title">
        <header className="student-page-heading">
          <div>
            <p className="student-eyebrow">THEO DÕI TIẾN ĐỘ</p>
            <h1 id="study-stats-title">Thống kê học tập</h1>
            <p className="student-page-description">Thời gian học và số tài liệu đã truy cập theo từng ngày.</p>
          </div>
        </header>

        <div className="study-stats-today" aria-label="Thống kê hôm nay">
          <article className="study-stats-summary-card">
            <span className="study-stats-summary-icon"><Clock3 aria-hidden="true" /></span>
            <div><span>Thời gian học hôm nay</span><strong>{formatStudyTime(todayStats?.studySeconds ?? 0)}</strong></div>
          </article>
          <article className="study-stats-summary-card">
            <span className="study-stats-summary-icon"><BookOpen aria-hidden="true" /></span>
            <div><span>Tài liệu đã truy cập hôm nay</span><strong>{todayStats?.documentsAccessed ?? 0}</strong></div>
          </article>
        </div>

        <section className="study-stats-history" aria-labelledby="study-stats-history-title">
          <header className="study-stats-history-heading">
            <div>
              <h2 id="study-stats-history-title">Biểu đồ hoạt động theo ngày</h2>
              <p>Lịch sử 7 ngày gần nhất.</p>
            </div>
            <BarChart3 aria-hidden="true" />
          </header>
          {recentStats.length > 0 ? (
            <div className="study-stats-charts">
              <DailyActivityChart
                title="Thời gian học"
                summaries={recentStats}
                getValue={(summary) => summary.studySeconds}
                formatValue={(seconds) => {
                  const minutes = Math.floor(seconds / 60)
                  if (minutes === 0) return seconds > 0 ? "<1p" : "0p"
                  const hours = Math.floor(minutes / 60)
                  const remainingMinutes = minutes % 60
                  return hours > 0 ? `${hours}h${remainingMinutes > 0 ? `${remainingMinutes}p` : ""}` : `${minutes}p`
                }}
                formatAccessibleValue={formatStudyTime}
                color="study"
              />
              <DailyActivityChart
                title="Tài liệu đã truy cập"
                summaries={recentStats}
                getValue={(summary) => summary.documentsAccessed}
                formatValue={(count) => String(count)}
                formatAccessibleValue={(count) => `${count} tài liệu`}
                color="documents"
              />
            </div>
          ) : (
            <div className="student-empty-state study-stats-empty">
              <BarChart3 aria-hidden="true" />
              <strong>Chưa có hoạt động học tập</strong>
              <span>Thời gian học và tài liệu đã mở sẽ được thống kê tại đây.</span>
            </div>
          )}
        </section>
      </section>
    </StudentAppShell>
  )
}
