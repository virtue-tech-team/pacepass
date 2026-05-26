import test from 'node:test'
import assert from 'node:assert/strict'

import { getBatchAvailabilityMessage, isBatchCurrentlyOpen } from './registration-checkout.service.js'

test('isBatchCurrentlyOpen returns true only for active batches inside the sales window', () => {
  const referenceDate = new Date('2026-05-26T12:00:00.000Z')

  assert.equal(isBatchCurrentlyOpen({
    status: 'active',
    startAt: '2026-05-25T12:00:00.000Z',
    endAt: '2026-05-27T12:00:00.000Z',
  }, referenceDate), true)

  assert.equal(isBatchCurrentlyOpen({
    status: 'scheduled',
    startAt: '2026-05-25T12:00:00.000Z',
    endAt: '2026-05-27T12:00:00.000Z',
  }, referenceDate), false)

  assert.equal(isBatchCurrentlyOpen({
    status: 'active',
    startAt: '2026-05-27T12:00:01.000Z',
    endAt: '2026-05-28T12:00:00.000Z',
  }, referenceDate), false)

  assert.equal(isBatchCurrentlyOpen({
    status: 'active',
    startAt: '2026-05-24T12:00:00.000Z',
    endAt: '2026-05-26T11:59:59.000Z',
  }, referenceDate), false)
})

test('getBatchAvailabilityMessage explains why the batch cannot be purchased', () => {
  const referenceDate = new Date('2026-05-26T12:00:00.000Z')

  assert.equal(getBatchAvailabilityMessage({
    status: 'closed',
    startAt: '2026-05-20T12:00:00.000Z',
    endAt: '2026-05-25T12:00:00.000Z',
  }, referenceDate), 'Este lote está encerrado e não aceita novas inscrições.')

  assert.equal(getBatchAvailabilityMessage({
    status: 'scheduled',
    startAt: '2026-05-27T12:00:00.000Z',
    endAt: '2026-05-28T12:00:00.000Z',
  }, referenceDate), 'Este lote ainda não iniciou as vendas.')

  assert.equal(getBatchAvailabilityMessage({
    status: 'active',
    startAt: '2026-05-20T12:00:00.000Z',
    endAt: '2026-05-25T12:00:00.000Z',
  }, referenceDate), 'Este lote já encerrou o período de vendas.')
})