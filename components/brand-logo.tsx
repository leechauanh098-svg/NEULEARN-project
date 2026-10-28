import { BookOpen } from "lucide-react"

export function BrandLogo({ compact = false, onClick, actionLabel = "Về trang chủ" }: { compact?: boolean; onClick?: () => void; actionLabel?: string }) {
  const logo = (
    <span className={`brand-logo${compact ? " brand-logo-compact" : ""}`} aria-label="NEULEARN">
      <span className="brand-logo-mark" aria-hidden="true">
        <BookOpen />
      </span>
      <span>NEU<span>LEARN</span></span>
    </span>
  )

  if (!onClick) return logo

  return (
    <button className="brand-logo-button" type="button" onClick={onClick} aria-label={actionLabel}>
      {logo}
    </button>
  )
}
