import { Link, useSearchParams } from 'react-router-dom'

type LinkType = 'verification' | 'reset'
type LinkReason = 'expired' | 'invalid'

function parseLinkType(value: string | null): LinkType {
  return value === 'verification' ? 'verification' : 'reset'
}

function parseLinkReason(value: string | null): LinkReason {
  return value === 'invalid' ? 'invalid' : 'expired'
}

export function AuthLinkStatusPage() {
  const [searchParams] = useSearchParams()
  const type = parseLinkType(searchParams.get('type'))
  const reason = parseLinkReason(searchParams.get('reason'))
  const email = searchParams.get('email') || ''
  const verificationPendingPath = email
    ? `/verificacao-conta?email=${encodeURIComponent(email)}`
    : '/verificacao-conta'

  const content = type === 'verification'
    ? {
        eyebrow: 'Confirmação',
        title: reason === 'expired' ? 'Link de confirmação expirado' : 'Link de confirmação inválido',
        description: reason === 'expired'
          ? 'Esse link de confirmação já venceu. Solicite um novo e-mail para liberar o acesso da conta.'
          : 'Não foi possível validar esse link de confirmação. Use o e-mail mais recente ou solicite um novo envio.',
        primaryHref: verificationPendingPath,
        primaryLabel: 'Solicitar novo e-mail',
        secondaryHref: '/login',
        secondaryLabel: 'Voltar para o login',
      }
    : {
        eyebrow: 'Recuperação',
        title: reason === 'expired' ? 'Link de redefinição expirado' : 'Link de redefinição inválido',
        description: reason === 'expired'
          ? 'Esse link de redefinição já venceu. Gere um novo link para escolher outra senha com segurança.'
          : 'Não foi possível validar esse link de redefinição. Solicite um novo link antes de tentar novamente.',
        primaryHref: '/esqueci-minha-senha',
        primaryLabel: 'Gerar novo link',
        secondaryHref: '/login',
        secondaryLabel: 'Voltar para o login',
      }

  return (
    <div className="page-shell auth-page">
      <section className="panel auth-card">
        <div className="auth-card__header">
          <span className="eyebrow">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>

        <div className="subpanel subpanel--soft auth-card__helper">
          <strong>Como seguir</strong>
          <ul className="plain-list auth-info-list">
            <li>Use sempre o link mais recente enviado por e-mail.</li>
            <li>Links antigos deixam de valer quando um novo envio é solicitado.</li>
            <li>Se o problema persistir, revise spam, promoções ou o endereço informado.</li>
          </ul>
        </div>

        <div className="auth-card__actions">
          <Link to={content.primaryHref} className="primary-button">{content.primaryLabel}</Link>
          <Link to={content.secondaryHref} className="ghost-button">{content.secondaryLabel}</Link>
        </div>
      </section>
    </div>
  )
}