export const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const;
export type Suit = (typeof SUITS)[number];

export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Value = (typeof VALUES)[number];

export interface Card {
  suit: Suit;
  value: Value;
  isJoker: boolean;
  id: string;
}

export type PlayerRole = 'Predator' | 'Prey' | 'Preydator';

export type Difficulty = 'Fair' | 'Normal' | 'Hard' | 'Impossible';

export interface GameSettings {
  hostRole: PlayerRole;
  difficulty: Difficulty;
  disableJokers: boolean;
  disablePowerCards: boolean;
  enableDesperation: boolean;
  tiers: string[];
}

export interface PlayerData {
  uid: string;
  name: string;
  role: PlayerRole;
  hand: string[];
  currentMove: string | null;
  confirmed: boolean;
  readyForNextRound: boolean;
  desperationTier: number;
  desperationResult: string | null;
  desperationSpinning: boolean;
  desperationOffset: number;
}

export interface RoomData {
  code: string;
  status: 'waiting' | 'playing' | 'results' | 'finished';
  players: Record<string, PlayerData>;
  settings: GameSettings;
  currentTurn: number;
  targetSuit: Suit | null;
  wheelOffset: number;
  deck: string[];
  winner: string | null;
  createdAt: number;
  updatedAt: number;
  lastOutcome?: {
    winnerUid: string | 'draw';
    message: string;
    cardsPlayed: Record<string, string>;
  };
}

export const CARD_UNICODE: Record<string, string> = {
  'Spades-A': '🂡', 'Spades-2': '🂢', 'Spades-3': '🂣', 'Spades-4': '🂤', 'Spades-5': '🂥', 'Spades-6': '🂦', 'Spades-7': '🂧', 'Spades-8': '🂨', 'Spades-9': '🂩', 'Spades-10': '🂪', 'Spades-J': '🂫', 'Spades-Q': '🂭', 'Spades-K': '🂮',
  'Hearts-A': '🂱', 'Hearts-2': '🂲', 'Hearts-3': '🂳', 'Hearts-4': '🂴', 'Hearts-5': '🂵', 'Hearts-6': '🂶', 'Hearts-7': '🂷', 'Hearts-8': '🂸', 'Hearts-9': '🂹', 'Hearts-10': '🂺', 'Hearts-J': '🂻', 'Hearts-Q': '🂽', 'Hearts-K': '🂾',
  'Diamonds-A': '🃁', 'Diamonds-2': '🃂', 'Diamonds-3': '🃃', 'Diamonds-4': '🃄', 'Diamonds-5': '🃅', 'Diamonds-6': '🃆', 'Diamonds-7': '🃇', 'Diamonds-8': '🃈', 'Diamonds-9': '🃉', 'Diamonds-10': '🃊', 'Diamonds-J': '🃋', 'Diamonds-Q': '🃍', 'Diamonds-K': '🃎',
  'Clubs-A': '🃑', 'Clubs-2': '🃒', 'Clubs-3': '🃓', 'Clubs-4': '🃔', 'Clubs-5': '🃕', 'Clubs-6': '🃖', 'Clubs-7': '🃗', 'Clubs-8': '🃘', 'Clubs-9': '🃙', 'Clubs-10': '🃚', 'Clubs-J': '🃛', 'Clubs-Q': '🃝', 'Clubs-K': '🃞',
  'Joker-1': '🂿', 'Joker-2': '🂿'
};
