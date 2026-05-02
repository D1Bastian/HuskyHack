const LABELS = {
  grounded: 'Grounded in sources',
  partial: 'Partially grounded',
  unverified: 'Unverified',
}

export default function VerificationBadge({ verdict }) {
  if (!verdict) return null
  const status = verdict.status || 'unverified'
  const label = LABELS[status] || LABELS.unverified
  return (
    <span className={`verify-badge verify-${status}`} title={verdict.note || ''}>
      <span className="verify-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
