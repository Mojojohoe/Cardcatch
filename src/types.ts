export const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const;
export type Suit = (typeof SUITS)[number] | 'Stars' | 'Moons' | 'Frogs' | 'Coins' | 'Bones';

export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Value = (typeof VALUES)[number];

export interface PowerCard {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export const MAJOR_ARCANA: PowerCard[] = [
  { id: 0, name: "The Fool", description: "Swaps the opponents and the players suit cards before round resolution.", icon: "Sparkles" },
  { id: 1, name: "The Magician", description: "Cast Spell: steal a Joker or transmute opponent card into a Frog 1.", icon: "Wand2" },
  { id: 2, name: "The High Priestess", description: "After both commit: learn whether the opponent used a power this round and optionally swap your played card.", icon: "Eye" },
  { id: 3, name: "The Empress", description: "Gives the player both cards played after the round.", icon: "Crown" },
  { id: 4, name: "The Emperor", description: "Changes your card to the target suit and adds 2 to its value.", icon: "Shield" },
  { id: 5, name: "The Hierophant", description: "Reveals half of the opponent's hand after the round, including power cards.", icon: "BookType" },
  { id: 6, name: "The Lovers", description: "Changes the target suit to hearts before round resolution.", icon: "Heart" },
  { id: 7, name: "The Chariot", description: "If the player loses the round, their suit card is returned to their hand with +1 value.", icon: "FastForward" },
  { id: 8, name: "Strength", description: "Increases the played card value by 4.", icon: "BicepsFlexed" },
  { id: 9, name: "The Hermit", description: "Automatically swaps the player's card to one that beats or draws against the opponent.", icon: "Lamp" },
  { id: 10, name: "The Wheel of Fortune", description: "Always spins a chaos wheel and applies one of seven weighted outcomes.", icon: "RefreshCw" },
  { id: 11, name: "Justice", description: "Generates a random card of target suit; opponent must beat BOTH the player and this card to win.", icon: "Scale" },
  { id: 12, name: "The Hanged Man", description: "Player forfeits the round, but gains 3 cards.", icon: "Anchor" },
  { id: 13, name: "Death", description: "Wins the round outright unless blocked by The Tower.", icon: "Skull" },
  { id: 14, name: "Temperance", description: "The round is drawn. Players get suit cards back, power cards are consumed.", icon: "Waves" },
  { id: 15, name: "The Devil", description: "Devil Deal: discard 2 random hand cards to apply one tactical effect.", icon: "Flame" },
  { id: 16, name: "The Tower", description: "Stops the effects of an opponent's power card.", icon: "ZapOff" },
  { id: 17, name: "The Star", description: "Adds 'Stars' suit to the target wheel. Star suit transforms all played cards to Stars.", icon: "Star" },
  { id: 18, name: "The Moon", description: "Adds 'Moons' suit to target wheel and deck. Also gives the player 2 random moon cards next round.", icon: "Moon" },
  { id: 19, name: "The Sun", description: "Creates a copy of the card the player played and adds it to their hand next turn.", icon: "Sun" },
  { id: 20, name: "Judgement", description: "Inverts round resolution: whoever would have won loses, and vice versa.", icon: "Gavel" },
  { id: 21, name: "The World", description: "Gives the player a random power card and a random suit card.", icon: "Globe" }
];

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
  powerCards: number[]; // Array of IDs from MAJOR_ARCANA
  currentMove: string | null;
  currentPowerCard: number | null;
  confirmed: boolean;
  readyForNextRound: boolean;
  desperationTier: number;
  desperationResult: string | null;
  desperationSpinning: boolean;
  desperationOffset: number;
  priestessVisionUsed?: boolean;
  secretIntel?: {
    type: 'Hierophant' | 'Priestess';
    cards: string[];
    powerCards: number[];
  } | null;
}

export interface PendingPowerDecision {
  powerCardId: number;
  options: string[];
  disabledReasons?: Record<string, string>;
  selectedOption: string | null;
  wheelOffset?: number | null;
  wheelResult?: string | null;
  /** High Priestess: chosen replacement card (`null`/omit = keep locked-in engage card). Resolved at outcome finalize only. */
  priestessSwapToCard?: string | null;
  priestessOpponentUsesPower?: boolean;
  priestessOpponentName?: string;
}

export type ResolutionEventType = 
  | 'POWER_TRIGGER' 
  | 'CARD_SWAP' 
  | 'CARD_EMPOWER' 
  | 'TARGET_CHANGE' 
  | 'COIN_FLIP' 
  | 'SUMMON_CARD'
  | 'TRANSFORM'
  | 'INTEL_REVEAL';

export interface ResolutionEvent {
  type: ResolutionEventType;
  uid?: string;
  cardId?: string;
  powerCardId?: number;
  suit?: Suit;
  message: string;
}

export interface RoomData {
  code: string;
  status: 'waiting' | 'drafting' | 'playing' | 'powering' | 'results' | 'finished';
  players: Record<string, PlayerData>;
  settings: GameSettings;
  currentTurn: number;
  targetSuit: Suit | null;
  availableSuits: Suit[];
  wheelOffset: number;
  deck: string[];
  powerDeck: number[];
  draftSets: number[][]; // 3 sets of 3 random power cards
  draftTurn: number; // 0, 1, or 2 (which set is being drafted)
  winner: string | null;
  createdAt: number;
  updatedAt: number;
  hostUid: string;
  famineActive?: boolean;
  /** Locked-in moves when transitioning to powering (for Priestess swap animation + peel). */
  engageMoves?: Record<string, string> | null;
  pendingPowerDecisions?: Record<string, PendingPowerDecision | null>;
  lastOutcome?: {
    targetSuit: Suit;
    winnerUid: string | 'draw';
    message: string;
    cardsPlayed: Record<string, string>;
    powerCardsPlayed: Record<string, string>;
    powerCardIdsPlayed: Record<string, number | null>;
    coinFlip?: string; // 'Host' | 'Opponent' winner of initiative
    events: ResolutionEvent[];
    summonedCards?: Record<string, string>; // e.g. Justice summoned card
    initialCardsPlayed: Record<string, string>;
    gains: Record<string, { type: 'card' | 'power' | 'draw', id: string | number }[]>;
  };
}

export const CARD_UNICODE: Record<string, string> = {
  'Spades-A': '🂡', 'Spades-2': '🂢', 'Spades-3': '🂣', 'Spades-4': '🂤', 'Spades-5': '🂥', 'Spades-6': '🂦', 'Spades-7': '🂧', 'Spades-8': '🂨', 'Spades-9': '🂩', 'Spades-10': '🂪', 'Spades-J': '🂫', 'Spades-Q': '🂭', 'Spades-K': '🂮',
  'Hearts-A': '🂱', 'Hearts-2': '🂲', 'Hearts-3': '🂳', 'Hearts-4': '🂴', 'Hearts-5': '🂵', 'Hearts-6': '🂶', 'Hearts-7': '🂷', 'Hearts-8': '🂸', 'Hearts-9': '🂹', 'Hearts-10': '🂺', 'Hearts-J': '🂻', 'Hearts-Q': '🂽', 'Hearts-K': '🂾',
  'Diamonds-A': '🃁', 'Diamonds-2': '🃂', 'Diamonds-3': '🃃', 'Diamonds-4': '🃄', 'Diamonds-5': '🃅', 'Diamonds-6': '🃆', 'Diamonds-7': '🃇', 'Diamonds-8': '🃈', 'Diamonds-9': '🃉', 'Diamonds-10': '🃊', 'Diamonds-J': '🃋', 'Diamonds-Q': '🃍', 'Diamonds-K': '🃎',
  'Clubs-A': '🃑', 'Clubs-2': '🃒', 'Clubs-3': '🃓', 'Clubs-4': '🃔', 'Clubs-5': '🃕', 'Clubs-6': '🃖', 'Clubs-7': '🃗', 'Clubs-8': '🃘', 'Clubs-9': '🃙', 'Clubs-10': '🃚', 'Clubs-J': '🃛', 'Clubs-Q': '🃝', 'Clubs-K': '🃞',
  'Joker-1': '🂿', 'Joker-2': '🂿'
};
