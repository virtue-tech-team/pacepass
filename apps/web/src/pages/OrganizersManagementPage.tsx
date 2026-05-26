import { useEffect, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import type { CreateEventAdminInput, User } from '../types'

const initialOrganizerForm: CreateEventAdminInput = {
  name: '',
  email: '',
  username: '',
  password: '',
  phone: '',
  platformFeePercent: 10,
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
}

export function OrganizersManagementPage() {
  const { token } = useAuth()
  const toast = useToast()
  const [admins, setAdmins] = useState<User[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draftFees, setDraftFees] = useState<Record<string, string>>({})
  const [savingAdminId, setSavingAdminId] = useState('')
  const [organizerForm, setOrganizerForm] = useState<CreateEventAdminInput>(initialOrganizerForm)
  const [isCreatingOrganizer, setIsCreatingOrganizer] = useState(false)

  async function loadData() {
    if (!token) return

    const usersResponse = await api.listUsers(token, 'event_admin')
    setAdmins(usersResponse.users)
  }

  useEffect(() => {
    if (!token) return

    loadData().catch((err: Error) => {
      setError(err.message)
      toast.error(err.message)
    })
  }, [token])

  async function handleSaveCommercialSettings(admin: User) {
    if (!token) return

    const rawValue = draftFees[admin.id] ?? String(admin.platformFeePercent)
    const parsedValue = Number(rawValue.replace(',', '.'))

    if (Number.isNaN(parsedValue) || parsedValue < 0 || parsedValue > 100) {
      const message = 'Informe uma taxa entre 0% e 100% para o organizador.'
      setError(message)
      toast.error(message)
      return
    }

    setSavingAdminId(admin.id)
    setError('')
    setSuccess('')

    try {
      const response = await api.updateUserCommercialSettings(token, admin.id, {
        platformFeePercent: parsedValue,
      })

      setAdmins((current) => current.map((item) => (item.id === admin.id ? response.user : item)))
      setDraftFees((current) => ({
        ...current,
        [admin.id]: String(response.user.platformFeePercent),
      }))
      setSuccess(response.message)
      toast.success(response.message)
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setSavingAdminId('')
    }
  }

  async function handleCreateOrganizer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) return

    setIsCreatingOrganizer(true)
    setError('')
    setSuccess('')

    try {
      const response = await api.createEventAdmin(token, organizerForm)

      setAdmins((current) => [response.user, ...current])
      setDraftFees((current) => ({
        ...current,
        [response.user.id]: String(response.user.platformFeePercent),
      }))
      setOrganizerForm(initialOrganizerForm)
      setSuccess(response.message)
      toast.success(response.message)
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      toast.error(message)
    } finally {
      setIsCreatingOrganizer(false)
    }
  }

  return (
    <section className="content-section compact-top organizers-page">
      <div className="section-heading">
        <span className="eyebrow">Organizadores</span>
        <h1>Gestão de organizadores</h1>
        <p>Cadastre novos organizadores com taxa comercial definida e gerencie rapidamente a carteira já ativa.</p>
      </div>

      {error ? <div className="panel error-panel">{error}</div> : null}
      {success ? <div className="panel success-panel">{success}</div> : null}

      <div className="organizers-layout">
        <form className="panel organizers-page__form" onSubmit={handleCreateOrganizer}>
          <div className="section-heading">
            <h2>Novo organizador</h2>
            <p>Crie a conta já pronta para operar com a taxa que a plataforma irá cobrar dele.</p>
          </div>

          <div className="form-grid">
            <label>
              <span>Nome</span>
              <input value={organizerForm.name} onChange={(event) => setOrganizerForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              <span>E-mail</span>
              <input type="email" value={organizerForm.email} onChange={(event) => setOrganizerForm((current) => ({ ...current, email: event.target.value }))} required />
            </label>
            <label>
              <span>Username</span>
              <input
                value={organizerForm.username}
                onChange={(event) => setOrganizerForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))}
                placeholder="ex.: arena.sul"
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>Telefone</span>
              <input value={organizerForm.phone} onChange={(event) => setOrganizerForm((current) => ({ ...current, phone: event.target.value }))} required />
            </label>
            <label>
              <span>Senha provisória</span>
              <input type="password" value={organizerForm.password} onChange={(event) => setOrganizerForm((current) => ({ ...current, password: event.target.value }))} required />
            </label>
            <label>
              <span>Taxa da plataforma (%)</span>
              <input type="number" min="0" max="100" step="0.01" value={organizerForm.platformFeePercent} onChange={(event) => setOrganizerForm((current) => ({ ...current, platformFeePercent: Number(event.target.value) }))} required />
            </label>
            <label>
              <span>Data de nascimento</span>
              <input type="date" value={organizerForm.birthDate} onChange={(event) => setOrganizerForm((current) => ({ ...current, birthDate: event.target.value }))} />
            </label>
            <label>
              <span>Gênero</span>
              <select value={organizerForm.gender} onChange={(event) => setOrganizerForm((current) => ({ ...current, gender: event.target.value }))}>
                <option value="">Selecione</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              <span>Tipo de documento</span>
              <select value={organizerForm.documentType} onChange={(event) => setOrganizerForm((current) => ({ ...current, documentType: event.target.value }))}>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="RG">RG</option>
              </select>
            </label>
            <label>
              <span>Documento</span>
              <input value={organizerForm.document} onChange={(event) => setOrganizerForm((current) => ({ ...current, document: event.target.value }))} />
            </label>
            <label>
              <span>CEP</span>
              <input value={organizerForm.zipCode} onChange={(event) => setOrganizerForm((current) => ({ ...current, zipCode: event.target.value }))} placeholder="00000-000" />
            </label>
            <label>
              <span>País</span>
              <input value={organizerForm.country} onChange={(event) => setOrganizerForm((current) => ({ ...current, country: event.target.value }))} />
            </label>
            <label>
              <span>Estado</span>
              <input value={organizerForm.state} onChange={(event) => setOrganizerForm((current) => ({ ...current, state: event.target.value }))} />
            </label>
            <label>
              <span>Cidade</span>
              <input value={organizerForm.city} onChange={(event) => setOrganizerForm((current) => ({ ...current, city: event.target.value }))} />
            </label>
            <label className="field-span-2">
              <span>Logradouro</span>
              <input value={organizerForm.addressLine} onChange={(event) => setOrganizerForm((current) => ({ ...current, addressLine: event.target.value }))} />
            </label>
            <label>
              <span>Número</span>
              <input value={organizerForm.addressNumber} onChange={(event) => setOrganizerForm((current) => ({ ...current, addressNumber: event.target.value }))} />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isCreatingOrganizer}>
              {isCreatingOrganizer ? 'Cadastrando...' : 'Cadastrar organizador'}
            </button>
          </div>
        </form>

        <div className="organizers-page__list list-stack">
          {admins.map((admin) => (
            <article key={admin.id} className="panel organizer-commercial-card">
              <div className="organizer-commercial-card__header">
                <div>
                  <span>{admin.name}</span>
                  <small>{admin.email}</small>
                  {admin.username ? <small>@{admin.username}</small> : null}
                </div>
                <strong>{admin.platformFeePercent}%</strong>
              </div>

              <div className="organizer-commercial-card__meta">
                <div>
                  <small>Telefone</small>
                  <p>{admin.phone || 'Nao informado'}</p>
                </div>
                <div>
                  <small>Documento</small>
                  <p>{admin.document || 'Nao informado'}</p>
                </div>
              </div>

              <div className="organizer-commercial-card__form">
                <label>
                  <span>Taxa da plataforma</span>
                  <input
                    inputMode="decimal"
                    value={draftFees[admin.id] ?? String(admin.platformFeePercent)}
                    onChange={(event) => setDraftFees((current) => ({ ...current, [admin.id]: event.target.value }))}
                    placeholder="10"
                  />
                </label>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleSaveCommercialSettings(admin)}
                  disabled={savingAdminId === admin.id}
                >
                  {savingAdminId === admin.id ? 'Salvando...' : 'Salvar taxa'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}