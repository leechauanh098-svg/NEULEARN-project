"use client"

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Check, Code2, Play, RotateCcw, Terminal } from "lucide-react"
import type { LearningResource } from "@/lib/study-data"
import { starterCode } from "@/lib/study-data"
import { BrandLogo } from "@/components/brand-logo"
import { LearningPdfViewer } from "@/components/screens/learning-pdf-viewer"

type CodeLearningScreenProps = {
  resource: LearningResource
  onBack: () => void
  onHome: () => void
}

export function CodeLearningScreen({ resource, onBack, onHome }: CodeLearningScreenProps) {
  const [code, setCode] = useState(starterCode)
  const [hasRun, setHasRun] = useState(false)
  const [paneWidths, setPaneWidths] = useState([22, 48, 30])
  const [activeSplitter, setActiveSplitter] = useState<number | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const activeSplitterRef = useRef<number | null>(null)
  const lineCount = Math.max(1, code.split("\n").length)
  const nameMatch = code.match(/name\s*=\s*["']([^"'\n]*)["']/)
  const scoresMatch = code.match(/scores\s*=\s*\[([0-9,\s]+)\]/)
  const scores = scoresMatch ? scoresMatch[1].split(",").map((score) => Number(score.trim())).filter((score) => Number.isFinite(score)) : []
  const outputName = nameMatch?.[1] || "sinh viên"
  const average = scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : 0

  const startResize = (event: ReactPointerEvent<HTMLDivElement>, splitterIndex: number) => {
    event.preventDefault()
    activeSplitterRef.current = splitterIndex
    setActiveSplitter(splitterIndex)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const resizePanes = (event: ReactPointerEvent<HTMLDivElement>) => {
    const splitterIndex = activeSplitterRef.current
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (splitterIndex === null || !bounds || bounds.width <= 0) return

    const position = ((event.clientX - bounds.left) / bounds.width) * 100
    setPaneWidths((current) => {
      const [guide, editor, output] = current
      if (splitterIndex === 0) {
        const maxGuide = Math.min(60, 100 - output - 22)
        const nextGuide = Math.min(maxGuide, Math.max(18, position))
        return [nextGuide, 100 - nextGuide - output, output]
      }

      const nextEditor = Math.min(82 - guide, Math.max(22, position - guide))
      return [guide, nextEditor, 100 - guide - nextEditor]
    })
  }

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activeSplitterRef.current = null
    setActiveSplitter(null)
  }

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>, splitterIndex: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const delta = event.key === "ArrowRight" ? 2 : -2
    setPaneWidths((current) => {
      const [guide, editor, output] = current
      if (splitterIndex === 0) {
        const maxGuide = Math.min(60, 100 - output - 22)
        const nextGuide = Math.min(maxGuide, Math.max(18, guide + delta))
        return [nextGuide, 100 - nextGuide - output, output]
      }

      const nextEditor = Math.min(82 - guide, Math.max(22, editor + delta))
      return [guide, nextEditor, 100 - guide - nextEditor]
    })
  }

  return (
    <main className="code-screen simple-code-screen">
      <header className="code-topbar">
        <div className="code-topbar-left">
          <button className="workspace-back" type="button" onClick={onBack} aria-label="Quay lại tài liệu">
            <ArrowLeft aria-hidden="true" />
          </button>
          <BrandLogo compact onClick={onHome} />
          <span className="workspace-title-divider" />
          <div className="code-breadcrumb"><span>{resource.course}</span><ArrowRight aria-hidden="true" /><span>{resource.title}</span><ArrowRight aria-hidden="true" /><strong>Thực hành code</strong></div>
        </div>
        <div className="code-topbar-actions">
          <span className="code-save-state"><Check aria-hidden="true" /> Bản thực hành</span>
          <button className="code-back-library" type="button" onClick={onHome}>Trang chủ <ArrowRight aria-hidden="true" /></button>
        </div>
      </header>

      <div
        className={`code-workspace-grid simple-code-grid resizable-code-grid${activeSplitter !== null ? " is-resizing" : ""}`}
        ref={workspaceRef}
        style={{
          "--guide-pane": `${paneWidths[0]}fr`,
          "--editor-pane": `${paneWidths[1]}fr`,
          "--output-pane": `${paneWidths[2]}fr`,
        } as CSSProperties}
      >
        <aside className="code-panel code-guide-panel simple-code-guide" aria-labelledby="guide-title">
          <div className="code-panel-heading">
            <div>
              <h1 id="guide-title">Hướng dẫn code</h1>
            </div>
            <span className="guide-language-badge">Python</span>
          </div>

          <div className="slide-viewer simple-code-document-viewer" role="region" aria-label={`Tài liệu hướng dẫn ${resource.title}`}>
            <LearningPdfViewer key={resource.fileUrl ?? "missing"} fileUrl={resource.fileUrl} title={`Bài giảng ${resource.title}`} />
          </div>

          <p className="guide-footer"><BookOpen aria-hidden="true" /> Bài giảng: {resource.title}</p>
        </aside>

        <div
          className="code-workspace-splitter"
          role="separator"
          aria-label="Điều chỉnh độ rộng hướng dẫn và code"
          aria-orientation="vertical"
          aria-valuemin={18}
          aria-valuemax={60}
          aria-valuenow={Math.round(paneWidths[0])}
          tabIndex={0}
          onPointerDown={(event) => startResize(event, 0)}
          onPointerMove={resizePanes}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={(event) => resizeWithKeyboard(event, 0)}
        ><span /></div>

        <section className="code-panel code-editor-panel simple-code-editor" aria-labelledby="editor-title">
          <div className="editor-heading">
            <div><h1 id="editor-title">Viết code</h1></div>
            <div className="editor-toolbar">
              <span className="language-select"><span className="python-mark">Py</span> Python</span>
              <button className="reset-code" type="button" onClick={() => { setCode(starterCode); setHasRun(false) }} aria-label="Đặt lại code">
                <RotateCcw aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="editor-filebar"><span className="python-mark">Py</span><span>main.py</span></div>
          <div className="code-editor" aria-label="Trình soạn thảo code Python">
            <div className="line-numbers" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label="Viết code Python" />
          </div>
          <div className="editor-bottom-bar"><span><span className="editor-status-dot" /> Python 3 · Bản demo</span><span>{lineCount} dòng</span></div>
          <div className="editor-actions">
            <span className="editor-tip"><Code2 aria-hidden="true" /> Chỉnh sửa ví dụ rồi chạy thử.</span>
            <button className="run-code-button" type="button" onClick={() => setHasRun(true)}><Play aria-hidden="true" fill="currentColor" /> Chạy thử</button>
          </div>
        </section>

        <div
          className="code-workspace-splitter"
          role="separator"
          aria-label="Điều chỉnh độ rộng code và kết quả"
          aria-orientation="vertical"
          aria-valuemin={40}
          aria-valuemax={82}
          aria-valuenow={Math.round(paneWidths[0] + paneWidths[1])}
          tabIndex={0}
          onPointerDown={(event) => startResize(event, 1)}
          onPointerMove={resizePanes}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={(event) => resizeWithKeyboard(event, 1)}
        ><span /></div>

        <aside className="code-panel code-output-panel simple-code-output" aria-labelledby="output-title">
          <div className="output-heading">
            <div><h2 id="output-title">Kết quả đầu ra</h2></div>
            <span className={`output-status${hasRun ? " output-status-run" : ""}`}><i /> {hasRun ? "Đã chạy" : "Sẵn sàng"}</span>
          </div>
          <p className="simple-code-output-resource">{resource.title}</p>
          <div className="output-console">
            <div className="console-topbar"><span><Terminal aria-hidden="true" /> Kết quả</span></div>
            <div className="console-content"><span className="console-prompt">&gt;&gt;&gt;</span><pre>{"Xin chào, " + outputName + "!\nĐiểm trung bình: " + average.toFixed(1)}</pre><span className="console-cursor" aria-hidden="true" /></div>
            <div className="console-success"><Check aria-hidden="true" /><span>{hasRun ? "Đã cập nhật kết quả" : "Kết quả minh họa"}</span></div>
          </div>
          <p className="simulation-note"></p>
        </aside>
      </div>
    </main>
  )
}
