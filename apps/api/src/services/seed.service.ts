import { roles } from '../constants/roles.js'
import { Event } from '../models/Event.js'
import { User } from '../models/User.js'
import { slugify } from '../utils/slugify.js'

const users = [
  {
    name: 'Administrador Geral',
    email: 'admin@ticketflow.local',
    username: 'admin',
    password: 'Admin@123',
    emailVerifiedAt: new Date(),
    role: roles.superAdmin,
    platformFeePercent: 0,
    phone: '(11) 99999-1000',
  },
  {
    name: 'Gestora de Eventos',
    email: 'evento@ticketflow.local',
    username: 'evento',
    password: 'Evento@123',
    emailVerifiedAt: new Date(),
    role: roles.eventAdmin,
    platformFeePercent: 10,
    phone: '(21) 98888-2000',
  },
  {
    name: 'Atleta Demo',
    email: 'atleta@ticketflow.local',
    password: 'Cliente@123',
    role: roles.customer,
    platformFeePercent: 0,
    phone: '(31) 97777-3000',
  },
]

export async function seedDatabase() {
  const existingUsers = await User.countDocuments()

  if (!existingUsers) {
    for (const user of users) {
      await User.create(user)
    }

    console.log('Usuários padrão criados com sucesso')
  }

  await Promise.all([
    User.updateOne(
      { email: 'admin@ticketflow.local' },
      {
        $set: {
          username: 'admin',
          emailVerifiedAt: new Date(),
        },
      },
    ),
    User.updateOne(
      { email: 'evento@ticketflow.local' },
      {
        $set: {
          username: 'evento',
          emailVerifiedAt: new Date(),
        },
      },
    ),
  ])

  const superAdmin = await User.findOne({ email: 'admin@ticketflow.local' })
  const eventAdmin = await User.findOne({ email: 'evento@ticketflow.local' })

  const existingEvents = await Event.countDocuments()
  if (existingEvents || !superAdmin || !eventAdmin) {
    return
  }

  const now = new Date()
  const sampleEvents = [
    {
      title: 'Circuito Azul 10K São Paulo',
      category: 'running',
      description:
        'Corrida urbana com percursos de 5K e 10K, ativações de marcas e kit premium.',
      zipCode: '05303-000',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil',
      venue: 'Parque Villa-Lobos',
      addressLine: 'Avenida Prof. Fonseca Rodrigues',
      addressNumber: '2001',
      mapUrl: 'https://maps.google.com/?q=Parque+Villa-Lobos+Sao+Paulo',
      startDate: new Date(now.getFullYear(), now.getMonth() + 1, 15, 6, 0),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 15, 12, 0),
      status: 'published',
      organizer: {
        name: 'Blue Run Sports',
        contactEmail: 'contato@bluerun.com.br',
        contactPhone: '(11) 4000-1000',
      },
      highlights: ['Kit premium', 'Entrega expressa', 'Resultados ao vivo'],
      ticketTypes: [
        {
          groupId: 'kit-basico-sp',
          groupName: 'Kit básico',
          name: 'Kit Performance',
          description: 'Camiseta dry-fit, chip, medalha e pós-prova',
          price: 129.9,
          fee: 12.5,
          quantity: 500,
          sold: 0,
          batches: [
            {
              name: '1º Lote',
              startAt: now,
              endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20),
              price: 129.9,
              quantity: 250,
              status: 'active',
            },
          ],
          additionalQuestions: [
            {
              label: 'Tamanho da camiseta',
              type: 'select',
              required: true,
              helperText: 'Selecione o tamanho desejado.',
              placeholder: '',
              options: ['PP', 'P', 'M', 'G', 'GG'],
            },
          ],
        },
      ],
      coverImage:
        'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80',
      createdBy: superAdmin._id,
      managedBy: eventAdmin._id,
    },
    {
      title: 'Triathlon Costa Sul 2026',
      category: 'triathlon',
      description:
        'Prova de sprint triathlon com infraestrutura premium, arena para famílias e parceiros.',
      zipCode: '88053-700',
      city: 'Florianópolis',
      state: 'SC',
      country: 'Brasil',
      venue: 'Jurerê Internacional',
      addressLine: 'Avenida dos Búzios',
      addressNumber: '1760',
      mapUrl: 'https://maps.google.com/?q=Jurere+Internacional+Florianopolis',
      startDate: new Date(now.getFullYear(), now.getMonth() + 2, 8, 5, 30),
      endDate: new Date(now.getFullYear(), now.getMonth() + 2, 8, 14, 0),
      status: 'published',
      organizer: {
        name: 'Sul Endurance',
        contactEmail: 'hello@sulendurance.com',
        contactPhone: '(48) 3333-2000',
      },
      highlights: ['Área recovery', 'Chip premium', 'Marketplace esportivo'],
      ticketTypes: [
        {
          groupId: 'sprint-individual-sc',
          groupName: 'Sprint individual',
          name: 'Sprint Individual',
          description: 'Natação, ciclismo e corrida individual',
          price: 289.9,
          fee: 24,
          quantity: 300,
          sold: 0,
          batches: [
            {
              name: 'Lote de Lançamento',
              startAt: now,
              endAt: new Date(now.getFullYear(), now.getMonth() + 1, 5),
              price: 289.9,
              quantity: 150,
              status: 'active',
            },
          ],
          additionalQuestions: [
            {
              label: 'Equipe',
              type: 'text',
              required: false,
              helperText: 'Preencha se participar por assessoria ou equipe.',
              placeholder: 'Nome da equipe',
              options: [],
            },
          ],
        },
      ],
      coverImage:
        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
      createdBy: superAdmin._id,
      managedBy: eventAdmin._id,
    },
    {
      title: 'Fight Night Arena Pro',
      category: 'fight',
      description:
        'Noite de lutas com octógono profissional, experiências VIP e ativações de patrocinadores.',
      zipCode: '22775-003',
      city: 'Rio de Janeiro',
      state: 'RJ',
      country: 'Brasil',
      venue: 'Jeunesse Arena',
      addressLine: 'Avenida Embaixador Abelardo Bueno',
      addressNumber: '3401',
      mapUrl: 'https://maps.google.com/?q=Jeunesse+Arena+Rio+de+Janeiro',
      startDate: new Date(now.getFullYear(), now.getMonth() + 3, 21, 19, 0),
      endDate: new Date(now.getFullYear(), now.getMonth() + 3, 21, 23, 30),
      status: 'draft',
      organizer: {
        name: 'Arena Combat',
        contactEmail: 'eventos@arenacombat.com',
        contactPhone: '(21) 4000-5000',
      },
      highlights: ['VIP lounge', 'Meet and greet', 'Hospitalidade corporativa'],
      ticketTypes: [
        {
          groupId: 'cadeira-premium-rj',
          groupName: 'Cadeira premium',
          name: 'Cadeira Premium',
          description: 'Setor premium com visão central',
          price: 199.9,
          fee: 18,
          quantity: 800,
          sold: 0,
          batches: [
            {
              name: 'Pré-venda',
              startAt: now,
              endAt: new Date(now.getFullYear(), now.getMonth() + 1, 10),
              price: 199.9,
              quantity: 300,
              status: 'active',
            },
          ],
          additionalQuestions: [
            {
              label: 'Documento do titular',
              type: 'text',
              required: true,
              helperText: 'Usado para conferência na entrada.',
              placeholder: 'CPF ou passaporte',
              options: [],
            },
          ],
        },
      ],
      coverImage:
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
      createdBy: superAdmin._id,
      managedBy: eventAdmin._id,
    },
  ] as const

  await Event.insertMany(
    sampleEvents.map((event) => ({
      ...event,
      slug: slugify(event.title),
    })),
  )

  console.log('Eventos de demonstração criados com sucesso')
}