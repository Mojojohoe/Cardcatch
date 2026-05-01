import { PlayerData, RoomData } from '../types';

export const createFixturePlayers = (): Record<string, PlayerData> => ({
  host: {
    uid: 'host',
    name: 'Host',
    role: 'Predator',
    hand: ['Hearts-7', 'Spades-K', 'Joker-1'],
    powerCards: [0, 10, 14],
    currentMove: null,
    currentPowerCard: null,
    confirmed: false,
    readyForNextRound: false,
    desperationTier: 0,
    desperationResult: null,
    desperationSpinning: false,
    desperationOffset: 0,
    priestessVisionUsed: false,
    secretIntel: null
  },
  guest: {
    uid: 'guest',
    name: 'Guest',
    role: 'Prey',
    hand: ['Hearts-5', 'Clubs-A', 'Joker-2'],
    powerCards: [1, 11, 20],
    currentMove: null,
    currentPowerCard: null,
    confirmed: false,
    readyForNextRound: false,
    desperationTier: 0,
    desperationResult: null,
    desperationSpinning: false,
    desperationOffset: 0,
    priestessVisionUsed: false,
    secretIntel: null
  }
});

export const createFixtureRoom = (): RoomData => ({
  code: 'TEST01',
  status: 'playing',
  players: createFixturePlayers(),
  settings: {
    hostRole: 'Predator',
    difficulty: 'Normal',
    disableJokers: false,
    disablePowerCards: false,
    enableDesperation: false,
    desperationStarterTierEnabled: true,
    preydatorDesperationSeats: 'guest',
    tiers: ['TIER 1']
  },
  currentTurn: 1,
  targetSuit: 'Hearts',
  availableSuits: ['Hearts', 'Diamonds', 'Clubs', 'Spades'],
  wheelOffset: 0.5,
  deck: ['Spades-2', 'Diamonds-2', 'Clubs-2', 'Hearts-2'],
  powerDeck: [2, 3, 4, 5, 6],
  draftSets: [],
  draftTurn: 0,
  winner: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  hostUid: 'host'
});
