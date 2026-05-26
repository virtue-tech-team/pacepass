import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Rota não encontrada.' })
}

function formatZodPath(path: Array<string | number>) {
  const labels: Record<string, string> = {
    title: 'Título',
    description: 'Descrição',
    zipCode: 'CEP',
    city: 'Cidade',
    state: 'UF',
    country: 'País',
    venue: 'Local',
    addressLine: 'Logradouro',
    addressNumber: 'Número',
    mapUrl: 'URL do mapa',
    startDate: 'Data de início',
    endDate: 'Data de término',
    organizer: 'Organizador',
    name: 'Nome',
    groupId: 'Grupo da categoria',
    groupName: 'Categoria',
    contactEmail: 'E-mail do organizador',
    contactPhone: 'Telefone do organizador',
    ticketTypes: 'Modalidades',
    additionalQuestions: 'Perguntas adicionais',
    label: 'Pergunta',
    type: 'Tipo da pergunta',
    options: 'Opções',
    batches: 'Lotes',
    regulationUrl: 'Regulamento',
    checkInNotes: 'Check-in',
    cancellationPolicy: 'Política de cancelamento',
    kitSummary: 'Kit e benefícios',
  }

  return path
    .map((segment) => (typeof segment === 'number' ? String(segment + 1) : (labels[segment] || segment)))
    .join(' > ')
}

function normalizeZodPath(path: PropertyKey[]) {
  return path.filter((segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number')
}

export function errorHandler(
  error: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(error)

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0]

    res.status(400).json({
      message: firstIssue
        ? `${formatZodPath(normalizeZodPath(firstIssue.path))}: ${firstIssue.message}`
        : 'Os dados enviados são inválidos.',
    })
    return
  }

  res.status(error.statusCode || 500).json({
    message: error.message || 'Erro interno do servidor.',
  })
}