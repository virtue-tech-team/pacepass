import JsBarcode from 'jsbarcode'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

import { formatCurrency, formatDate } from './format'
import type { RegistrationItem } from '../types'

function getRegistrationStatusLabel(status: RegistrationItem['status']) {
  switch (status) {
    case 'confirmed':
      return 'INSCRIÇÃO CONFIRMADA'
    case 'refunded':
      return 'INSCRIÇÃO ESTORNADA'
    case 'processing_payment':
      return 'PAGAMENTO EM PROCESSAMENTO'
    case 'pending_payment':
      return 'AGUARDANDO PAGAMENTO'
    case 'payment_failed':
      return 'PAGAMENTO FALHOU'
    case 'cancelled':
      return 'INSCRIÇÃO CANCELADA'
    default:
      return 'STATUS INDEFINIDO'
  }
}

function buildMachineCode(registration: RegistrationItem) {
  return [
    'TFREG',
    registration._id,
    registration.orderNumber,
    registration.event._id,
    registration.selection.ticketTypeId,
    registration.selection.batchId,
  ].join('|')
}

function buildParticipantAddress(registration: RegistrationItem) {
  const participant = registration.participant

  return [
    participant.addressLine,
    participant.addressNumber,
    participant.city,
    participant.state,
    participant.country,
    participant.zipCode,
  ].filter(Boolean).join(', ')
}

function createBarcodeDataUrl(value: string) {
  const canvas = document.createElement('canvas')

  JsBarcode(canvas, value, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    height: 58,
    width: 1.8,
    background: '#ffffff',
    lineColor: '#0f172a',
  })

  return canvas.toDataURL('image/png')
}

function drawSectionTitle(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor('#355070')
  doc.text(label, x, y)
}

function drawInfoRow(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#6b7280')
  doc.text(label, x, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor('#0f172a')
  const lines = doc.splitTextToSize(value || '-', width)
  doc.text(lines, x, y + 6)
}

export async function downloadRegistrationPdf(registration: RegistrationItem) {
  const codePayload = buildMachineCode(registration)
  const qrCodeDataUrl = await QRCode.toDataURL(codePayload, {
    margin: 1,
    width: 340,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  })
  const barcodeDataUrl = createBarcodeDataUrl(registration.orderNumber)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const accent = '#0d3b66'
  const accentSoft = '#edf4ff'
  const border = '#dbe7f5'
  const textMuted = '#5b6472'

  doc.setFillColor(accent)
  doc.roundedRect(12, 12, 186, 32, 8, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.setTextColor('#ffffff')
  doc.text('Comprovante de Inscrição', 18, 30)

  doc.setFillColor('#ffffff')
  doc.roundedRect(138, 17, 52, 19, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.8)
  doc.setTextColor(accent)
  doc.text(getRegistrationStatusLabel(registration.status), 164, 28, { align: 'center' })

  doc.setDrawColor(border)
  doc.setFillColor('#ffffff')
  doc.roundedRect(12, 50, 116, 54, 8, 8, 'FD')
  doc.roundedRect(134, 50, 64, 54, 8, 8, 'FD')

  drawSectionTitle(doc, 'Evento e modalidade', 18, 61)
  drawInfoRow(doc, 'Evento', registration.event.title, 18, 69, 100)
  drawInfoRow(doc, 'Categoria / modalidade', `${registration.selection.groupName} - ${registration.selection.ticketName}`, 18, 83, 100)
  drawInfoRow(doc, 'Data e local', `${formatDate(registration.event.startDate)} - ${registration.event.venue}`, 18, 97, 100)

  drawSectionTitle(doc, 'Identificação rápida', 140, 61)
  drawInfoRow(doc, 'Inscrição', `#${registration.orderNumber}`, 140, 69, 48)
  drawInfoRow(doc, 'Lote', registration.selection.batchName, 140, 83, 48)
  drawInfoRow(doc, 'Total', formatCurrency(registration.totalAmount), 140, 97, 48)

  doc.setFillColor(accentSoft)
  doc.roundedRect(12, 110, 186, 60, 8, 8, 'F')
  drawSectionTitle(doc, 'Participante', 18, 121)
  drawInfoRow(doc, 'Nome completo', registration.participant.fullName, 18, 129, 78)
  drawInfoRow(doc, 'Documento', [registration.participant.documentType, registration.participant.document].filter(Boolean).join(': '), 18, 145, 78)
  drawInfoRow(doc, 'E-mail', registration.participant.email, 102, 129, 88)
  drawInfoRow(doc, 'Telefone', registration.participant.phone, 102, 145, 88)
  drawInfoRow(doc, 'Endereço', buildParticipantAddress(registration) || 'Não informado', 18, 160, 172)

  doc.setDrawColor(border)
  doc.roundedRect(12, 176, 92, 96, 8, 8, 'D')
  doc.roundedRect(106, 176, 92, 96, 8, 8, 'D')

  drawSectionTitle(doc, 'QR Code da inscrição', 18, 187)
  doc.addImage(qrCodeDataUrl, 'PNG', 26, 194, 64, 64)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(textMuted)
  const qrHelp = doc.splitTextToSize('Use este QR Code no módulo de entrega de kits e validação de acesso.', 72)
  doc.text(qrHelp, 18, 264)

  drawSectionTitle(doc, 'Código de barras', 112, 187)
  doc.addImage(barcodeDataUrl, 'PNG', 114, 206, 76, 24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor('#0f172a')
  doc.text(registration.orderNumber, 152, 238, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(textMuted)
  const barcodeHelp = doc.splitTextToSize(codePayload, 74)
  doc.text(barcodeHelp, 112, 248)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor('#7b8794')
  doc.text('PacePass • documento gerado automaticamente para conferência e retirada futura de kits.', 12, 286)

  doc.save(`inscricao-${registration.event.slug}-${registration.orderNumber}.pdf`)
}