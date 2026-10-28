"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpen, RotateCcw } from "lucide-react"

type LearningPdfViewerProps = {
  fileUrl?: string
  title: string
  className?: string
}

export function LearningPdfViewer({ fileUrl, title, className }: LearningPdfViewerProps) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const loadTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!fileUrl) return

    setStatus("loading")
    loadTimeout.current = window.setTimeout(() => setStatus("error"), 20000)

    return () => {
      if (loadTimeout.current !== null) window.clearTimeout(loadTimeout.current)
    }
  }, [attempt, fileUrl])

  const markReady = () => {
    if (loadTimeout.current !== null) window.clearTimeout(loadTimeout.current)
    setStatus("ready")
  }

  const markError = () => {
    if (loadTimeout.current !== null) window.clearTimeout(loadTimeout.current)
    setStatus("error")
  }

  if (!fileUrl) {
    return (
      <div className={`document-empty-state${className ? ` ${className}` : ""}`} role="status">
        <BookOpen aria-hidden="true" />
        <strong>Chưa có file bài giảng</strong>
        <span>Tài liệu này chưa có PDF để hiển thị.</span>
      </div>
    )
  }

  return (
    <div className={`document-frame-wrap${className ? ` ${className}` : ""}`}>
      <iframe
        key={attempt}
        className="slide-pdf-frame"
        src={fileUrl}
        title={title}
        onLoad={markReady}
        onError={markError}
      />
      {status === "loading" && (
        <p className="document-frame-status" role="status">Đang tải tài liệu…</p>
      )}
      {status === "error" && (
        <div className="document-frame-error" role="alert">
          <strong>Không tải được tài liệu</strong>
          <button
            type="button"
            onClick={() => {
              setAttempt((current) => current + 1)
            }}
          >
            <RotateCcw aria-hidden="true" /> Thử tải lại
          </button>
        </div>
      )}
    </div>
  )
}
