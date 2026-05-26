export const roles = {
  superAdmin: 'super_admin',
  eventAdmin: 'event_admin',
  customer: 'customer',
} as const

export type Role = (typeof roles)[keyof typeof roles]

export const roleList: Role[] = Object.values(roles)