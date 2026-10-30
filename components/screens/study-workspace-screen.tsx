"use client"

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Code2, FileText, ListChecks, MessageCircle, Send, Workflow } from "lucide-react"
import type { LearningResource } from "@/lib/study-data"
import { askFlaskMaterialChat, type ChatCitation } from "@/lib/flask-api"
import { BrandLogo } from "@/components/brand-logo"
import { LearningPdfViewer } from "@/components/screens/learning-pdf-viewer"

type StudyWorkspaceScreenProps = {
  resource: LearningResource
  studentName: string
  studentInitials: string
  onBack: () => void
  onHome: () => void
  onLearnCode: () => void
  onQuestionAsked: (resourceId: string) => void
  onStudySeconds: (resourceId: string, seconds: number) => void
  getAccessToken: () => Promise<string>
}

type ChatMessage = {
  id: string
  role: "assistant" | "student"
  text: string
  kind?: "quiz" | "mindmap"
  citations?: ChatCitation[]
}

export function StudyWorkspaceScreen({ resource, studentName, studentInitials, onBack, onHome, onLearnCode, onQuestionAsked, onStudySeconds, getAccessToken }: StudyWorkspaceScreenProps) {
  const [page, setPage] = useState(1)
  const [answering, setAnswering] = useState(false)
  const canChat = resource.indexStatus === "ready"
  const chatUnavailableReason =
    resource.indexStatus === "pending" ? "Tài liệu đang được xử lý nên chưa thể hỏi đáp."
      : resource.indexStatus === "failed" ? "Không đọc được nội dung tài liệu này (có thể là PDF ảnh scan). Giảng viên cần tải lại hoặc lập chỉ mục lại."
        : "Tài liệu mẫu chưa hỗ trợ hỏi đáp AI."
  const [draft, setDraft] = useState("")
  const [sourceRatio, setSourceRatio] = useState(62)
  const [resizing, setResizing] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: `Chào ${studentName}! Mình đang đồng hành cùng bạn trong tài liệu “${resource.title}”. Bạn có thể hỏi về một khái niệm, nhờ tóm tắt nội dung hoặc tạo hoạt động ôn tập.` },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  useEffect(() => {
    const startedAt = Date.now()
    let reportedSeconds = 0
    const saveElapsedTime = () => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
      const secondsToSave = elapsedSeconds - reportedSeconds
      if (secondsToSave > 0) {
        onStudySeconds(resource.id, secondsToSave)
        reportedSeconds = elapsedSeconds
      }
    }
    const intervalId = window.setInterval(saveElapsedTime, 15000)
    return () => {
      window.clearInterval(intervalId)
      saveElapsedTime()
    }
  }, [onStudySeconds, resource.id])

  const addMessage = (message: Omit<ChatMessage, "id">) => {
    setMessages((current) => [...current, { ...message, id: `${Date.now()}-${Math.random()}` }])
  }

  const sendMessage = async () => {
    const question = draft.trim()
    if (!question || answering || !canChat) return
    const history = messages
      .filter((message) => !message.kind && message.id !== "welcome")
      .map((message) => ({ role: message.role, text: message.text }))
    onQuestionAsked(resource.id)
    addMessage({ role: "student", text: question })
    setDraft("")
    setAnswering(true)
    try {
      const { answer, citations } = await askFlaskMaterialChat(await getAccessToken(), resource.id, question, history)
      addMessage({ role: "assistant", text: answer, citations })
    } catch (error) {
      addMessage({ role: "assistant", text: error instanceof Error ? error.message : "Không thể trả lời lúc này. Vui lòng thử lại." })
    } finally {
      setAnswering(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendMessage()
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const createQuiz = () => addMessage({ role: "assistant", kind: "quiz", text: "Quiz nhanh · 3 câu từ tài liệu" })
  const createMindMap = () => addMessage({ role: "assistant", kind: "mindmap", text: "Sơ đồ tư duy · nội dung chính" })

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
  }

  const resizePanes = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0) return
    const nextRatio = ((event.clientX - bounds.left) / bounds.width) * 100
    setSourceRatio(Math.min(76, Math.max(34, nextRatio)))
  }

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setResizing(false)
  }

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const direction = event.key === "ArrowRight" ? 2 : -2
    setSourceRatio((current) => Math.min(76, Math.max(34, current + direction)))
  }

  return (
    <main className="workspace-screen">
      <header className="workspace-topbar">
        <div className="workspace-brand-group">
          <button className="workspace-back" type="button" onClick={onBack} aria-label="Quay lại thư viện"><ArrowLeft aria-hidden="true" /></button>
          <BrandLogo compact onClick={onHome} />
          <span className="workspace-title-divider" />
          <div className="workspace-document-title"><span>Đang học</span><strong>{resource.title}</strong></div>
        </div>
        <div className="workspace-top-actions">
          <span className="source-count"><FileText aria-hidden="true" /> 1 nguồn</span>
          {resource.hasCode && <button className="workspace-code-button" type="button" onClick={onLearnCode}><Code2 aria-hidden="true" /> Học code <ArrowRight aria-hidden="true" /></button>}
          <button className="workspace-avatar" type="button" aria-label={`Tài khoản ${studentName}`}>{studentInitials}</button>
        </div>
      </header>

      <div
        className={`workspace-layout${resizing ? " is-resizing" : ""}`}
        ref={workspaceRef}
        style={{ gridTemplateColumns: `minmax(0, ${sourceRatio}fr) 8px minmax(0, ${100 - sourceRatio}fr)` }}
      >
        <section className="source-pane" aria-labelledby="source-title">
          <div className="pane-heading source-pane-heading">
            <h1 id="source-title">{resource.course}</h1>
            <button className="pane-icon-button" type="button" aria-label="Tùy chọn tài liệu"><FileText aria-hidden="true" /></button>
          </div>
          <div className="slide-viewer">
            <LearningPdfViewer
              key={`${resource.fileUrl ?? "missing"}-${page}`}
              fileUrl={resource.fileUrl ? `${resource.fileUrl}#page=${page}` : undefined}
              title={`${resource.title} · trang ${page}`}
            />
          </div>

        </section>

        <div
          className="workspace-splitter"
          role="separator"
          aria-label="Điều chỉnh độ rộng slide và hỏi đáp"
          aria-orientation="vertical"
          aria-valuemin={34}
          aria-valuemax={76}
          aria-valuenow={Math.round(sourceRatio)}
          tabIndex={0}
          onPointerDown={startResize}
          onPointerMove={resizePanes}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onKeyDown={resizeWithKeyboard}
        ><span /></div>

        <section className="chat-pane" aria-labelledby="chat-title">
          <div className="pane-heading chat-pane-heading">
            <h2 id="chat-title">Hỏi đáp tài liệu</h2>
          </div>

          <div className="chat-context"><span>Đang dựa trên <strong>{resource.title}</strong></span></div>
          {!canChat && <p className="chat-status" role="status">{chatUnavailableReason}</p>}

          <div className="chat-messages" aria-live="polite" aria-label="Nội dung hội thoại">
            {messages.map((message) => (
              <article className={`chat-message ${message.role === "student" ? "student-message" : "assistant-message"}`} key={message.id}>
                {message.role === "assistant" && <span className="message-avatar"><BookOpen aria-hidden="true" /></span>}
                <div className="message-content">
                  {message.role === "assistant" && <span className="message-author">NEULEARN <span>·</span> theo tài liệu</span>}
                  {message.kind === "quiz" ? (
                    <div className="quiz-preview"><strong>{message.text}</strong><ol><li>TCP đảm nhiệm vai trò nào trong mô hình mạng?</li><li>Vì sao dữ liệu cần được chia thành các gói tin?</li><li>Địa chỉ IP giúp xác định điều gì?</li></ol><button type="button" onClick={() => addMessage({ role: "student", text: "Bắt đầu quiz" })}>Bắt đầu quiz <ArrowRight aria-hidden="true" /></button></div>
                  ) : message.kind === "mindmap" ? (
                    <div className="mindmap-preview"><strong>{message.text}</strong><div className="mindmap-center">{resource.course}</div><div className="mindmap-branches"><span>Khái niệm</span><span>Giao thức</span><span>Ứng dụng</span></div></div>
                  ) : <p className="chat-answer-text">{message.text}</p>}
                  {message.citations && message.citations.length > 0 && (
                    <ul className="chat-citations" aria-label="Nguồn trích dẫn trong tài liệu">
                      {message.citations.map((citation) => (
                        <li key={citation.id}>
                          <button type="button" className="chat-citation" onClick={() => setPage(citation.page)} title="Mở trang này trong tài liệu">
                            <strong>[{citation.id}] Trang {citation.page}</strong>
                            <span>“{citation.quote}”</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
            {answering && <p className="chat-status" role="status">Đang tìm trong tài liệu…</p>}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          <div className="chat-bottom-area">
            <p className="tool-label">Công cụ học tập</p>
            <div className="study-tools">
              <button type="button" className="study-tool tool-quiz" onClick={createQuiz}><ListChecks aria-hidden="true" /><strong>Tạo quiz</strong></button>
              <button type="button" className="study-tool tool-map" onClick={createMindMap}><Workflow aria-hidden="true" /><strong>Tạo mind map</strong></button>
              {resource.hasCode && <button type="button" className="study-tool tool-code" onClick={onLearnCode}><Code2 aria-hidden="true" /><strong>Học code</strong></button>}
            </div>

            <form className="chat-composer" onSubmit={handleSubmit}>
              <MessageCircle className="composer-icon" aria-hidden="true" />
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Hỏi về nội dung trong slide..." rows={1} disabled={!canChat} aria-label="Nhập câu hỏi về tài liệu" />
              <span className="composer-hint">Shift + Enter xuống dòng</span>
              <button type="submit" className="send-button" disabled={!draft.trim() || answering || !canChat} aria-label="Gửi câu hỏi"><Send aria-hidden="true" /></button>
            </form>
            <p className="assistant-disclaimer">Hãy đối chiếu nội dung trả lời với tài liệu gốc.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
