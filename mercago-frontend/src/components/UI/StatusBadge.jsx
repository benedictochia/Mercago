export default function StatusBadge({ status }) {
  const map = {
    finding_rider: { label: '🔍 Finding Rider', bg: '#fef3c7', color: '#92400e' },
    found_rider: { label: '🤝 Rider Assigned', bg: '#e0e7ff', color: '#3730a3' },
    ongoing: { label: '🚴 On the Way', bg: '#dbeafe', color: '#1e40af' },
    completed: { label: '✅ Delivered', bg: '#d1fae5', color: '#065f46' },
    cancelled: { label: '❌ Cancelled', bg: '#fee2e2', color: '#991b1b' },
  }
  const s = map[status] ?? { label: status, bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 600 }}>
      {s.label}
    </span>
  )
}
