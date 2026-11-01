"use client"

import { BookOpen, CheckSquare, ChevronRight, HelpCircle, Key } from "lucide-react"
import type { CodingExercise } from "@/lib/coding-practice-api"

type Props = {
  exercise: CodingExercise
  passedIds: number[]
  taskErrors?: Record<number, string>
  hasChecked: boolean
  exerciseIndex: number
  totalExercises: number
  onShowSolution: () => void
}

function renderFormattedText(text: string) {
  // Simple formatter for bullet points, bold, and inline code
  const lines = text.split("\n")
  return lines.map((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return <div key={idx} className="cp-text-spacer" />
    }
    if (trimmed.startsWith("### ")) {
      return <h3 key={idx} className="cp-lesson-h3">{trimmed.slice(4)}</h3>
    }
    if (trimmed.startsWith("- ")) {
      return (
        <li key={idx} className="cp-lesson-bullet">
          {formatInline(trimmed.slice(2))}
        </li>
      )
    }
    return (
      <p key={idx} className="cp-lesson-p">
        {formatInline(trimmed)}
      </p>
    )
  })
}

function formatInline(str: string) {
  // Matches `code` and **bold**
  const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="cp-code-tag">{part.slice(1, -1)}</code>
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="cp-strong-tag">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function TaskPanel({ exercise, passedIds, taskErrors, hasChecked, exerciseIndex, totalExercises, onShowSolution }: Props) {
  const passedSet = new Set(passedIds)
  // Only show error for the next task right after the last passed one
  const maxPassedId = passedIds.length > 0 ? Math.max(...passedIds) : 0
  const nextTaskId = maxPassedId + 1

  return (
    <aside className="cp-panel cp-task-panel" aria-labelledby="cp-learn-title">
      {/* Learn section */}
      <div className="cp-panel-section cp-learn-section">
        <div className="cp-section-header">
          <BookOpen aria-hidden="true" />
          <h2 id="cp-learn-title">Bài học</h2>
          {exercise.subtitle && <span className="cp-learn-badge">{exercise.subtitle}</span>}
        </div>
        <div className="cp-lesson-text">
          {renderFormattedText(exercise.lesson)}
        </div>
      </div>

      {/* Instructions / tasks */}
      <div className="cp-panel-section cp-instructions-section">
        <div className="cp-section-header">
          <CheckSquare aria-hidden="true" />
          <h3>Hướng dẫn thực hành</h3>
          <span className="cp-task-progress">
            {passedIds.length}/{exercise.tasks.length}
          </span>
        </div>

        <ol className="cp-task-list" aria-label="Danh sách yêu cầu bài tập">
          {exercise.tasks.map((task) => {
            const done = passedSet.has(task.id)
            const errorMsg = taskErrors?.[task.id]
            return (
              <li key={task.id} className={`cp-task-item${done ? " cp-task-done" : ""}`}>
                <span className="cp-task-checkbox" aria-hidden="true">
                  {done ? "✅" : "☐"}
                </span>
                <div className="cp-task-body">
                  <div className="cp-task-title-row">
                    <span className="cp-task-badge">{task.title ?? `Checkpoint ${task.id}`}</span>
                    {done && <span className="cp-passed-tag">Passed</span>}
                  </div>
                  <p className="cp-task-text">{task.text}</p>

                  {hasChecked && errorMsg && !done && task.id === nextTaskId && (
                    <div className="cp-task-error" role="alert">
                      <HelpCircle aria-hidden="true" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* hint removed per UX request */}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Exercise footer & Show solution button */}
      <div className="cp-panel-footer">
        <button
          className="cp-solution-btn"
          type="button"
          onClick={onShowSolution}
          title="Xem cách giải bài tập nếu bạn gặp khó khăn"
        >
          <Key aria-hidden="true" />
          <span>Xem đáp án</span>
        </button>
        <span className="cp-panel-footer-count">
          <ChevronRight aria-hidden="true" />
          Bài {exerciseIndex + 1} / {totalExercises}
        </span>
      </div>
    </aside>
  )
}
