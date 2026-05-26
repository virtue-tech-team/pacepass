import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPublicEventStatusFilter, isEventPubliclyVisible, isPublicEventStatus } from './event-publication.service.js'

test('public event status helpers allow only published and closed events', () => {
  assert.equal(isPublicEventStatus('published'), true)
  assert.equal(isPublicEventStatus('closed'), true)
  assert.equal(isPublicEventStatus('draft'), false)

  assert.equal(isEventPubliclyVisible({ status: 'published' }), true)
  assert.equal(isEventPubliclyVisible({ status: 'closed' }), true)
  assert.equal(isEventPubliclyVisible({ status: 'draft' }), false)
})

test('buildPublicEventStatusFilter falls back to the public status set', () => {
  assert.equal(buildPublicEventStatusFilter('published'), 'published')
  assert.deepEqual(buildPublicEventStatusFilter('draft'), { $in: ['published', 'closed'] })
  assert.deepEqual(buildPublicEventStatusFilter(undefined), { $in: ['published', 'closed'] })
})