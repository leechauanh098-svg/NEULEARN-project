"use client"

import { CheckCircle, Terminal, XCircle } from "lucide-react"
import type { CheckResult } from "@/lib/coding-practice-api"

type Props = {
  result: CheckResult | null
  checking: boolean
  hasChecked: boolean
}

export function ConsoleOutput({ result, checking, hasChecked }: Props) {
  return (
    <aside className="cp-panel cp-output-panel" aria-labelledby="cp-output-title">
      <div className="cp-panel-section">
        <div className="cp-section-header">
          <Terminal aria-hidden="true" />
          <h2 id="cp-output-title">Console Output</h2>
          {hasChecked && result && (
            <span className={`cp-output-badge${result.allDone ? " cp-badge-pass" : " cp-badge-fail"}`}>
              {result.allDone ? "Hoàn thành" : "Chưa đạt"}
            </span>
          )}
        </div>

        {/* Terminal output */}
        <div className="cp-console" aria-label="Output chương trình">
          <div className="cp-console-bar">
            <span className="cp-console-dot cp-dot-red" />
            <span className="cp-console-dot cp-dot-yellow" />
            <span className="cp-console-dot cp-dot-green" />
            <span className="cp-console-label">Terminal</span>
          </div>
          <div className="cp-console-body">
            {checking ? (
              <p className="cp-console-checking" role="status">
                <span className="cp-blink">▋</span> Đang thực thi mã Java…
              </p>
            ) : result ? (
              <pre className="cp-console-output">{result.simulatedOutput || "(Không có nội dung xuất ra console)"}</pre>
            ) : (
              <p className="cp-console-idle">
                <span className="cp-console-prompt">&gt;&gt;&gt;</span> Nhấn <strong>Run</strong> để thực thi và kiểm tra kết quả.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Task result list */}
      {hasChecked && result && (
        <div className="cp-panel-section cp-task-results">
          <p className="cp-results-label">Trạng thái Checkpoints:</p>
          <ul aria-label="Kết quả kiểm tra các task">
            {[...result.passed.map((id) => ({ id, ok: true })), ...result.failed.map((id) => ({ id, ok: false }))]
              .sort((a, b) => a.id - b.id)
              .map(({ id, ok }) => (
                <li key={id} className={`cp-task-result${ok ? " cp-result-ok" : " cp-result-fail"}`}>
                  {ok ? <CheckCircle aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                  <span>Checkpoint {id}: {ok ? "Đạt yêu cầu" : (result.taskErrors?.[id] ?? "Chưa hoàn thành")}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Feedback section */}
      {hasChecked && result?.feedback && (
        <div className="cp-panel-section cp-feedback-section">
          <p className="cp-feedback-label">Đánh giá kết quả:</p>
          <p className="cp-feedback-text">{result.feedback}</p>
        </div>
      )}
    </aside>
  )
}
