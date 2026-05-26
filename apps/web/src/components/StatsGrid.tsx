export function StatsGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number; detail: string }>
}) {
  return (
    <div className="stats-grid">
      {items.map((item) => (
        <article key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </div>
  )
}