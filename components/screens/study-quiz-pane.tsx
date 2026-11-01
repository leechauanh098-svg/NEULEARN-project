"use client"

import { ArrowRight, BookOpen, ListChecks } from "lucide-react"
import type { MaterialQuiz, QuizChoice } from "@/lib/flask-api"

type StudyQuizPlayerProps = {
  quiz: MaterialQuiz
  index: number
  selectedId: QuizChoice["id"] | null
  onSelect: (choiceId: QuizChoice["id"]) => void
  onNext: () => void
  onOpenPage: (page: number) => void
}

export function StudyQuizPlayer({ quiz, index, selectedId, onSelect, onNext, onOpenPage }: StudyQuizPlayerProps) {
  const question = quiz.questions[index]
  if (!question) return null
  const answered = selectedId !== null
  const isLast = index >= quiz.questions.length - 1

  return (
    <div className="quiz-player">
      <div className="quiz-player-meta">
        <p className="quiz-player-kicker">{quiz.title}</p>
        <span className="quiz-player-badge">Câu {index + 1} / {quiz.questions.length}</span>
      </div>
      <h3 className="quiz-player-prompt">{question.prompt}</h3>
      <div className="quiz-choices" role="radiogroup" aria-label={`Đáp án câu ${index + 1}`}>
        {question.choices.map((choice) => {
          const isCorrect = answered && choice.id === question.correctId
          const isWrong = answered && choice.id === selectedId && choice.id !== question.correctId
          const isMuted = answered && !isCorrect && !isWrong
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={selectedId === choice.id}
              className={`quiz-choice${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}${isMuted ? " is-muted" : ""}`}
              disabled={answered}
              onClick={() => onSelect(choice.id)}
            >
              <span className="quiz-choice-id">{choice.id}</span>
              <span className="quiz-choice-text">{choice.text}</span>
            </button>
          )
        })}
      </div>
      {answered && (
        <div className="quiz-explain" role="region" aria-label="Giải thích đáp án">
          <p className="quiz-explain-text">{question.explanation || "Đáp án được trích xuất từ nội dung tài liệu."}</p>
          <button
            type="button"
            className="quiz-cite"
            onClick={() => onOpenPage(question.page)}
            title={`Chuyển đến slide trang ${question.page}`}
          >
            <BookOpen className="quiz-cite-icon" aria-hidden="true" />
            <span>Trang {question.page}</span>
          </button>
        </div>
      )}
      <div className="quiz-player-nav">
        <button
          type="button"
          className="quiz-next"
          onClick={onNext}
          disabled={!answered}
          aria-label={isLast ? "Xem kết quả quiz" : "Câu tiếp theo"}
          title={isLast ? "Xem kết quả quiz" : "Câu tiếp theo"}
        >
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

type QuizHistoryPaneProps = {
  quizzes: MaterialQuiz[]
  activeId: string | null
  loading: boolean
  onSelect: (quiz: MaterialQuiz) => void
}

export function QuizHistoryPane({ quizzes, activeId, loading, onSelect }: QuizHistoryPaneProps) {
  return (
    <section className="quiz-history-pane" aria-labelledby="quiz-history-title">
      <div className="pane-heading chat-pane-heading">
        <h2 id="quiz-history-title">Lịch sử quiz</h2>
      </div>
      {loading ? <p className="chat-status" role="status">Đang tải lịch sử…</p> : null}
      {!loading && quizzes.length === 0 ? (
        <p className="quiz-history-empty">Chưa có đề quiz. Bấm Tạo quiz để soạn 5 câu trắc nghiệm từ toàn bộ tài liệu.</p>
      ) : (
        <ul className="quiz-history-list">
          {quizzes.map((quiz, order) => (
            <li key={quiz.id}>
              <button
                type="button"
                className={`quiz-history-item${quiz.id === activeId ? " is-active" : ""}`}
                onClick={() => onSelect(quiz)}
              >
                <ListChecks aria-hidden="true" />
                <span>
                  <strong>{quiz.title || `Quiz ${quizzes.length - order}`}</strong>
                  <small>{formatQuizTime(quiz.createdAt)} · {quiz.questions.length} câu</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatQuizTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Vừa tạo"
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
}
