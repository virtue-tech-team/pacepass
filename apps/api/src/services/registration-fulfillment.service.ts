import PDFDocument from 'pdfkit'
import type mongoose from 'mongoose'

import { env } from '../config/env.js'
import { Event } from '../models/Event.js'
import { Registration } from '../models/Registration.js'
import { sendRegistrationConfirmedEmail, sendRegistrationReversalEmail } from './mail.service.js'
import { appendRegistrationHistoryEntry } from './registration-history.service.js'

interface RegistrationReceiptEvent {
  _id: mongoose.Types.ObjectId
  title: string
  slug: string
  startDate: Date
  city: string
  state: string
  venue: string
  organizer?: {
    name?: string
    contactEmail?: string
    contactPhone?: string
  }
  operationalDetails?: {
    checkInNotes?: string
    kitSummary?: string
    cancellationPolicy?: string
    cancellationPolicySettings?: {
      fullRefundHoursBeforeEvent?: number
      partialRefundHoursBeforeEvent?: number
      partialRefundPercent?: number
    }
  }
  managedBy?: mongoose.Types.ObjectId
}

interface RegistrationReceiptRecord {
  _id: mongoose.Types.ObjectId
  user: mongoose.Types.ObjectId
  orderNumber: string
  buyerType: 'self' | 'third_party'
  status: string
  paymentMethod: string
  subtotal: number
  feeAmount: number
  totalAmount: number
  cancellationReason: string
  refundAmount: number
  participant: {
    fullName: string
    email: string
  }
  selection: {
    ticketTypeId: string
    groupName: string
    ticketName: string
    batchName: string
  }
  createdAt: Date
  paidAt?: Date | null
  cancelledAt?: Date | null
  refundedAt?: Date | null
  event: RegistrationReceiptEvent
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case 'pix':
      return 'Pix'
    case 'credit_card':
      return 'Cartao de credito'
    default:
      return 'Stripe'
  }
}

function assertRegistrationWithEvent(
  registration: RegistrationReceiptRecord | null,
): asserts registration is RegistrationReceiptRecord {
  if (!registration || !registration.event || typeof registration.event === 'string') {
    throw new Error('Inscricao nao encontrada para emissao do comprovante.')
  }
}

function drawField(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#425466').text(label)
  doc.moveDown(0.2)
  doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(value || '-')
  doc.moveDown(0.7)
}

export async function findRegistrationWithEvent(registrationId: string) {
  return Registration.findById(registrationId)
    .populate('event', 'title slug startDate city state venue organizer operationalDetails managedBy')
    .lean<RegistrationReceiptRecord | null>()
}

export function buildRegistrationReceiptFilename(orderNumber: string) {
  return `comprovante-inscricao-${orderNumber}.pdf`
}

export async function createRegistrationReceiptPdf(registrationInput: RegistrationReceiptRecord) {
  assertRegistrationWithEvent(registrationInput)

  const registration = registrationInput
  const event = registration.event

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: 'A4', margin: 42 })

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.rect(0, 0, doc.page.width, 118).fill('#0d3b66')
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('Comprovante de Inscricao', 42, 42)
    doc.font('Helvetica').fontSize(12).text(`Pedido #${registration.orderNumber}`, 42, 76)

    doc.fillColor('#0f172a')
    doc.roundedRect(42, 138, doc.page.width - 84, doc.page.height - 180, 16).fillAndStroke('#ffffff', '#dbe4f0')

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text(event.title, 62, 162)
    doc.font('Helvetica').fontSize(11).fillColor('#516072').text(
      `${event.city}/${event.state} • ${event.venue}`,
      62,
      186,
    )

    doc.moveTo(62, 214).lineTo(doc.page.width - 62, 214).strokeColor('#e2e8f0').stroke()

    doc.y = 232
    drawField(doc, 'Participante', registration.participant.fullName)
    drawField(doc, 'E-mail', registration.participant.email)
    drawField(doc, 'Modalidade', `${registration.selection.groupName} • ${registration.selection.ticketName}`)
    drawField(doc, 'Lote', registration.selection.batchName)
    drawField(doc, 'Data do evento', formatDate(event.startDate))
    drawField(doc, 'Confirmada em', formatDate(registration.paidAt || registration.createdAt))
    drawField(doc, 'Forma de pagamento', getPaymentMethodLabel(registration.paymentMethod))
    drawField(doc, 'Subtotal', formatCurrency(registration.subtotal))
    drawField(doc, 'Taxa de servico', formatCurrency(registration.feeAmount))
    drawField(doc, 'Total pago', formatCurrency(registration.totalAmount))

    const footerText = event.organizer?.name
      ? `Organizacao responsavel: ${event.organizer.name}`
      : 'Comprovante emitido pela plataforma PacePass.'

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(footerText, 42, doc.page.height - 66)
    doc.text('Este documento foi gerado automaticamente pelo backend da plataforma.', 42, doc.page.height - 52)

    doc.end()
  })
}

export async function sendRegistrationConfirmation(registrationInput: RegistrationReceiptRecord) {
  assertRegistrationWithEvent(registrationInput)

  const registration = registrationInput
  const event = registration.event
  const receiptPdf = await createRegistrationReceiptPdf(registration)
  const dashboardUrl = `${env.clientUrl.replace(/\/$/, '')}/minhas-inscricoes`

  try {
    await sendRegistrationConfirmedEmail({
      recipientEmail: registration.participant.email,
      recipientName: registration.participant.fullName,
      orderNumber: registration.orderNumber,
      eventTitle: event.title,
      eventDate: formatDate(event.startDate),
      ticketLabel: `${registration.selection.groupName} • ${registration.selection.ticketName}`,
      dashboardUrl,
      receiptFilename: buildRegistrationReceiptFilename(registration.orderNumber),
      receiptPdf,
    })

    await appendRegistrationHistoryEntry(registration._id, {
      action: 'email_sent',
      actorRole: 'system',
      description: 'E-mail de confirmação da inscrição enviado com comprovante em PDF.',
      emailType: 'registration_confirmation',
    })
  } catch (error) {
    await appendRegistrationHistoryEntry(registration._id, {
      action: 'email_failed',
      actorRole: 'system',
      description: 'Falha ao enviar o e-mail de confirmação da inscrição.',
      emailType: 'registration_confirmation',
    })

    throw error
  }
}

export async function releaseRegistrationCapacity(registration: RegistrationReceiptRecord) {
  const eventDocument = await Event.findById(registration.event._id)

  if (!eventDocument) {
    return
  }

  const ticket = eventDocument.ticketTypes.find((currentTicket) => currentTicket._id?.toString() === registration.selection.ticketTypeId)

  if (!ticket || ticket.sold <= 0) {
    return
  }

  ticket.sold -= 1
  eventDocument.markModified('ticketTypes')
  await eventDocument.save()
}

export async function sendRegistrationReversalCommunication(registrationInput: RegistrationReceiptRecord) {
  assertRegistrationWithEvent(registrationInput)

  const registration = registrationInput
  const event = registration.event
  const dashboardUrl = `${env.clientUrl.replace(/\/$/, '')}/minhas-inscricoes`

  try {
    await sendRegistrationReversalEmail({
      recipientEmail: registration.participant.email,
      recipientName: registration.participant.fullName,
      orderNumber: registration.orderNumber,
      eventTitle: event.title,
      eventDate: formatDate(event.startDate),
      ticketLabel: `${registration.selection.groupName} • ${registration.selection.ticketName}`,
      dashboardUrl,
      action: registration.status === 'refunded' ? 'refunded' : 'cancelled',
      reason: registration.cancellationReason,
      refundAmount: registration.status === 'refunded' ? formatCurrency(registration.refundAmount || 0) : undefined,
    })

    await appendRegistrationHistoryEntry(registration._id, {
      action: 'email_sent',
      actorRole: 'system',
      description: registration.status === 'refunded'
        ? 'E-mail de cancelamento com estorno enviado ao participante.'
        : 'E-mail de cancelamento enviado ao participante.',
      emailType: 'registration_reversal',
      refundAmount: registration.refundAmount || 0,
    })
  } catch (error) {
    await appendRegistrationHistoryEntry(registration._id, {
      action: 'email_failed',
      actorRole: 'system',
      description: registration.status === 'refunded'
        ? 'Falha ao enviar o e-mail de cancelamento com estorno.'
        : 'Falha ao enviar o e-mail de cancelamento.',
      emailType: 'registration_reversal',
    })

    throw error
  }
}