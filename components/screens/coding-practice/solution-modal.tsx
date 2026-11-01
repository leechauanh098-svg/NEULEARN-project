"use client"

import { Check, Copy, Key, X } from "lucide-react"
import { useState } from "react"

type Props = {
  isOpen: boolean
  onClose: () => void
  solutionCode: string
  solutionExplanation: string
  fileName: string
  onApplySolution: (code: string) => void
}

export function SolutionModal({ isOpen, onClose, solutionCode, solutionExplanation, fileName, onApplySolution }: Props) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(solutionCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleApply = () => {
    onApplySolution(solutionCode)
    onClose()
  }

  return (
    <div className="cp-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="cp-modal-title">
      <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cp-modal-header">
          <div className="cp-modal-title-group">
            <Key className="cp-key-icon" aria-hidden="true" />
            <h2 id="cp-modal-title">Đáp án gợi ý</h2>
            <span className="cp-modal-filename">{fileName}</span>
          </div>
          <button className="cp-modal-close" onClick={onClose} type="button" aria-label="Đóng cửa sổ">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="cp-modal-body">
          <div className="cp-modal-code-wrapper">
            <div className="cp-code-header">
              <span>Code mẫu:</span>
              <button className="cp-copy-btn" onClick={() => void handleCopy()} type="button">
                {copied ? <><Check aria-hidden="true" /> Đã sao chép</> : <><Copy aria-hidden="true" /> Sao chép code</>}
              </button>
            </div>
            <pre className="cp-solution-code">
              {solutionCode || "// Chưa có đáp án cho bài này."}
            </pre>
          </div>
        </div>

        <div className="cp-modal-footer">
          <button className="cp-modal-cancel" onClick={onClose} type="button">
            Đóng
          </button>
          <button className="cp-modal-apply" onClick={handleApply} type="button">
            Áp dụng vào Editor
          </button>
        </div>
      </div>
    </div>
  )
}
