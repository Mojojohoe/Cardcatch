export const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const;
/** Sloth curse dream-wheel outcomes (five equal weights in logic). */
export type SlothDreamResult = 'NOTHING' | 'STARS' | 'MOONS' | 'STARS_AND_MOONS' | 'SUN';

export type Suit =
  | (typeof SUITS)[number]
  | 'Stars'
  | 'Moons'
  | 'Frogs'
  | 'Coins'
  | 'Bones'
  | 'Crowns'
  | 'Grovels'
  /** Wrath curse agents — not in the deal deck; UI / clash modifier only. */
  | 'Swords';

export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Value = (typeof VALUES)[number];

export interface PowerCard {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export const MAJOR_ARCANA: PowerCard[] = [
  { id: 0, name: "The Fool", description: "Swaps both committed suit cards before clash resolution. Wrath’s agent stays visually over the same seat while the card beneath swaps.", icon: "Sparkles" },
  { id: 1, name: "The Magician", description: "Cast Spell: steal a Joker or transmute opponent card into a Frog 1.", icon: "Wand2" },
  { id: 2, name: "The High Priestess", description: "If opponent commits a Major: three draft decoys plus optional swap of your suit play. If not: glimpse one Major still in their pile (when they have any).", icon: "Eye" },
  { id: 3, name: "The Empress", description: "Gain copies of both resulting suit cards after the round — the final cards on the table after transforms, frogging, and curse clash effects.", icon: "Crown" },
  { id: 4, name: "The Emperor", description: "Changes your card to the target suit and adds 2 to its value.", icon: "Shield" },
  { id: 5, name: "The Hierophant", description: "Reveals half of the opponent's hand after the round, including power cards.", icon: "BookType" },
  { id: 6, name: "The Lovers", description: "Changes the target suit to hearts before round resolution.", icon: "Heart" },
  { id: 7, name: "The Chariot", description: "If the player loses the round, their suit card is returned to their hand with +1 value.", icon: "FastForward" },
  { id: 8, name: "Strength", description: "Increases the played card value by 4.", icon: "BicepsFlexed" },
  { id: 9, name: "The Hermit", description: "Swaps your play for a hand card that wins or draws against the opponent after clash penalties (e.g. Wrath debuffs on effective rank).", icon: "Lamp" },
  { id: 10, name: "The Wheel of Fortune", description: "Spins seven weighted chaos outcomes—when two Wheels fire, initiative coin decides which resolves first.", icon: "RefreshCw" },
  { id: 11, name: "Justice", description: "Conjures a brand-new suit card on the legal table suit; opponent must beat BOTH your play and this ally.", icon: "Scale" },
  { id: 12, name: "The Hanged Man", description: "Player forfeits the round, but gains 3 cards.", icon: "Anchor" },
  { id: 13, name: "Death", description: "Wins the round outright unless blocked by The Tower.", icon: "Skull" },
  { id: 14, name: "Temperance", description: "The round is drawn. Players get suit cards back, power cards are consumed.", icon: "Waves" },
  { id: 15, name: "The Devil", description: "Devil Deal: discard 2 random hand cards to apply one tactical effect.", icon: "Flame" },
  { id: 16, name: "The Tower", description: "Stops the effects of an opponent's power card.", icon: "ZapOff" },
  { id: 17, name: "The Star", description: "Adds 'Stars' suit to the target wheel. Star suit transforms all played cards to Stars.", icon: "Star" },
  { id: 18, name: "The Moon", description: "Adds 'Moons' suit to target wheel and deck. Also conjures two Moons-suited suit cards next round.", icon: "Moon" },
  { id: 19, name: "The Sun", description: "Gain a copy of your committed suit card exactly as it was locked in before any round modifiers — before powers, curses, or transforms resolve.", icon: "Sun" },
  { id: 20, name: "Judgement", description: "Inverts round resolution: whoever would have won loses, and vice versa.", icon: "Gavel" },
  { id: 21, name: "The World", description: "Grants a random Major from the deck and conjures a brand-new random suit card (not drawn from the table deck).", icon: "Globe" }
];

export interface Card {
  suit: Suit;
  value: Value;
  isJoker: boolean;
  id: string;
}

export type PlayerRole = 'Predator' | 'Prey' | 'Preydator';

export interface GameSettings {
  hostRole: PlayerRole;
  /** Predator-aligned seat draws this many suit cards when the trick begins. */
  predatorStartingCards: number;
  /** Prey-aligned seat draws this many suit cards when the trick begins. */
  preyStartingCards: number;
  /**
   * How many copies of the standard pile (52 + optional 2 Jokers each) shuffle into the table deck.
   * 1 ⇒ 54 with Jokers; same ratio scales when Jokers off.
   */
  deckSizeMultiplier: number;
  disableJokers: boolean;
  disablePowerCards: boolean;
  /** Deadly-sins curse cards (table zone + effects). Off = no curse mechanics. */
  enableCurseCards: boolean;
  /** Mix curse IDs into the power draft deck / random power draws. Off by default. */
  curseCardsInPowerDeck: boolean;
  /** Optional future module — no gameplay effect yet. */
  enablePokerChips: boolean;
  /** Optional future module — no gameplay effect yet. */
  enablePanicDice: boolean;
  enableDesperation: boolean;
  /**
   * When desperation is on: if true, prey seats begin **at desperation tier 0** from deal (on the ladder immediately).
   * If false, they have **no numbered desperation tier** until their **first in-match** desperation spin, which moves them to tier 1.
   */
  desperationStarterTierEnabled: boolean;
  /**
   * Only when hostRole is Preydator and desperation is on: which seat may use the desperation wheel.
   * Outside Preydator matches, UI treats this as prey-only (guest when host is Predator, etc.).
   */
  preydatorDesperationSeats?: 'host' | 'guest' | 'both';
  tiers: string[];
  /**
   * `builtin:*` IDs map to bundled text presets; `local:*` to host-saved presets;
   * `custom` whenever the host edited individual fields outside a preset apply.
   */
  lobbyPresetId: string;
}

/** Rows shown in UI; index `ladderIdx` matches `PlayerData.desperationTier` and `settings.tiers[ladderIdx]`. */
export type DesperationTierRow = { ladderIdx: number; label: string };

/** When tier-0-from-deal is off, ladder index 0 is unused — hide it from tier lists while keeping `tiers[0]` in saved settings. */
export function desperationTierRowsForDisplay(settings: Pick<GameSettings, 'tiers' | 'desperationStarterTierEnabled'>): DesperationTierRow[] {
  return settings.tiers
    .map((label, ladderIdx) => ({ ladderIdx, label }))
    .filter((row) => settings.desperationStarterTierEnabled || row.ladderIdx > 0);
}

/** Denominator for vignette intensity when tier 0 is omitted from play. */
export function effectiveActiveDesperationTierCount(settings: Pick<GameSettings, 'tiers' | 'desperationStarterTierEnabled'>): number {
  const n = settings.tiers.length;
  if (n === 0) return 0;
  return settings.desperationStarterTierEnabled ? n : Math.max(1, n - 1);
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
  /** Ladder step; −1 = not on ladder until first desperation spin (tier 0 disabled in settings). */
  desperationTier: number;
  desperationResult: string | null;
  desperationSpinning: boolean;
  desperationOffset: number;
  /** Guest only: tapped “Ready” while host configures the table before start. Resets when host edits settings. */
  lobbyGuestReady?: boolean;
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
  /** Three power IDs shown as decoys — includes opponent’s actual power if they played one (from draft pool only). */
  priestessPowerCandidates?: number[] | null;
  /** When opponent is NOT committing a Major: one random held power from their pile (not including the card in play). */
  priestessPeekStashPowerId?: number | null;
  /** UI: true when opponent had no spare majors to peek. */
  priestessPeekStashEmpty?: boolean;
}

export type ResolutionEventType = 
  | 'POWER_TRIGGER' 
  | 'POWER_DESTROYED'
  | 'CARD_SWAP' 
  | 'CARD_EMPOWER' 
  | 'TARGET_CHANGE' 
  | 'COIN_FLIP' 
  | 'SUMMON_CARD'
  | 'TRANSFORM'
  | 'INTEL_REVEAL'
  /** Clash rank floored to 0 by penalties (e.g. Wrath) — play shattered animation; not Grovel/Joker. */
  | 'CLASH_DESTROYED'
  /** Envy: covet digest at resolution start. */
  | 'ENVY_COVET'
  /** Envy: a played card strikes the Green-Eyed Monster. */
  | 'ENVY_STRIKE'
  /** Envy: monster HP reached 0. */
  | 'ENVY_DEFEATED'
  /** Envy: both grovels — nothing left to covet. */
  | 'ENVY_DEPARTS'
  /** Sloth: post-clash dream wheel narrative + transforms. */
  | 'SLOTH_DREAM';

export interface ResolutionEvent {
  type: ResolutionEventType;
  uid?: string;
  cardId?: string;
  powerCardId?: number;
  suit?: Suit;
  message: string;
  /** Envy strike: damage dealt this hit. */
  envyDamage?: number;
  /** Envy: monster HP after this event (strike / feed). */
  envyHpAfter?: number;
  slothDreamResult?: SlothDreamResult;
  /** Sloth dream wheel pointer offset ∈ [0,1) in weight space (replay). */
  slothDreamSpinOffset?: number;
}

/** One chat line synced by host across the room (PeerJS clients). */
export interface ChatMessageEntry {
  uid: string;
  name: string;
  text: string;
  at: number;
}

/** Active curse on the table (curse zone). */
export interface ActiveCurseState {
  id: number;
  /** Lust: progress toward 150. */
  lustAccumulated?: number;
  /** Gluttony: 0 hungry → 1 starving → 2 wasting away; paired with streak toward next tier. */
  gluttonyPhase?: number;
  /** Rounds without any heart played counting toward next hunger escalation (0–1, resets at 2). */
  gluttonyNoHeartStreak?: number;
  /** Greed: tax absorbed into the Tyrant’s crown (cap 17 ends the curse). */
  greedCrown?: number;
  /** Wrath: 1 (Thug) → 5 (Warlord); advances each resolved round until curse ends. */
  wrathRound?: number;
  /** Envy: Green-Eyed Monster HP (starts at 10 when curse is played). */
  envyMonsterHp?: number;
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
  /** Increased when host changes settings during lobby — guest must re-ready. */
  lobbySettingsRevision?: number;
  /** Shown to guest after host tweaks settings until they acknowledge by setting ready again. */
  guestLobbyNotice?: string | null;
  /** IDs that appeared anywhere in the draft (for Priestess misleading display). */
  draftPowerAppearances?: number[];
  famineActive?: boolean;
  /** Locked-in moves when transitioning to powering (for Priestess swap animation + peel). */
  engageMoves?: Record<string, string> | null;
  /**
   * Host-only beat: show only suit plays + face-down power teasers before interactive modals.
   * Cleared after a short delay (see gameService).
   */
  awaitingPowerShowdown?: boolean;
  pendingPowerDecisions?: Record<string, PendingPowerDecision | null>;
  /** Ring buffer of lobby / in-game messages (host-owned). */
  chatMessages?: ChatMessageEntry[];
  /** Curses currently affecting the table (e.g. Lust). */
  activeCurses?: ActiveCurseState[];
  /**
   * Greed: exact card IDs injected into the deck for this curse instance.
   * Stripped from the deck only when Greed ends (coins in hands remain).
   */
  greedInjectedCoins?: string[];
  /** After Greed ends on a draw: crown sits on the table until a round winner claims Crowns-E. */
  tyrantCrownPending?: { crownTotal: number };
  /**
   * Pride curse: random barrier card for this round’s table suit (`${targetSuit}-${rank}`).
   * Target-suit cards at or above its clash rank cannot be played (Grovel excepted).
   */
  prideCeilingCard?: string | null;
  /** Wrath: coin-selected player marked this round; minion card applies −rank to their clash value (Jokers immune). */
  wrathTargetUid?: string | null;
  wrathMinionCard?: string | null;
  /**
   * Envy: one hand slot the Monster covets this round (`handIndex` into that player’s hand at round start).
   * Jokers are never chosen; sealed instances are skipped.
   */
  envyCovet?: { uid: string; cardId: string; handIndex: number } | null;
  /**
   * Envy: multiset of sealed card ids per player — first N matching copies in hand order are unplayable until Envy ends.
   */
  envySealedCards?: Record<string, string[]>;
  /**
   * Set when Grovel was added to **both** players’ hands for Envy starvation; cleared after a resolution check.
   * If both play Grovel, Envy ends with ENVY_DEPARTS.
   */
  envyBothGrovelTrap?: boolean;
  /**
   * Sloth: snapshot of `availableSuits` immediately before the curse collapsed the trump wheel
   * to Stars/Moons — restored when the dream ends (Sun).
   */
  slothSavedAvailableSuits?: Suit[] | null;
  lastOutcome?: {
    targetSuit: Suit;
    winnerUid: string | 'draw';
    message: string;
    cardsPlayed: Record<string, string>;
    powerCardsPlayed: Record<string, string>;
    powerCardIdsPlayed: Record<string, number | null>;
    /** True when that player's committed power was blocked by The Tower (card is still consumed). */
    powerCardTowerBlocked?: Record<string, boolean>;
    /** Lost a same-round curse-vs-curse coin flip — curse card is still consumed, curse does not activate. */
    curseClashSuppressed?: Record<string, boolean>;
    coinFlip?: string; // 'Host' | 'Opponent' winner of initiative
    events: ResolutionEvent[];
    summonedCards?: Record<string, string>; // e.g. Justice summoned card
    initialCardsPlayed: Record<string, string>;
    gains: Record<
      string,
      { type: 'card' | 'power' | 'draw'; id: string | number | 'new-card' }[]
    >;
    /** Lust meter animation + persistence helper. */
    lustRoundFx?: {
      contributions: { uid: string; card: string; doubledValue: number }[];
      previousMeter: number;
      /** After applying contributions; 0 if sated. */
      nextMeter: number;
      sated: boolean;
    };
    /** Gluttony starvation advance after this round (when Gluttony was already active). */
    gluttonyPersistence?: {
      remove: boolean;
      phase: number;
      streak: number;
    };
    /** Greed crown tax vs cap 17 (`removeReason === 'crown'` ends the curse this round). */
    greedPersistence?: {
      nextCrown: number;
      taxThisRound: number;
      removeReason: 'crown' | null;
    };
    /** Wrath agent hovering the marked seat this resolution (for UI replay). */
    wrathFx?: {
      targetUid: string;
      minionCard: string;
      magnitude: number;
      sparedJoker: boolean;
    };
    /** True when that player’s suit play’s clash rank hit 0 from penalties (Wrath) this round — ghosted on results. */
    clashDestroyedByPenalty?: Record<string, boolean>;
    /** Envy resolution bundle (replay + persistence). */
    envyRoundFx?: {
      covetUid: string | null;
      covetCardId: string | null;
      covetHandIndex: number | null;
      playedCoveted: boolean;
      absorbedClash: number;
      /** Additional sealed card ids appended this round (multiset arrays per uid). */
      newSeals: Record<string, string[]>;
      monsterHpStart: number;
      monsterHpAfterFeed: number;
      strikes: { uid: string; damage: number; hpAfter: number }[];
      monsterHpEnd: number;
      defeated: boolean;
      departedDoubleGrovel: boolean;
    };
    /** Sloth dream wheel (after clash; may transform cards or end the curse). */
    slothDreamFx?: {
      result: SlothDreamResult;
      spinOffset: number;
    };
  };
}

export const CARD_UNICODE: Record<string, string> = {
  'Spades-A': '🂡', 'Spades-2': '🂢', 'Spades-3': '🂣', 'Spades-4': '🂤', 'Spades-5': '🂥', 'Spades-6': '🂦', 'Spades-7': '🂧', 'Spades-8': '🂨', 'Spades-9': '🂩', 'Spades-10': '🂪', 'Spades-J': '🂫', 'Spades-Q': '🂭', 'Spades-K': '🂮',
  'Hearts-A': '🂱', 'Hearts-2': '🂲', 'Hearts-3': '🂳', 'Hearts-4': '🂴', 'Hearts-5': '🂵', 'Hearts-6': '🂶', 'Hearts-7': '🂷', 'Hearts-8': '🂸', 'Hearts-9': '🂹', 'Hearts-10': '🂺', 'Hearts-J': '🂻', 'Hearts-Q': '🂽', 'Hearts-K': '🂾',
  'Diamonds-A': '🃁', 'Diamonds-2': '🃂', 'Diamonds-3': '🃃', 'Diamonds-4': '🃄', 'Diamonds-5': '🃅', 'Diamonds-6': '🃆', 'Diamonds-7': '🃇', 'Diamonds-8': '🃈', 'Diamonds-9': '🃉', 'Diamonds-10': '🃊', 'Diamonds-J': '🃋', 'Diamonds-Q': '🃍', 'Diamonds-K': '🃎',
  'Clubs-A': '🃑', 'Clubs-2': '🃒', 'Clubs-3': '🃓', 'Clubs-4': '🃔', 'Clubs-5': '🃕', 'Clubs-6': '🃖', 'Clubs-7': '🃗', 'Clubs-8': '🃘', 'Clubs-9': '🃙', 'Clubs-10': '🃚', 'Clubs-J': '🃛', 'Clubs-Q': '🃝', 'Clubs-K': '🃞',
  'Joker-1': '🂿', 'Joker-2': '🂿'
};
