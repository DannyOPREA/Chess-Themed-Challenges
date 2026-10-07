import { z } from 'zod'

// The game's phases, in order (docs/scope.md, "Game phases"). The host moves
// the game from one to the next by hand; there are no timers.
export const PHASES = ['lobby', 'game_on', 'accusations_closed', 'reveal'] as const

export type Phase = (typeof PHASES)[number]

// For checking a phase sent in a form, such as the host's phase buttons.
export const phaseSchema = z.enum(PHASES)

export const PHASE_LABELS: Record<Phase, string> = {
  lobby: 'Lobby',
  game_on: 'Game on',
  accusations_closed: 'Accusations closed',
  reveal: 'Reveal',
}

// Actions that only some phases allow. Rejoining with name and PIN, and the
// host's player list, removing a player, resetting a PIN and the emergency
// "show all" button, work in every phase, so they aren't listed.
export type PhaseAction =
  // A new player joins. Late joiners are allowed during Game on.
  | 'join'
  // A player marks their own challenge done, or undoes it.
  | 'markOwnCompletion'
  // A player makes, changes or clears an accusation.
  | 'accuse'
  // The host marks or unmarks a player's completion. Still allowed once
  // accusations close (docs/scope.md); the Reveal is final.
  | 'hostMarkCompletion'
  // Players see the leaderboard and everyone's breakdown.
  | 'seeReveal'

const ALLOWED: Record<PhaseAction, readonly Phase[]> = {
  join: ['lobby', 'game_on'],
  markOwnCompletion: ['game_on'],
  accuse: ['game_on'],
  hostMarkCompletion: ['game_on', 'accusations_closed'],
  seeReveal: ['reveal'],
}

export const phaseAllows = (phase: Phase, action: PhaseAction): boolean =>
  ALLOWED[action].includes(phase)

// The phase changes the host can make: each phase moves on to the next, and
// never back (docs/scope.md, "Game phases"). Going back would undo a freeze
// players have seen, or an assignment that must never change.
const CHANGES: Record<Phase, readonly Phase[]> = {
  lobby: ['game_on'],
  game_on: ['accusations_closed'],
  accusations_closed: ['reveal'],
  reveal: [],
}

export const phaseChangesFrom = (from: Phase): readonly Phase[] => CHANGES[from]

export const canChangePhase = (from: Phase, to: Phase): boolean => CHANGES[from].includes(to)
