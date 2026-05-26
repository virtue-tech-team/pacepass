import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

interface ProfileFormState {
  name: string
  email: string
  phone: string
  birthDate: string
  gender: string
  documentType: string
  document: string
  zipCode: string
  country: string
  state: string
  city: string
  addressLine: string
  addressNumber: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function UserDashboardPage() {
  const { user, updateProfile } = useAuth()
  const toast = useToast()
  const [values, setValues] = useState<ProfileFormState>({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '',
    documentType: 'CPF',
    document: '',
    zipCode: '',
    country: 'Brasil',
    state: '',
    city: '',
    addressLine: '',
    addressNumber: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [zipLookupError, setZipLookupError] = useState('')
  const [isLookingUpZip, setIsLookingUpZip] = useState(false)

  useEffect(() => {
    setValues({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      birthDate: user?.birthDate || '',
      gender: user?.gender || '',
      documentType: user?.documentType || 'CPF',
      document: user?.document || '',
      zipCode: user?.zipCode || '',
      country: user?.country || 'Brasil',
      state: user?.state || '',
      city: user?.city || '',
      addressLine: user?.addressLine || '',
      addressNumber: user?.addressNumber || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }, [user])

  function formatZipCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`
  }

  async function handleZipLookup() {
    const digits = values.zipCode.replace(/\D/g, '')

    if (digits.length !== 8) {
      const message = 'Informe um CEP com 8 dígitos para buscar o endereço.'
      setZipLookupError(message)
      toast.error(message)
      return
    }

    setIsLookingUpZip(true)
    setZipLookupError('')

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = (await response.json()) as {
        erro?: boolean
        logradouro?: string
        localidade?: string
        uf?: string
      }

      if (!response.ok || data.erro) {
        throw new Error('CEP não encontrado.')
      }

      setValues((current) => ({
        ...current,
        zipCode: formatZipCode(digits),
        addressLine: data.logradouro || current.addressLine,
        city: data.localidade || current.city,
        state: data.uf || current.state,
        country: current.country || 'Brasil',
      }))
      toast.success('Endereço preenchido a partir do CEP informado.')
    } catch (currentError) {
      const message = (currentError as Error).message || 'Não foi possível consultar o CEP agora.'
      setZipLookupError(message)
      toast.error(message)
    } finally {
      setIsLookingUpZip(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.name.trim() || !values.email.trim() || !values.phone.trim()) {
      const message = 'Preencha nome, e-mail e telefone para salvar seus dados.'
      setError(message)
      setSuccessMessage('')
      toast.error(message)
      return
    }

    if (!values.zipCode.trim() || !values.state.trim() || !values.city.trim() || !values.addressLine.trim() || !values.addressNumber.trim()) {
      const message = 'Preencha o endereço completo para salvar o perfil e reaproveitar esses dados nas inscrições.'
      setError(message)
      setSuccessMessage('')
      toast.error(message)
      return
    }

    if (values.newPassword && !values.currentPassword) {
      const message = 'Informe a senha atual para definir uma nova senha.'
      setError(message)
      setSuccessMessage('')
      toast.error(message)
      return
    }

    if (values.newPassword && values.newPassword !== values.confirmPassword) {
      const message = 'A confirmação da nova senha não confere.'
      setError(message)
      setSuccessMessage('')
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const message = await updateProfile({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        birthDate: values.birthDate,
        gender: values.gender,
        documentType: values.documentType,
        document: values.document.trim(),
        zipCode: values.zipCode.trim(),
        country: values.country.trim(),
        state: values.state.trim(),
        city: values.city.trim(),
        addressLine: values.addressLine.trim(),
        addressNumber: values.addressNumber.trim(),
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })

      setSuccessMessage(message)
      toast.success(message)
      setValues((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (currentError) {
      const message = (currentError as Error).message || 'Não foi possível atualizar seus dados.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="content-section compact-top">
      <div className="section-heading">
        <span className="eyebrow">Minha conta</span>
        <h1>Editar dados da conta</h1>
        <p>Atualize seus dados de acesso e mantenha seu cadastro pronto para inscrições e atendimento.</p>
      </div>

      <div className="account-profile-layout">
        <article className="panel account-profile-card">
          <span className="eyebrow">Resumo</span>
          <strong>{user?.name || 'Usuário'}</strong>
          <p>{user?.email || '-'}</p>

          <div className="account-profile-card__facts">
            <div className="account-profile-card__fact">
              <span>Telefone cadastrado</span>
              <strong>{user?.phone || 'Não informado'}</strong>
            </div>
            <div className="account-profile-card__fact">
              <span>Data de nascimento</span>
              <strong>{user?.birthDate ? new Date(user.birthDate).toLocaleDateString('pt-BR') : 'Não informado'}</strong>
            </div>
            <div className="account-profile-card__fact">
              <span>Gênero</span>
              <strong>{user?.gender || 'Não informado'}</strong>
            </div>
            <div className="account-profile-card__fact">
              <span>Documento</span>
              <strong>{user?.document ? `${user.documentType || 'CPF'}: ${user.document}` : 'Não informado'}</strong>
            </div>
            <div className="account-profile-card__fact">
              <span>Endereço base</span>
              <strong>{user?.addressLine ? `${user.addressLine}, ${user.addressNumber} • ${user.city}/${user.state}` : 'Não informado'}</strong>
            </div>
            <div className="account-profile-card__fact">
              <span>Conta criada em</span>
              <strong>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}</strong>
            </div>
          </div>
        </article>

        <article className="panel account-profile-form-card">
          <form className="account-profile-form" onSubmit={handleSubmit}>
            <div className="account-profile-form__heading">
              <h2>Dados pessoais</h2>
              <p>Essas informações serão usadas no seu perfil e nas próximas jornadas logadas.</p>
            </div>

            {error ? <div className="error-inline">{error}</div> : null}
            {successMessage ? <div className="panel panel--plain success-panel">{successMessage}</div> : null}

            <div className="form-grid">
              <label>
                <span>Nome completo</span>
                <input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                <span>Telefone</span>
                <input value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label>
                <span>Data de nascimento</span>
                <input type="date" value={values.birthDate} onChange={(event) => setValues((current) => ({ ...current, birthDate: event.target.value }))} />
              </label>
              <label>
                <span>Gênero</span>
                <select value={values.gender} onChange={(event) => setValues((current) => ({ ...current, gender: event.target.value }))}>
                  <option value="">Selecione</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                  <option value="prefiro_nao_informar">Prefiro não informar</option>
                </select>
              </label>
              <label>
                <span>Tipo de documento</span>
                <select value={values.documentType} onChange={(event) => setValues((current) => ({ ...current, documentType: event.target.value }))}>
                  <option value="CPF">CPF</option>
                  <option value="RG">RG</option>
                  <option value="Passaporte">Passaporte</option>
                </select>
              </label>
              <label>
                <span>Documento</span>
                <input value={values.document} onChange={(event) => setValues((current) => ({ ...current, document: event.target.value }))} />
              </label>
              <label className="field-span-2">
                <span>E-mail</span>
                <input type="email" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} />
              </label>
            </div>

            <div className="event-location-card account-profile-address-card">
              <div className="event-location-card__header">
                <h3>Endereço padrão para inscrições</h3>
                <p>Esses dados serão reaproveitados automaticamente quando a inscrição for para você.</p>
              </div>

              <div className="account-profile-address-grid">
                <label className="account-profile-address-grid__zip">
                  <span>CEP</span>
                  <div className="input-with-action">
                    <input value={values.zipCode} onChange={(event) => setValues((current) => ({ ...current, zipCode: formatZipCode(event.target.value) }))} placeholder="00000-000" inputMode="numeric" />
                    <button type="button" className="input-with-action__button" onClick={() => void handleZipLookup()} disabled={isLookingUpZip}>
                      {isLookingUpZip ? '...' : 'Buscar'}
                    </button>
                  </div>
                </label>

                <label>
                  <span>País</span>
                  <input value={values.country} onChange={(event) => setValues((current) => ({ ...current, country: event.target.value }))} />
                </label>

                <label>
                  <span>Estado</span>
                  <input value={values.state} onChange={(event) => setValues((current) => ({ ...current, state: event.target.value }))} />
                </label>

                <label>
                  <span>Cidade</span>
                  <input value={values.city} onChange={(event) => setValues((current) => ({ ...current, city: event.target.value }))} />
                </label>

                <label className="account-profile-address-grid__address">
                  <span>Logradouro</span>
                  <input value={values.addressLine} onChange={(event) => setValues((current) => ({ ...current, addressLine: event.target.value }))} />
                </label>

                <label>
                  <span>Número</span>
                  <input value={values.addressNumber} onChange={(event) => setValues((current) => ({ ...current, addressNumber: event.target.value }))} />
                </label>
              </div>

              {zipLookupError ? <div className="error-inline">{zipLookupError}</div> : null}
            </div>

            <div className="account-profile-form__heading">
              <h2>Alterar senha</h2>
              <p>Preencha apenas se quiser trocar a senha atual.</p>
            </div>

            <div className="form-grid">
              <label>
                <span>Senha atual</span>
                <input type="password" value={values.currentPassword} onChange={(event) => setValues((current) => ({ ...current, currentPassword: event.target.value }))} />
              </label>
              <label>
                <span>Nova senha</span>
                <input type="password" value={values.newPassword} onChange={(event) => setValues((current) => ({ ...current, newPassword: event.target.value }))} />
              </label>
              <label>
                <span>Confirmar nova senha</span>
                <input type="password" value={values.confirmPassword} onChange={(event) => setValues((current) => ({ ...current, confirmPassword: event.target.value }))} />
              </label>
            </div>

            <p className="muted-note">Se você não preencher os campos de senha, apenas seus dados cadastrais serão atualizados.</p>

            <div className="account-profile-form__actions">
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  )
}