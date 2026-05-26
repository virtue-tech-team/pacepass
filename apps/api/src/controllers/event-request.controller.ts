import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { EventRequest } from '../models/EventRequest.js'

const eventRequestSchema = z.object({
  fullName: z.string().trim().min(3),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  company: z.string().trim().min(2),
  region: z.string().trim().min(2),
  sportCategory: z.enum([
    'road_running',
    'cycling',
    'obstacle_race',
    'kids_race',
    'canoeing',
    'virtual_challenges',
    'swimming',
    'trail_run',
    'triathlon',
    'surf',
    'courses',
    'other_sports',
    'other_events',
  ]),
  eventsPerYear: z.enum(['1', '2_4', '5_10', '10_plus']),
  eventName: z.string().trim().min(3),
  regulationStatus: z.enum(['ready', 'not_ready', 'need_help']),
  preferredMonth: z.enum([
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
    'not_defined',
  ]),
  referralName: z.string().trim().max(120).optional().default(''),
})

const eventRequestStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
})

export async function createEventRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = eventRequestSchema.parse(req.body)

    const eventRequest = await EventRequest.create(payload)

    res.status(201).json({
      request: {
        id: eventRequest._id.toString(),
        status: eventRequest.status,
      },
      message: 'Recebemos sua solicitação. Nossa equipe vai analisar os dados e liberar seu acesso.',
    })
  } catch (error) {
    next(error)
  }
}

export async function listEventRequests(_req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await EventRequest.find().sort({ createdAt: -1 }).lean()

    res.json({ requests })
  } catch (error) {
    next(error)
  }
}

export async function updateEventRequestStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = eventRequestStatusSchema.parse(req.body)
    const eventRequest = await EventRequest.findById(req.params.id)

    if (!eventRequest) {
      res.status(404).json({ message: 'Solicitação não encontrada.' })
      return
    }

    eventRequest.status = payload.status
    await eventRequest.save()

    res.json({
      request: eventRequest,
      message: payload.status === 'approved'
        ? 'Solicitação aprovada com sucesso.'
        : 'Solicitação rejeitada com sucesso.',
    })
  } catch (error) {
    next(error)
  }
}