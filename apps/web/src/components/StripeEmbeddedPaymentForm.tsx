import { PaymentElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useState } from 'react'

import { useToast } from '../contexts/ToastContext'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

function StripePaymentFormContent({
  onPaymentResult,
}: {
  onPaymentResult: (paymentIntentStatus: string) => Promise<void> | void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const toast = useToast()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!stripe || !elements) {
      toast.error('O formulário de pagamento ainda não foi carregado completamente. Tente novamente em instantes.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      })

      if (stripeError) {
        const message = stripeError.message || 'Não foi possível concluir o pagamento agora.'
        setError(message)
        toast.error(message)
        return
      }

      if (paymentIntent) {
        await onPaymentResult(paymentIntent.status)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="checkout-payment-shell" onSubmit={handleSubmit}>
      <div className="checkout-payment-shell__element">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error ? <div className="error-inline">{error}</div> : null}
      <button type="submit" className="primary-button checkout-action" disabled={!stripe || !elements || isSubmitting}>
        {isSubmitting ? 'Processando pagamento...' : 'Pagar agora'}
      </button>
    </form>
  )
}

export function StripeEmbeddedPaymentForm({
  clientSecret,
  onPaymentResult,
}: {
  clientSecret: string
  onPaymentResult: (paymentIntentStatus: string) => Promise<void> | void
}) {
  if (!stripePromise) {
    return <div className="error-inline">Configure `VITE_STRIPE_PUBLISHABLE_KEY` para habilitar o pagamento Stripe no checkout.</div>
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <StripePaymentFormContent onPaymentResult={onPaymentResult} />
    </Elements>
  )
}