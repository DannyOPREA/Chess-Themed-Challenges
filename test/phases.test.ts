import { describe, expect, it } from 'vitest'
import {
  canChangePhase,
  type Phase,
  type PhaseAction,
  PHASES,
  phaseAllows,
  phaseChangesFrom,
  phaseSchema,
} from '../src/game/phases'

describe('phase rules', () => {
  // docs/scope.md, "Game phases", "Assignment" and "Host page".
  const expected: Record<PhaseAction, Phase[]> = {
    join: ['lobby', 'game_on'],
    markOwnCompletion: ['game_on'],
    accuse: ['game_on'],
    hostMarkCompletion: ['game_on', 'accusations_closed', 'reveal'],
    seeReveal: ['reveal'],
  }

  for (const [action, phases] of Object.entries(expected) as [PhaseAction, Phase[]][]) {
    for (const phase of PHASES) {
      const allowed = phases.includes(phase)
      it(`${allowed ? 'allows' : 'refuses'} ${action} in ${phase}`, () => {
        expect(phaseAllows(phase, action)).toBe(allowed)
      })
    }
  }

  it('freezes players once accusations close', () => {
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      expect(phaseAllows(phase, 'accuse')).toBe(false)
      expect(phaseAllows(phase, 'markOwnCompletion')).toBe(false)
      expect(phaseAllows(phase, 'join')).toBe(false)
    }
  })
})

describe('phase changes', () => {
  it('moves each phase on to the next, in order', () => {
    expect(canChangePhase('lobby', 'game_on')).toBe(true)
    expect(canChangePhase('game_on', 'accusations_closed')).toBe(true)
    expect(canChangePhase('accusations_closed', 'reveal')).toBe(true)
  })

  it('lets the host reopen accusations closed by mistake', () => {
    expect(canChangePhase('accusations_closed', 'game_on')).toBe(true)
  })

  it('refuses every other change', () => {
    const allowed = new Set([
      'lobby>game_on',
      'game_on>accusations_closed',
      'accusations_closed>reveal',
      'accusations_closed>game_on',
    ])
    for (const from of PHASES) {
      for (const to of PHASES) {
        expect(canChangePhase(from, to), `${from} to ${to}`).toBe(allowed.has(`${from}>${to}`))
      }
    }
    expect(phaseChangesFrom('reveal')).toEqual([])
    expect(phaseChangesFrom('accusations_closed')).toEqual(['reveal', 'game_on'])
  })

  it('checks phase names from forms', () => {
    expect(phaseSchema.parse('game_on')).toBe('game_on')
    expect(phaseSchema.safeParse('Game on').success).toBe(false)
    expect(phaseSchema.safeParse('finished').success).toBe(false)
  })
})
