import { env } from '../config/env.js'

interface SendEmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent: string
  attachments?: Array<{
    name: string
    content: string
  }>
}

function isBrevoEnabled() {
  return env.emailEnabled && env.emailProvider === 'brevo' && Boolean(env.brevoApiKey)
}

export async function sendEmail({ to, subject, htmlContent, textContent, attachments }: SendEmailParams) {
  if (!env.emailEnabled) {
    return
  }

  if (!isBrevoEnabled()) {
    console.info('[mail:console]', {
      to,
      subject,
      textContent,
    })
    return
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.brevoApiKey,
    },
    body: JSON.stringify({
      sender: {
        name: env.emailFromName,
        email: env.emailFromAddress,
      },
      to: [{ email: to }],
      replyTo: env.emailReplyTo ? { email: env.emailReplyTo } : undefined,
      subject,
      htmlContent,
      textContent,
      attachment: attachments,
    }),
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new Error(`Falha ao enviar e-mail transacional. ${errorPayload}`)
  }
}

export async function sendAccountVerificationEmail(recipientEmail: string, recipientName: string, verificationUrl: string) {
  const subject = 'Confirme sua conta na PacePass'
  const safeName = recipientName.trim() || 'atleta'

  await sendEmail({
    to: recipientEmail,
    subject,
    textContent: [
      `Olá, ${safeName}.`,
      '',
      'Sua conta foi criada na PacePass.',
      `Confirme seu e-mail acessando este link: ${verificationUrl}`,
      '',
      'Se você não solicitou a criação desta conta, ignore esta mensagem.',
    ].join('\n'),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #132238;">
        <h2 style="margin-bottom: 12px;">Confirme sua conta na PacePass</h2>
        <p>Olá, ${safeName}.</p>
        <p>Sua conta foi criada com sucesso. Para liberar o acesso, confirme seu e-mail no botão abaixo.</p>
        <p style="margin: 24px 0;">
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700;">Confirmar conta</a>
        </p>
        <p>Se preferir, copie e cole este link no navegador:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>Se você não solicitou a criação desta conta, ignore esta mensagem.</p>
      </div>
    `.trim(),
  })
}

export async function sendPasswordResetEmail(recipientEmail: string, recipientName: string, resetUrl: string) {
  const subject = 'Redefina sua senha na PacePass'
  const safeName = recipientName.trim() || 'atleta'

  await sendEmail({
    to: recipientEmail,
    subject,
    textContent: [
      `Olá, ${safeName}.`,
      '',
      'Recebemos uma solicitação para redefinir sua senha na PacePass.',
      `Acesse este link para cadastrar uma nova senha: ${resetUrl}`,
      '',
      'Se você não solicitou a redefinição, ignore esta mensagem.',
    ].join('\n'),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #132238;">
        <h2 style="margin-bottom: 12px;">Redefina sua senha</h2>
        <p>Olá, ${safeName}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha na PacePass. Use o botão abaixo para cadastrar uma nova senha.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700;">Redefinir senha</a>
        </p>
        <p>Se preferir, copie e cole este link no navegador:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Se você não solicitou a redefinição, ignore esta mensagem.</p>
      </div>
    `.trim(),
  })
}

interface SendRegistrationConfirmedEmailParams {
  recipientEmail: string
  recipientName: string
  orderNumber: string
  eventTitle: string
  eventDate: string
  ticketLabel: string
  dashboardUrl: string
  receiptFilename: string
  receiptPdf: Buffer
}

export async function sendRegistrationConfirmedEmail({
  recipientEmail,
  recipientName,
  orderNumber,
  eventTitle,
  eventDate,
  ticketLabel,
  dashboardUrl,
  receiptFilename,
  receiptPdf,
}: SendRegistrationConfirmedEmailParams) {
  const subject = `Inscricao confirmada • ${eventTitle}`
  const safeName = recipientName.trim() || 'atleta'

  await sendEmail({
    to: recipientEmail,
    subject,
    textContent: [
      `Olá, ${safeName}.`,
      '',
      'Sua inscrição foi confirmada com sucesso.',
      `Evento: ${eventTitle}`,
      `Data: ${eventDate}`,
      `Categoria: ${ticketLabel}`,
      `Pedido: #${orderNumber}`,
      '',
      `O comprovante segue em anexo. Você também pode reenviar ou baixar novamente em: ${dashboardUrl}`,
    ].join('\n'),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #132238;">
        <h2 style="margin-bottom: 12px;">Inscrição confirmada</h2>
        <p>Olá, ${safeName}.</p>
        <p>Sua inscrição foi confirmada com sucesso na PacePass.</p>
        <ul>
          <li><strong>Evento:</strong> ${eventTitle}</li>
          <li><strong>Data:</strong> ${eventDate}</li>
          <li><strong>Categoria:</strong> ${ticketLabel}</li>
          <li><strong>Pedido:</strong> #${orderNumber}</li>
        </ul>
        <p>O comprovante segue em anexo neste e-mail.</p>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700;">Abrir minhas inscrições</a>
        </p>
      </div>
    `.trim(),
    attachments: [
      {
        name: receiptFilename,
        content: receiptPdf.toString('base64'),
      },
    ],
  })
}

interface SendRegistrationReversalEmailParams {
  recipientEmail: string
  recipientName: string
  orderNumber: string
  eventTitle: string
  eventDate: string
  ticketLabel: string
  dashboardUrl: string
  action: 'cancelled' | 'refunded'
  reason?: string
  refundAmount?: string
}

export async function sendRegistrationReversalEmail({
  recipientEmail,
  recipientName,
  orderNumber,
  eventTitle,
  eventDate,
  ticketLabel,
  dashboardUrl,
  action,
  reason,
  refundAmount,
}: SendRegistrationReversalEmailParams) {
  const safeName = recipientName.trim() || 'atleta'
  const isRefund = action === 'refunded'
  const subject = isRefund ? `Estorno processado • ${eventTitle}` : `Inscricao cancelada • ${eventTitle}`
  const headline = isRefund ? 'Estorno processado com sucesso' : 'Inscrição cancelada'
  const mainCopy = isRefund
    ? 'Sua inscrição foi cancelada e o estorno foi iniciado com sucesso.'
    : 'Sua inscrição foi cancelada com sucesso.'
  const refundCopy = isRefund && refundAmount ? `Valor do estorno: ${refundAmount}` : null

  await sendEmail({
    to: recipientEmail,
    subject,
    textContent: [
      `Olá, ${safeName}.`,
      '',
      mainCopy,
      `Evento: ${eventTitle}`,
      `Data: ${eventDate}`,
      `Categoria: ${ticketLabel}`,
      `Pedido: #${orderNumber}`,
      refundCopy,
      reason ? `Motivo informado: ${reason}` : null,
      '',
      `Acompanhe suas inscrições em: ${dashboardUrl}`,
    ].filter(Boolean).join('\n'),
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #132238;">
        <h2 style="margin-bottom: 12px;">${headline}</h2>
        <p>Olá, ${safeName}.</p>
        <p>${mainCopy}</p>
        <ul>
          <li><strong>Evento:</strong> ${eventTitle}</li>
          <li><strong>Data:</strong> ${eventDate}</li>
          <li><strong>Categoria:</strong> ${ticketLabel}</li>
          <li><strong>Pedido:</strong> #${orderNumber}</li>
          ${refundCopy ? `<li><strong>Estorno:</strong> ${refundCopy.replace('Valor do estorno: ', '')}</li>` : ''}
          ${reason ? `<li><strong>Motivo:</strong> ${reason}</li>` : ''}
        </ul>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700;">Abrir minhas inscrições</a>
        </p>
      </div>
    `.trim(),
  })
}