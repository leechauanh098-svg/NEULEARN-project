"use client"

import { type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Play, RotateCcw } from "lucide-react"
import type { LearningResource } from "@/lib/study-data"
import { type CheckResult, type CodingExercise, evaluateJavaCode, fetchJavaExercises, staticJavaExercises } from "@/lib/coding-practice-api"
import { BrandLogo } from "@/components/brand-logo"
import { TaskPanel } from "./task-panel"
import { PracticeEditor } from "./practice-editor"
import { ConsoleOutput } from "./console-output"
import { SolutionModal } from "./solution-modal"

type Props = {
  resource: LearningResource
  onBack: () => void
  onHome: () => void
  getAccessToken: () => Promise<string>
}

export function CodingPracticeScreen({ resource, onBack, onHome }: Props) {
  const [exercises, setExercises] = useState<CodingExercise[]>(staticJavaExercises)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [code, setCode] = useState("")
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [hasChecked, setHasChecked] = useState(false)
  const [showSolutionModal, setShowSolutionModal] = useState(false)
  const [paneWidths, setPaneWidths] = useState([28, 44, 28])
  const [activeSplitter, setActiveSplitter] = useState<number | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const activeSplitterRef = useRef<number | null>(null)

  const currentExercise: CodingExercise = exercises[exerciseIndex] ?? staticJavaExercises[0]
  const totalExercises = exercises.length
  const passedIds = checkResult?.passed ?? []
  const allDone = checkResult?.allDone ?? false

  // ─── Initialize exercise ─────────────────────────────────────────────────────
  const loadExercises = useCallback(async () => {
    try {
      const list = await fetchJavaExercises()
      if (list && list.length > 0) {
        setExercises(list)
        setCode(list[0].starterCode)
      } else {
        setCode(staticJavaExercises[0].starterCode)
      }
    } catch {
      setCode(staticJavaExercises[0].starterCode)
    }
  }, [])

  useEffect(() => {
    void loadExercises()
  }, [loadExercises])

  // Update code when exercise changes
  const switchExercise = (idx: number) => {
    if (idx >= 0 && idx < exercises.length) {
      setExerciseIndex(idx)
      setCode(exercises[idx].starterCode)
      setCheckResult(null)
      setHasChecked(false)
    }
  }

  // ─── Check solution (Deterministic Rule-Based) ──────────────────────────────
  const handleCheck = () => {
    if (!currentExercise || checking) return
    setChecking(true)
    setTimeout(() => {
      const result = evaluateJavaCode(code, currentExercise)
      setCheckResult(result)
      setHasChecked(true)
      setChecking(false)
    }, 150)
  }

  const handleReset = () => {
    if (currentExercise) {
      setCode(currentExercise.starterCode)
      setCheckResult(null)
      setHasChecked(false)
    }
  }

  const handleApplySolution = (solCode: string) => {
    setCode(solCode)
    setCheckResult(null)
    setHasChecked(false)
  }

  // ─── Resizable panes ─────────────────────────────────────────────────────────
  const startResize = (event: ReactPointerEvent<HTMLDivElement>, idx: number) => {
    event.preventDefault()
    activeSplitterRef.current = idx
    setActiveSplitter(idx)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const resizePanes = (event: ReactPointerEvent<HTMLDivElement>) => {
    const idx = activeSplitterRef.current
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (idx === null || !bounds || bounds.width <= 0) return
    const pos = ((event.clientX - bounds.left) / bounds.width) * 100
    setPaneWidths((cur) => {
      const [left, mid, right] = cur
      if (idx === 0) {
        const nextLeft = Math.min(45, Math.max(20, pos))
        return [nextLeft, 100 - nextLeft - right, right]
      }
      const nextMid = Math.min(80 - left, Math.max(22, pos - left))
      return [left, nextMid, 100 - left - nextMid]
    })
  }

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activeSplitterRef.current = null
    setActiveSplitter(null)
  }

  const resizeKeyboard = (event: KeyboardEvent<HTMLDivElement>, idx: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const delta = event.key === "ArrowRight" ? 2 : -2
    setPaneWidths((cur) => {
      const [left, mid, right] = cur
      if (idx === 0) {
        const nextLeft = Math.min(45, Math.max(20, left + delta))
        return [nextLeft, 100 - nextLeft - right, right]
      }
      const nextMid = Math.min(80 - left, Math.max(22, mid + delta))
      return [left, nextMid, 100 - left - nextMid]
    })
  }

  return (
    <main className="cp-screen">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="cp-topbar">
        <div className="cp-topbar-left">
          <button className="workspace-back" type="button" onClick={onBack} aria-label="Quay lại tài liệu">
            <ArrowLeft aria-hidden="true" />
          </button>
          <BrandLogo compact onClick={onHome} />
          <span className="workspace-title-divider" />
          <div className="cp-breadcrumb">
            <span>{resource.course}</span>
            <ArrowRight aria-hidden="true" />
            <strong>{currentExercise.title}</strong>
          </div>
        </div>
        <div className="cp-topbar-right">
          {allDone && <span className="cp-done-badge"><Check aria-hidden="true" /> Hoàn thành!</span>}
        </div>
      </header>

      {/* ── Main 3-panel workspace ───────────────────────────────────────────── */}
      <div
        className={`cp-workspace${activeSplitter !== null ? " is-resizing" : ""}`}
        ref={workspaceRef}
        style={{
          "--cp-left": `${paneWidths[0]}fr`,
          "--cp-mid": `${paneWidths[1]}fr`,
          "--cp-right": `${paneWidths[2]}fr`,
        } as CSSProperties}
      >
        {/* Left: Task panel */}
        <TaskPanel
          exercise={currentExercise}
          passedIds={passedIds}
          taskErrors={checkResult?.taskErrors}
          hasChecked={hasChecked}
          exerciseIndex={exerciseIndex}
          totalExercises={totalExercises}
          onShowSolution={() => setShowSolutionModal(true)}
        />

        {/* Splitter 0 */}
        <div
          className="code-workspace-splitter"
          role="separator"
          aria-label="Điều chỉnh độ rộng hướng dẫn và editor"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={(e) => startResize(e, 0)}
          onPointerMove={resizePanes}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={(e) => resizeKeyboard(e, 0)}
        ><span /></div>

        {/* Middle: Editor */}
        <section className="cp-panel cp-editor-panel" aria-labelledby="cp-editor-title">
          <div className="cp-editor-topbar">
            <div className="cp-file-tab">
              <span className="cp-lang-dot cp-lang-java" aria-hidden="true" />
              <span>{currentExercise.fileName}</span>
            </div>
            <div className="cp-editor-actions-top">
              <span className="cp-lang-badge">Java</span>
              <button
                className="reset-code"
                type="button"
                onClick={handleReset}
                aria-label="Đặt lại code về ban đầu"
                title="Đặt lại code"
              >
                <RotateCcw aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="cp-editor-body">
            <PracticeEditor code={code} onChange={setCode} />
          </div>

          <div className="cp-editor-footer">
            <button
              className="cp-run-code-button"
              type="button"
              onClick={handleCheck}
              disabled={checking || !code.trim()}
              aria-busy={checking}
              title="Chạy chương trình và kiểm tra kết quả"
            >
              <Play aria-hidden="true" fill="currentColor" /> Run
            </button>
          </div>
        </section>

        {/* Splitter 1 */}
        <div
          className="code-workspace-splitter"
          role="separator"
          aria-label="Điều chỉnh độ rộng editor và output"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={(e) => startResize(e, 1)}
          onPointerMove={resizePanes}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={(e) => resizeKeyboard(e, 1)}
        ><span /></div>

        {/* Right: Console output */}
        <ConsoleOutput result={checkResult} checking={checking} hasChecked={hasChecked} />
      </div>

      {/* ── Bottom navigation bar ────────────────────────────────────────────── */}
      <footer className="cp-bottombar">
        <button
          className="cp-nav-btn"
          type="button"
          onClick={() => switchExercise(exerciseIndex - 1)}
          disabled={exerciseIndex === 0}
          title="Quay lại bài trước"
        >
          <ChevronLeft aria-hidden="true" /> Quay lại
        </button>
        <span className="cp-exercise-counter">
          {exerciseIndex + 1}/{totalExercises}
        </span>
        <button
          className={`cp-nav-btn cp-next-btn${allDone ? " cp-next-ready" : ""}`}
          type="button"
          onClick={() => switchExercise(exerciseIndex + 1)}
          disabled={!allDone || exerciseIndex >= totalExercises - 1}
          title={allDone ? "Chuyển sang bài tiếp theo" : "Hoàn thành tất cả nhiệm vụ để mở khóa"}
        >
          Bài tiếp theo <ChevronRight aria-hidden="true" />
        </button>
      </footer>

      {/* ── Solution Modal ───────────────────────────────────────────────────── */}
      <SolutionModal
        isOpen={showSolutionModal}
        onClose={() => setShowSolutionModal(false)}
        solutionCode={currentExercise.solutionCode}
        solutionExplanation={currentExercise.solutionExplanation}
        fileName={currentExercise.fileName}
        onApplySolution={handleApplySolution}
      />
    </main>
  )
}
