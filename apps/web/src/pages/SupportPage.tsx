export function SupportPage() {
  return (
    <div className="page-shell">
      <section className="content-section compact-top section-surface">
        <div className="section-heading">
          <span className="eyebrow">Suporte</span>
          <h1>Atendimento</h1>
        </div>

        <div className="support-grid">
          <article className="panel panel--plain">
            <h2>Canais</h2>
            <div className="contact-stack">
              <span>atendimento@pacepass.local</span>
              <span>(11) 4000-2026</span>
              <span>Seg a Sex, 9h às 18h</span>
            </div>
          </article>
        </div>

        <div className="faq-table">
          <div className="faq-row">
            <strong>Meu pagamento foi aprovado?</strong>
            <span>O status deve ser confirmado por e-mail e na área do usuário após a captura da transação.</span>
          </div>
          <div className="faq-row">
            <strong>Posso transferir minha inscrição?</strong>
            <span>Sim, desde que a política do organizador permita e o prazo operacional esteja aberto.</span>
          </div>
          <div className="faq-row">
            <strong>Como publico meu evento?</strong>
            <span>Entre em “Crie seu evento”, siga para a gestão e configure lotes, ingressos e datas.</span>
          </div>
        </div>
      </section>
    </div>
  )
}