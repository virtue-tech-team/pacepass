export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    running: 'Corrida',
    triathlon: 'Triathlon',
    fight: 'Lutas',
    cycling: 'Ciclismo',
    fitness: 'Fitness',
    other: 'Outros',
  }

  return labels[category] || category
}