import Peer, { DataConnection } from 'peerjs';
import { RoomData, PlayerData, Suit, SUITS, VALUES, GameSettings, PlayerRole, MAJOR_ARCANA, ResolutionEvent, PendingPowerDecision } from '../types';

export const createDeck = (disableJokers: boolean): string[] => {
  const deck: string[] = [];
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push(`${suit}-${value}`);
    });
  });
  if (!disableJokers) {
    deck.push('Joker-1');
    deck.push('Joker-2');
  }
  return shuffle(deck);
};

export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const getCardValue = (cardStr: string): number => {
  if (cardStr.startsWith('Joker')) return 20; // Beat Ace (14)
  const value = cardStr.split('-')[1];
  if (value === 'A') return 14;
  if (value === 'K') return 13;
  if (value === 'Q') return 12;
  if (value === 'J') return 11;
  return parseInt(value);
};

export const parseCard = (cardStr: string): { suit: string, value: string, isJoker: boolean } => {
  if (cardStr.startsWith('Joker')) {
    return { suit: 'Joker', value: 'Joker', isJoker: true };
  }
  const [suit, value] = cardStr.split('-');
  return { suit, value, isJoker: false };
};

const RANK_WORDS: Record<string, string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
};

/** Mid-sentence card label: "the Ace of Hearts", "a Joker". */
export const describeCardPlain = (cardStr: string): string => {
  const p = parseCard(cardStr);
  if (p.isJoker) return 'a Joker';
  const rk = RANK_WORDS[p.value] ?? p.value;
  return `the ${rk} of ${p.suit}`;
};

function sentenceCard(cardStr: string): string {
  const mid = describeCardPlain(cardStr);
  return mid.replace(/^the /, 'The ').replace(/^a /, 'A ');
}

function isOnTargetField(cardStr: string, targetSuit: Suit): boolean {
  const p = parseCard(cardStr);
  if (p.isJoker) return false;
  if (p.suit === targetSuit) return true;
  if (targetSuit === 'Stars') return true;
  return false;
}

/** Main trick winner when p1 plays `cr1` and p2 plays `cr2` (Hermit swaps = p1 Hermit candidate). */
export function evaluateTrickClash(cr1: string, cr2: string, targetSuit: Suit): 'p1' | 'p2' | 'draw' {
  const pr1 = parseCard(cr1);
  const pr2 = parseCard(cr2);
  if (pr1.isJoker && pr2.isJoker) return 'draw';

  if (pr1.isJoker && !pr2.isJoker) {
    if (targetSuit === 'Stars') return 'p1';
    if (targetSuit === 'Moons') return pr2.suit === 'Moons' ? 'p1' : 'p2';
    return pr2.suit === targetSuit ? 'p1' : 'p2';
  }
  if (pr2.isJoker && !pr1.isJoker) {
    if (targetSuit === 'Stars') return 'p2';
    if (targetSuit === 'Moons') return pr1.suit === 'Moons' ? 'p2' : 'p1';
    return pr1.suit === targetSuit ? 'p2' : 'p1';
  }

  const p1Target = pr1.suit === targetSuit || (targetSuit === 'Stars' && !pr1.isJoker);
  const p2Target = pr2.suit === targetSuit || (targetSuit === 'Stars' && !pr2.isJoker);

  if (p1Target && !p2Target) return 'p1';
  if (!p1Target && p2Target) return 'p2';

  const v1 = getCardValue(cr1);
  const v2 = getCardValue(cr2);
  if (v1 > v2) return 'p1';
  if (v2 > v1) return 'p2';
  return 'draw';
}

/**
 * One-line reason the winning card beats the losing card (winner card first), aligned with evaluateTrickClash.
 */
export function explainPlainClash(winningCardStr: string, losingCardStr: string, targetSuit: Suit): string {
  const prW = parseCard(winningCardStr);
  const prL = parseCard(losingCardStr);
  const targ = targetSuit;
  const lMid = describeCardPlain(losingCardStr);
  const wMid = describeCardPlain(winningCardStr);

  if (prW.isJoker && prL.isJoker) return 'Both played a Joker — tie.';

  if (prW.isJoker && !prL.isJoker) {
    if (targ === 'Stars') {
      return `A Joker wins on Stars — normal cards take the Star field, but a Joker never becomes a Star.`;
    }
    if (targ === 'Moons') {
      return `A Joker wins — ${sentenceCard(losingCardStr)} is Moons on a Moons table.`;
    }
    return `A Joker wins over ${sentenceCard(losingCardStr)} — it matched table suit (${targ}).`;
  }

  if (!prW.isJoker && prL.isJoker) {
    if (targ === 'Stars') {
      return `On Stars, a suited card should not outrank a lone Joker — if you see this, report a bug.`;
    }
    if (targ === 'Moons') {
      return `${sentenceCard(winningCardStr)} is not Moons on a Moons table — that beats a Joker.`;
    }
    return `${sentenceCard(winningCardStr)} did not match table suit (${targ}); that beats a Joker (Frogs, Coins, Bones never count as trump).`;
  }

  const wField = isOnTargetField(winningCardStr, targ);
  const lField = isOnTargetField(losingCardStr, targ);
  const wv = getCardValue(winningCardStr);
  const lv = getCardValue(losingCardStr);

  if (wField && !lField)
    return `${sentenceCard(winningCardStr)} matched table suit (${targ}); ${lMid} did not — table suit wins.`;
  if (wv !== lv) {
    const scope = wField ? `both on table suit (${targ})` : `neither matched table suit (${targ}), so ranks decide`;
    return `${sentenceCard(winningCardStr)} (${wv}) beats ${lMid} (${lv}) — ${scope}.`;
  }
  const tieScope = wField ? `both on (${targ})` : `neither matched (${targ})`;
  return `${sentenceCard(winningCardStr)} and ${lMid} tie — ${tieScope}.`;
}

type GameEvent = 
  | { type: 'STATE_UPDATE', state: RoomData }
  | { type: 'PLAYER_JOIN', name: string, uid: string }
  | { type: 'PLAY_CARD', uid: string, cardId: string }
  | { type: 'PROCEED_NEXT', uid: string }
  | { type: 'UPDATE_SETTINGS', settings: GameSettings }
  | { type: 'SPIN_DESPERATION', uid: string, offset: number }
  | { type: 'RESOLVE_DESPERATION', uid: string }
  | { type: 'SELECT_DRAFT', uid: string, powerCardId: number }
  | { type: 'CHEAT_POWER', uid: string, powerCardId: number }
  | { type: 'CHEAT_TRIM_DECK', uid: string, removeCount: number }
  | { type: 'CHEAT_DISCARD_HAND_CARD', uid: string, cardId: string }
  | { type: 'PLAY_POWER_CARD', uid: string, powerCardId: number | null }
  | { type: 'SUBMIT_POWER_DECISION', uid: string, option: string, wheelOffset?: number; priestessSwapToCard?: string | null }
  | { type: 'SET_LOBBY_READY', uid: string, ready: boolean };

const STORAGE_KEY = 'preydator_settings';

const normalizeGameSettings = (raw: Partial<GameSettings> | GameSettings): GameSettings => {
  const hostRole = raw.hostRole ?? 'Predator';
  const preydOk =
    hostRole === 'Preydator' &&
    (raw.preydatorDesperationSeats === 'host' ||
      raw.preydatorDesperationSeats === 'guest' ||
      raw.preydatorDesperationSeats === 'both');
  return {
    hostRole,
    difficulty: (raw.difficulty ?? 'Normal') as GameSettings['difficulty'],
    disableJokers: Boolean(raw.disableJokers),
    disablePowerCards: Boolean(raw.disablePowerCards),
    enableDesperation: Boolean(raw.enableDesperation),
    desperationStarterTierEnabled: raw.desperationStarterTierEnabled !== false,
    preydatorDesperationSeats: preydOk ? raw.preydatorDesperationSeats! : 'guest',
    tiers: raw.tiers && raw.tiers.length > 0 ? raw.tiers : ['TIER 0']
  };
};

const loadSettings = (): GameSettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return normalizeGameSettings(parsed);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
  return normalizeGameSettings({
    hostRole: 'Predator',
    difficulty: 'Normal',
    disableJokers: false,
    disablePowerCards: false,
    enableDesperation: false,
    desperationStarterTierEnabled: true,
    tiers: ['TIER 0']
  });
};

const saveSettings = (settings: GameSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const DESPERATION_SLICES = [
  { label: 'GAME OVER', weight: 1 },
  { label: 'Gain 3 Cards', weight: 15 },
  { label: 'Gain 2 Cards', weight: 6 },
  { label: 'Gain 4 Cards', weight: 6 },
  { label: 'Gain 1 Cards', weight: 3 },
  { label: 'Gain 3 Cards', weight: 15 },
  { label: 'Gain 2 Cards', weight: 6 },
  { label: 'Gain 4 Cards', weight: 6 },
  { label: 'Gain 1 Cards', weight: 3 },
  { label: 'Gain 3 Cards', weight: 15 },
  { label: 'Gain 2 Cards', weight: 6 },
  { label: 'Gain 4 Cards', weight: 6 },
  { label: 'Gain 1 Cards', weight: 3 },
  { label: 'Gain 5 Cards', weight: 5 },
  { label: 'Gain 6 Cards', weight: 4 },
];

/** Whether `uid` may start a desperation spin under current role + Preydator seat rules. */
export function desperationSpinAllowed(room: RoomData, uid: string, player: PlayerData): boolean {
  const s = room.settings;
  if (!s.enableDesperation) return false;
  if (s.hostRole === 'Preydator') {
    const mode = s.preydatorDesperationSeats ?? 'guest';
    if (mode === 'both') return true;
    if (mode === 'host') return uid === room.hostUid;
    return uid !== room.hostUid;
  }
  if (player.role === 'Predator') return false;
  return player.role === 'Prey';
}

export class GameService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost = false;
  private state: RoomData | null = null;
  private onStateChange: ((state: RoomData) => void) | null = null;
  private myUid: string = '';
  private powerResolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private powerShowdownClearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.myUid = Math.random().toString(36).substring(2, 9);
  }

  async init(onStateChange: (state: RoomData) => void): Promise<string> {
    this.onStateChange = onStateChange;
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      this.peer.on('open', (id) => resolve(id));
      this.peer.on('error', (err) => reject(err));
      
      this.peer.on('connection', (conn) => {
        if (!this.isHost) {
          conn.close();
          return;
        }
        
        // Prevent 3rd player
        if (this.state && Object.keys(this.state.players).length >= 2) {
            conn.close();
            return;
        }

        this.connection = conn;
        this.setupConnection(conn);
      });
    });
  }

  getUid() {
    return this.myUid;
  }

  async createRoom(playerName: string, onStateChange: (state: RoomData) => void): Promise<string> {
    this.isHost = true;
    const roomId = await this.init(onStateChange);
    
    this.state = {
      code: roomId,
      status: 'waiting',
      settings: loadSettings(),
      players: {
        [this.myUid]: {
          uid: this.myUid,
          name: playerName,
          role: 'Predator',
          hand: [],
          powerCards: [],
          currentMove: null,
          currentPowerCard: null,
          confirmed: false,
          readyForNextRound: false,
          desperationTier: 0,
          desperationResult: null,
          desperationSpinning: false,
          desperationOffset: 0
        }
      },
      currentTurn: 1,
      targetSuit: SUITS[Math.floor(Math.random() * SUITS.length)],
      availableSuits: [...SUITS],
      wheelOffset: Math.random(),
      deck: [],
      winner: null,
      hostUid: this.myUid,
      lobbySettingsRevision: 0,
      guestLobbyNotice: null,
      famineActive: false,
      pendingPowerDecisions: {},
      powerDeck: [],
      draftSets: [],
      draftTurn: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.onStateChange?.(this.state);
    return roomId;
  }

  async updateSettings(settings: GameSettings) {
    if (!this.isHost || !this.state) return;
    const normalized = normalizeGameSettings(settings);
    const guestUid = Object.keys(this.state.players).find(uid => uid !== this.myUid);
    const updatedPlayers = { ...this.state.players };
    let lobbySettingsRevision = this.state.lobbySettingsRevision ?? 0;
    let guestLobbyNotice: string | null = this.state.guestLobbyNotice ?? null;
    if (guestUid && this.state.status === 'waiting') {
      lobbySettingsRevision += 1;
      guestLobbyNotice = 'Game settings were updated.';
      updatedPlayers[guestUid] = { ...updatedPlayers[guestUid], lobbyGuestReady: false };
    }
    this.state = {
      ...this.state,
      settings: normalized,
      players: updatedPlayers,
      lobbySettingsRevision,
      guestLobbyNotice,
      updatedAt: Date.now()
    };
    saveSettings(normalized);
    this.broadcastState();
  }

  async joinRoom(roomId: string, playerName: string, onStateChange: (state: RoomData) => void): Promise<void> {
    this.onStateChange = onStateChange;
    this.isHost = false;
    await this.init(onStateChange);
    
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject('Peer not initialized');
      
      const timeout = setTimeout(() => {
        this.connection?.close();
        reject('Connection timeout');
      }, 10000);
      
      const conn = this.peer.connect(roomId);
      this.connection = conn;
      
      conn.on('open', () => {
        clearTimeout(timeout);
        this.setupConnection(conn);
        this.sendEvent({ type: 'PLAYER_JOIN', name: playerName, uid: this.myUid });
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      
      // Handle the case where the peer exists but connection fails
      this.peer!.on('error', (err) => {
        if (err.type === 'peer-unavailable' || err.type === 'unavailable-id') {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('data', (data) => {
      const event = data as GameEvent;
      this.handleEvent(event);
    });

    conn.on('close', () => {
      console.log('Connection closed');
      // Handle player disconnected
    });
  }

  private handleEvent(event: GameEvent) {
    if (this.isHost) {
      const remoteUid = this.getRemotePlayerUid();
      if (event.type === 'PLAYER_JOIN') {
        this.handlePlayerJoin(event.name, event.uid);
      } else if (event.type === 'PLAY_CARD') {
        if (remoteUid) {
          this.processMove(remoteUid, event.cardId);
        }
      } else if (event.type === 'PROCEED_NEXT') {
        if (remoteUid) {
          this.handleProceedNext(remoteUid);
        }
      } else if (event.type === 'UPDATE_SETTINGS') {
        if (remoteUid) return;
        this.updateSettings(event.settings);
      } else if (event.type === 'SET_LOBBY_READY') {
        if (!remoteUid || event.uid !== remoteUid) return;
        this.handleSetLobbyReady(event.uid, event.ready);
      } else if (event.type === 'SPIN_DESPERATION') {
        if (remoteUid) {
          this.processSpinDesperation(remoteUid, Math.random());
        }
      } else if (event.type === 'RESOLVE_DESPERATION') {
        if (remoteUid) {
          this.handleResolveDesperation(remoteUid);
        }
      } else if (event.type === 'SELECT_DRAFT') {
        if (remoteUid) {
          this.handleSelectDraft(remoteUid, event.powerCardId, this.state?.draftTurn || 0);
        }
      } else if (event.type === 'CHEAT_POWER') {
        if (remoteUid) {
          this.handleCheatPower(remoteUid, event.powerCardId);
        }
      } else if (event.type === 'CHEAT_TRIM_DECK') {
        if (remoteUid) {
          this.handleCheatTrimDeck(event.removeCount);
        }
      } else if (event.type === 'CHEAT_DISCARD_HAND_CARD') {
        if (remoteUid) {
          this.handleCheatDiscardHandCard(remoteUid, event.cardId);
        }
      } else if (event.type === 'PLAY_POWER_CARD') {
        if (remoteUid) {
          this.handlePlayPowerCard(remoteUid, event.powerCardId);
        }
      } else if (event.type === 'SUBMIT_POWER_DECISION') {
        if (remoteUid) {
          this.handleSubmitPowerDecision(remoteUid, event.option, event.wheelOffset, event.priestessSwapToCard);
        }
      }
    } else {
      if (event.type === 'STATE_UPDATE') {
        this.state = event.state;
        this.onStateChange?.(this.state);
      }
    }
  }

  private getRemotePlayerUid(): string | null {
    if (!this.state) return null;
    return Object.keys(this.state.players).find(uid => uid !== this.myUid) || null;
  }

  private handlePlayerJoin(name: string, uid: string) {
    if (!this.state) return;
    
    // Reconnection logic: find by name
    const existingPlayerUid = Object.keys(this.state.players).find(id => this.state!.players[id].name === name);
    
    if (existingPlayerUid && this.state.status !== 'waiting') {
      const player = this.state.players[existingPlayerUid];
      const updatedPlayers = { ...this.state.players };
      
      // If the UID is different (new session), update it
      if (existingPlayerUid !== uid) {
        delete updatedPlayers[existingPlayerUid];
        updatedPlayers[uid] = { ...player, uid };
      }
      
      this.state = { 
        ...this.state, 
        players: updatedPlayers, 
        updatedAt: Date.now() 
      };
      this.broadcastState();
      return;
    }

    if (this.state.status !== 'waiting' || Object.keys(this.state.players).length >= 2) return;
    
    const settings = this.state.settings;
    const deck = createDeck(settings.disableJokers);
    
    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;
    
    if (hostRole === 'Preydator') {
      // Internal roles for logic: Host is Pred, Guest is Prey
      hostRole = 'Predator';
      guestRole = 'Prey';
    } else {
      guestRole = hostRole === 'Predator' ? 'Prey' : 'Predator';
    }

    let predatorHandSize = 10;
    let preyHandSize = 6;
    
    if (settings.difficulty === 'Fair') {
      preyHandSize = 10;
    } else if (settings.difficulty === 'Hard') {
      preyHandSize = 4;
    } else if (settings.difficulty === 'Impossible') {
      preyHandSize = 2;
    }

    const hostHandSize = hostRole === 'Predator' ? predatorHandSize : preyHandSize;
    const guestHandSize = guestRole === 'Predator' ? predatorHandSize : preyHandSize;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [uid]: {
          uid,
          name,
          role: 'Prey', // Initial placeholder
          hand: [],
          powerCards: [],
          currentMove: null,
          currentPowerCard: null,
          confirmed: false,
          readyForNextRound: false,
          lobbyGuestReady: false,
          desperationTier: 0,
          desperationResult: null,
          desperationSpinning: false,
          desperationOffset: 0
        }
      },
      updatedAt: Date.now()
    };

    this.broadcastState();
  }

  private handleSetLobbyReady(uid: string, ready: boolean) {
    if (!this.state || this.state.status !== 'waiting') return;
    if (uid === this.state.hostUid) return;
    const guest = this.state.players[uid];
    if (!guest) return;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [uid]: { ...guest, lobbyGuestReady: ready }
      },
      guestLobbyNotice: ready ? null : this.state.guestLobbyNotice,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  async startGame() {
    if (!this.isHost || !this.state) return;
    const players = Object.keys(this.state.players);
    if (players.length < 2) return;
    const guestUid = players.find(uid => uid !== this.myUid);
    if (!guestUid || !this.state.players[guestUid].lobbyGuestReady) return;

    const settings = this.state.settings;
    const deck = createDeck(settings.disableJokers);
    
    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;

    if (hostRole === 'Preydator') {
      hostRole = 'Predator';
      guestRole = 'Prey';
    } else {
      guestRole = hostRole === 'Predator' ? 'Prey' : 'Predator';
    }

    let predatorHandSize = 10;
    let preyHandSize = 6;
    
    if (settings.difficulty === 'Fair') {
      preyHandSize = 10;
    } else if (settings.difficulty === 'Hard') {
      preyHandSize = 4;
    } else if (settings.difficulty === 'Impossible') {
      preyHandSize = 2;
    }

    const hostHandSize = hostRole === 'Predator' ? predatorHandSize : preyHandSize;
    const guestHandSize = guestRole === 'Predator' ? predatorHandSize : preyHandSize;

    const hostHand = deck.splice(0, hostHandSize);
    const guestHand = deck.splice(0, guestHandSize);

    const powerDeck = shuffle(Array.from({ length: 22 }, (_, i) => i));
    const draftSets: number[][] = [];
    if (!settings.disablePowerCards) {
      for (let i = 0; i < 3; i++) {
        draftSets.push(powerDeck.splice(0, 3));
      }
    }
    const draftPowerAppearances = settings.disablePowerCards ? [] : Array.from(new Set(draftSets.flat()));
    /** Prey seats: tier 0 on ladder when enabled; −1 = not on ladder until first spin → then tier 1. */
    const desperationOpenTier =
      settings.enableDesperation && settings.desperationStarterTierEnabled ? 0 : -1;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.myUid]: {
          ...this.state.players[this.myUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : hostRole,
          hand: hostHand,
          desperationTier:
            settings.enableDesperation && (settings.hostRole !== 'Predator') ? desperationOpenTier : 0
        },
        [guestUid]: {
          ...this.state.players[guestUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : guestRole,
          hand: guestHand,
          desperationTier:
            settings.enableDesperation && guestRole !== 'Predator' ? desperationOpenTier : 0
        }
      },
      status: settings.disablePowerCards ? 'playing' : 'drafting',
      deck,
      powerDeck,
      draftSets,
      draftPowerAppearances,
      draftTurn: 0,
      guestLobbyNotice: null,
      pendingPowerDecisions: {},
      updatedAt: Date.now()
    };

    this.broadcastState();
  }

  private processMove(uid: string, cardId: string) {
    if (!this.state || !this.state.players[uid]) return;

    const player = this.state.players[uid];
    if (player.confirmed) return;
    if (!player.hand.includes(cardId)) return;

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      currentMove: cardId,
      confirmed: true
    };

    const allConfirmed = Object.values(updatedPlayers).every((p: PlayerData) => p.confirmed);

    if (allConfirmed) {
      const pendingPowerDecisions = this.createPendingPowerDecisions(
        updatedPlayers,
        this.state.draftPowerAppearances ?? []
      );
      const hasPendingDecisions = Object.values(pendingPowerDecisions).some(Boolean);
      if (hasPendingDecisions) {
        const uidsLocked = Object.keys(updatedPlayers);
        const engageMoves: Record<string, string> = {
          [uidsLocked[0]]: updatedPlayers[uidsLocked[0]].currentMove!,
          [uidsLocked[1]]: updatedPlayers[uidsLocked[1]].currentMove!
        };
        if (this.powerShowdownClearTimer) {
          clearTimeout(this.powerShowdownClearTimer);
          this.powerShowdownClearTimer = null;
        }
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'powering',
          engageMoves,
          awaitingPowerShowdown: true,
          pendingPowerDecisions,
          updatedAt: Date.now()
        };
        if (this.isHost) {
          this.powerShowdownClearTimer = setTimeout(() => {
            if (!this.state || this.state.status !== 'powering') return;
            this.state = { ...this.state, awaitingPowerShowdown: false, updatedAt: Date.now() };
            this.broadcastState();
            this.powerShowdownClearTimer = null;
          }, 2100);
        }
      } else {
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'results',
          pendingPowerDecisions: {},
          lastOutcome: this.calculateOutcome(this.state, updatedPlayers),
          updatedAt: Date.now()
        };
      }
    } else {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        updatedAt: Date.now()
      };
    }

    this.broadcastState();
  }

  private handleProceedNext(uid: string) {
    if (!this.state || !this.state.players[uid]) return;

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...updatedPlayers[uid],
      readyForNextRound: true
    };

    const allReady = Object.values(updatedPlayers).every((p: PlayerData) => p.readyForNextRound);
    
    if (allReady) {
      if (this.powerResolutionTimer) {
        clearTimeout(this.powerResolutionTimer);
        this.powerResolutionTimer = null;
      }
      this.state = this.applyRoundResults(this.state, updatedPlayers);
    } else {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        updatedAt: Date.now()
      };
    }
    
    this.broadcastState();
  }

  async playCard(cardId: string) {
    if (this.isHost) {
      this.processMove(this.myUid, cardId);
    } else {
      this.sendEvent({ type: 'PLAY_CARD', uid: this.myUid, cardId });
    }
  }

  async syncSettings(settings: GameSettings) {
    if (!this.isHost || !this.state) return;
    this.updateSettings(settings);
  }

  async setLobbyReady(ready: boolean) {
    if (!this.state || this.state.status !== 'waiting') return;
    if (this.isHost) return;
    this.sendEvent({ type: 'SET_LOBBY_READY', uid: this.myUid, ready });
  }

  async proceedToNextRound() {
    if (this.isHost) {
      this.handleProceedNext(this.myUid);
    } else {
      this.sendEvent({ type: 'PROCEED_NEXT', uid: this.myUid });
    }
  }

  async spinDesperation() {
    // Offset is random start/end position for the wheel
    const offset = Math.random();
    if (this.isHost) {
      this.processSpinDesperation(this.myUid, offset);
    } else {
      this.sendEvent({ type: 'SPIN_DESPERATION', uid: this.myUid, offset });
    }
  }

  async resolveDesperation() {
    if (this.isHost) {
      this.handleResolveDesperation(this.myUid);
    } else {
      this.sendEvent({ type: 'RESOLVE_DESPERATION', uid: this.myUid });
    }
  }

  async selectDraftPowerCard(powerCardId: number) {
    if (this.isHost) {
      this.handleSelectDraft(this.myUid, powerCardId, this.state?.draftTurn || 0);
    } else {
      this.sendEvent({ type: 'SELECT_DRAFT', uid: this.myUid, powerCardId });
    }
  }

  async selectPowerCard(powerCardId: number | null) {
    if (this.isHost) {
      this.handlePlayPowerCard(this.myUid, powerCardId);
    } else {
      this.sendEvent({ type: 'PLAY_POWER_CARD', uid: this.myUid, powerCardId });
    }
  }

  async cheatPowerCard(powerCardId: number) {
    if (this.isHost) {
      this.handleCheatPower(this.myUid, powerCardId);
    } else {
      this.sendEvent({ type: 'CHEAT_POWER', uid: this.myUid, powerCardId });
    }
  }

  async cheatTrimDeck(removeCount: number) {
    if (this.isHost) {
      this.handleCheatTrimDeck(removeCount);
    } else {
      this.sendEvent({ type: 'CHEAT_TRIM_DECK', uid: this.myUid, removeCount });
    }
  }

  async cheatDiscardFromHand(cardId: string) {
    if (this.isHost) {
      this.handleCheatDiscardHandCard(this.myUid, cardId);
    } else {
      this.sendEvent({ type: 'CHEAT_DISCARD_HAND_CARD', uid: this.myUid, cardId });
    }
  }

  async submitPowerDecision(option: string, wheelOffset?: number, priestessSwapToCard?: string | null) {
    if (this.isHost) {
      this.handleSubmitPowerDecision(this.myUid, option, wheelOffset, priestessSwapToCard);
    } else {
      this.sendEvent({ type: 'SUBMIT_POWER_DECISION', uid: this.myUid, option, wheelOffset, priestessSwapToCard });
    }
  }

  private handleSelectDraft(uid: string, powerCardId: number, expectedTurn: number) {
    if (!this.state || this.state.status !== 'drafting') return;
    if (this.state.draftTurn !== expectedTurn) return;
    
    const player = this.state.players[uid];
    const currentSet = this.state.draftSets[this.state.draftTurn || 0] || [];
    if (!currentSet.includes(powerCardId)) return;
    if (player.powerCards.length > (this.state.draftTurn || 0)) return; // Already selected for this turn

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      powerCards: [...player.powerCards, powerCardId]
    };

    const allSelected = Object.values(updatedPlayers).every(p => p.powerCards.length > this.state.draftTurn!);
    
    if (allSelected) {
      if (this.state.draftTurn === 2) {
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'playing',
          updatedAt: Date.now()
        };
      } else {
        this.state = {
          ...this.state,
          players: updatedPlayers,
          draftTurn: (this.state.draftTurn || 0) + 1,
          updatedAt: Date.now()
        };
      }
    } else {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        updatedAt: Date.now()
      };
    }
    this.broadcastState();
  }

  private handlePlayPowerCard(uid: string, powerCardId: number | null) {
    if (!this.state || !this.state.players[uid]) return;
    if (powerCardId !== null && !this.state.players[uid].powerCards.includes(powerCardId)) return;
    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...updatedPlayers[uid],
      currentPowerCard: powerCardId
    };
    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private handleCheatPower(uid: string, powerCardId: number) {
    if (!this.state || !this.state.players[uid]) return;
    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...updatedPlayers[uid],
      currentPowerCard: powerCardId
    };
    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private handleCheatTrimDeck(removeCount: number) {
    if (!this.state || !this.isHost) return;
    const ok = ['playing', 'powering', 'results'].includes(this.state.status);
    if (!ok) return;
    const n = Math.max(0, Math.floor(removeCount));
    const deck = [...this.state.deck];
    const take = Math.min(n, deck.length);
    if (take === 0) return;
    deck.splice(0, take);
    const famineActive = deck.length === 0 ? true : Boolean(this.state.famineActive);
    this.state = {
      ...this.state,
      deck,
      famineActive,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private handleCheatDiscardHandCard(uid: string, cardId: string) {
    if (!this.state || !this.isHost || !this.state.players[uid]) return;
    if (!['playing', 'powering', 'results'].includes(this.state.status)) return;
    const p = this.state.players[uid];
    const ix = p.hand.indexOf(cardId);
    if (ix < 0) return;
    const hand = [...p.hand];
    hand.splice(ix, 1);
    const updatedPlayers = {
      ...this.state.players,
      [uid]: { ...p, hand },
    };
    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  // Exposed for optimistic UI updates on draft select
  public triggerDraftSelect(uid: string, powerCardId: number, turn: number) {
    this.handleSelectDraft(uid, powerCardId, turn);
  }

  private getWheelOutcome(offset: number): string {
    const slices = [
      { label: 'LOSE_ROUND', weight: 3 },
      { label: 'WIN_ROUND', weight: 3 },
      { label: 'WIN_2_CARDS', weight: 5 },
      { label: 'DOUBLE_JOKER', weight: 1 },
      { label: 'JACKPOT', weight: 2 },
      { label: 'POWER_CARD', weight: 1 },
      { label: 'LOSE_2_CARDS', weight: 5 }
    ];
    const total = slices.reduce((acc, s) => acc + s.weight, 0);
    const target = Math.max(0, Math.min(0.999999, offset)) * total;
    let running = 0;
    for (const slice of slices) {
      running += slice.weight;
      if (target <= running) return slice.label;
    }
    return 'LOSE_ROUND';
  }

  private createPendingPowerDecisions(
    players: Record<string, PlayerData>,
    draftAppearances: number[]
  ): Record<string, PendingPowerDecision | null> {
    const decisions: Record<string, PendingPowerDecision | null> = {};
    const uids = Object.keys(players);
    const p1 = uids[0];
    const p2 = uids[1];
    const p1Power = players[p1].currentPowerCard;
    const p2Power = players[p2].currentPowerCard;

    // Tower always resolves first and may prevent decisions.
    const blocked: Record<string, boolean> = { [p1]: false, [p2]: false };
    if (p1Power === 16 && p2Power === 16) {
      const p1WinsFlip = Math.random() > 0.5;
      blocked[p1WinsFlip ? p2 : p1] = true;
    } else if (p1Power === 16 && p2Power !== null) {
      blocked[p2] = true;
    } else if (p2Power === 16 && p1Power !== null) {
      blocked[p1] = true;
    }

    for (const uid of uids) {
      const oppUid = uids.find(id => id !== uid)!;
      const power = players[uid].currentPowerCard;
      if (blocked[uid] || power === null) {
        decisions[uid] = null;
        continue;
      }

      if (power === 1) {
        const opponentHasJoker = players[oppUid].hand.some(c => c.startsWith('Joker'));
        decisions[uid] = {
          powerCardId: 1,
          options: ['STEAL_JOKER', 'FROGIFY'],
          disabledReasons: {
            STEAL_JOKER: opponentHasJoker ? '' : 'Opponent has no Joker to steal.',
            FROGIFY: ''
          },
          selectedOption: null
        };
      } else if (power === 10) {
        decisions[uid] = {
          powerCardId: 10,
          options: ['SPIN_WHEEL'],
          selectedOption: null
        };
      } else if (power === 2) {
        const oppUsesPower = players[oppUid].currentPowerCard !== null;
        const realPowerId = players[oppUid].currentPowerCard;
        let priestessPowerCandidates: number[] | null = null;
        let priestessPeekStashPowerId: number | null | undefined = undefined;
        let priestessPeekStashEmpty = false;
        if (oppUsesPower && realPowerId !== null) {
          const draftPool = [...new Set(draftAppearances)];
          const pool = [...new Set([...draftPool, realPowerId])];
          const others = pool.filter(id => id !== realPowerId);
          let d1: number;
          let d2: number;
          if (others.length >= 2) {
            const shuffled = shuffle([...others]);
            d1 = shuffled[0];
            d2 = shuffled[1];
          } else if (others.length === 1) {
            d1 = others[0];
            d2 = others[0];
          } else {
            d1 = realPowerId;
            d2 = realPowerId;
          }
          priestessPowerCandidates = shuffle([realPowerId, d1, d2]);
        } else {
          const stashPool = [...new Set(players[oppUid].powerCards)].filter(pid => pid !== players[oppUid].currentPowerCard);
          if (stashPool.length > 0) {
            priestessPeekStashPowerId = stashPool[Math.floor(Math.random() * stashPool.length)];
          } else {
            priestessPeekStashPowerId = null;
            priestessPeekStashEmpty = true;
          }
        }
        decisions[uid] = {
          powerCardId: 2,
          options: ['PRIESTESS_RESOLVE'],
          selectedOption: null,
          priestessOpponentUsesPower: oppUsesPower,
          priestessOpponentName: players[oppUid].name,
          priestessSwapToCard: null,
          priestessPowerCandidates,
          priestessPeekStashPowerId: priestessPeekStashPowerId ?? null,
          priestessPeekStashEmpty
        };
      } else if (power === 15) {
        const opponentUsedPower = players[oppUid].currentPowerCard !== null && !blocked[oppUid];
        const spareCards = players[uid].hand.filter(card => card !== players[uid].currentMove).length;
        const canPay = spareCards >= 2;
        if (!canPay) {
          decisions[uid] = null;
          continue;
        }
        decisions[uid] = {
          powerCardId: 15,
          options: ['DEVIL_KING', 'DEVIL_BLOCK', 'DEVIL_RANDOMIZE'],
          disabledReasons: {
            DEVIL_KING: canPay ? '' : 'Need 2 spare cards to make a deal.',
            DEVIL_BLOCK: !canPay ? 'Need 2 spare cards to make a deal.' : (opponentUsedPower ? '' : 'Opponent did not use a power this round.'),
            DEVIL_RANDOMIZE: canPay ? '' : 'Need 2 spare cards to make a deal.'
          },
          selectedOption: null
        };
      } else {
        decisions[uid] = null;
      }
    }

    return decisions;
  }

  private handleSubmitPowerDecision(uid: string, option: string, wheelOffset?: number, priestessSwapToCard?: string | null) {
    if (!this.state || this.state.status !== 'powering') return;
    const pending = { ...(this.state.pendingPowerDecisions || {}) };
    const current = pending[uid];
    if (!current || current.selectedOption !== null) return;
    if (!current.options.includes(option) && option !== 'SPIN_WHEEL') return;
    if (current.disabledReasons?.[option]) return;
    if (current.powerCardId === 2 && option !== 'PRIESTESS_RESOLVE') return;

    current.selectedOption = option;
    if (current.powerCardId === 2) {
      const player = this.state.players[uid];
      const locked = this.state.engageMoves?.[uid] ?? player.currentMove!;
      let swapAccepted: string | null = null;
      if (
        priestessSwapToCard &&
        priestessSwapToCard !== locked &&
        player.hand.includes(priestessSwapToCard)
      ) {
        swapAccepted = priestessSwapToCard;
      }
      current.priestessSwapToCard = swapAccepted;
    }
    if (current.powerCardId === 10) {
      const offset = typeof wheelOffset === 'number' ? wheelOffset : Math.random();
      current.wheelOffset = offset;
      current.wheelResult = this.getWheelOutcome(offset);
    }
    pending[uid] = current;

    const allResolved = Object.values(pending).every(d => !d || d.selectedOption !== null);
    if (!allResolved) {
      this.state = {
        ...this.state,
        pendingPowerDecisions: pending,
        updatedAt: Date.now()
      };
      this.broadcastState();
      return;
    }

    const hasWheel = Object.values(pending).some(d => d?.powerCardId === 10 && d.selectedOption === 'SPIN_WHEEL');
    this.state = {
      ...this.state,
      pendingPowerDecisions: pending,
      updatedAt: Date.now()
    };
    this.broadcastState();

    if (this.powerResolutionTimer) {
      clearTimeout(this.powerResolutionTimer);
      this.powerResolutionTimer = null;
    }

    const finalize = () => {
      if (!this.state || this.state.status !== 'powering') return;
      this.state = {
        ...this.state,
        status: 'results',
        lastOutcome: this.calculateOutcome(this.state, this.state.players),
        updatedAt: Date.now()
      };
      this.broadcastState();
      this.powerResolutionTimer = null;
    };

    if (hasWheel) {
      this.powerResolutionTimer = setTimeout(finalize, 2600);
    } else {
      finalize();
    }
  }

  private processSpinDesperation(uid: string, offset: number) {
    if (!this.state || !this.state.players[uid]) return;
    
    const player = this.state.players[uid];
    if (!desperationSpinAllowed(this.state, uid, player)) return;
    
    // Pick the result based on offset
    // Offset 0-1 matches 0-100% of the wheel
    const totalWeight = DESPERATION_SLICES.reduce((acc, s) => acc + s.weight, 0);
    let currentWeight = 0;
    let result = DESPERATION_SLICES[0].label;
    
    const targetWeight = offset * totalWeight;
    for (const slice of DESPERATION_SLICES) {
      currentWeight += slice.weight;
      if (targetWeight <= currentWeight) {
        result = slice.label;
        break;
      }
    }

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      desperationResult: result,
      desperationSpinning: true,
      desperationOffset: offset
    };

    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private handleResolveDesperation(uid: string) {
    if (!this.state || !this.state.players[uid]) return;
    
    const player = this.state.players[uid];
    if (!desperationSpinAllowed(this.state, uid, player)) return;
    const result = player.desperationResult;
    const updatedPlayers = { ...this.state.players };
    const newDeck = [...this.state.deck];
    let newWinner = this.state.winner;

    const advanceDesperationTier = (t: number) => (t < 0 ? 1 : t + 1);

    if (result === 'GAME OVER') {
      newWinner = Object.keys(this.state.players).find(id => id !== uid)!;
      updatedPlayers[uid] = {
        ...player,
        desperationTier: advanceDesperationTier(player.desperationTier),
        desperationSpinning: false
      };
    } else if (result?.startsWith('Gain')) {
      const numStr = result.split(' ')[1];
      const count = parseInt(numStr);
      const cards = newDeck.splice(0, count);
      updatedPlayers[uid] = {
        ...player,
        desperationTier: advanceDesperationTier(player.desperationTier),
        hand: [...player.hand, ...cards],
        desperationSpinning: false,
        desperationResult: null
      };
    } else {
      updatedPlayers[uid] = {
        ...player,
        desperationTier: advanceDesperationTier(player.desperationTier),
        desperationSpinning: false,
        // Keep desperationResult so it can be seen on Game Over screen
      };
    }

    this.state = {
      ...this.state,
      players: updatedPlayers,
      deck: newDeck,
      winner: newWinner,
      status: newWinner ? 'finished' : this.state.status,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private broadcastState() {
    if (this.state) {
      this.onStateChange?.(this.state);
      this.sendEvent({ type: 'STATE_UPDATE', state: this.state });
    }
  }

  private sendEvent(event: GameEvent) {
    if (this.connection && this.connection.open) {
      this.connection.send(event);
    }
  }

  private calculateOutcome(roomData: RoomData, players: Record<string, PlayerData>) {
    const uids = Object.keys(players);
    const p1Uid = this.myUid;
    const p2Uid = uids.find(id => id !== p1Uid)!;

    let targetSuit = roomData.targetSuit!;
    const engageLocks =
      roomData.engageMoves && roomData.engageMoves[p1Uid] && roomData.engageMoves[p2Uid]
        ? { ...roomData.engageMoves }
        : ({ [p1Uid]: players[p1Uid].currentMove!, [p2Uid]: players[p2Uid].currentMove! } as Record<string, string>);
    const initialCardsPlayed = { ...engageLocks };
    let c1 = players[p1Uid].currentMove!;
    let c2 = players[p2Uid].currentMove!;
    const committedPower1 = players[p1Uid].currentPowerCard;
    const committedPower2 = players[p2Uid].currentPowerCard;
    let power1 = committedPower1;
    let power2 = committedPower2;
    const pendingDecisions = roomData.pendingPowerDecisions || {};
    const p1Decision = pendingDecisions[p1Uid];
    const p2Decision = pendingDecisions[p2Uid];
    
    let winnerUid: string | 'draw' = 'draw';
    let coinFlip: string | undefined = undefined;
    const events: ResolutionEvent[] = [];
    const summonedCards: Record<string, string> = {};

    const gains: Record<string, { type: 'card' | 'power' | 'draw', id: string | number }[]> = {
      [p1Uid]: [],
      [p2Uid]: []
    };
    const blockedPowers: Record<string, boolean> = { [p1Uid]: false, [p2Uid]: false };

    // Phase 1: Pre-activation
    if ((power1 === 16 && power2 === 16) || ((power1 === 15 || power1 === 16) && (power2 === 15 || power2 === 16))) {
      const p1WinsFlip = Math.random() > 0.5;
      coinFlip = p1WinsFlip ? 'Host' : 'Opponent';
      events.push({ 
        type: 'COIN_FLIP', 
        message: `${coinFlip === 'Host' ? players[p1Uid].name : players[p2Uid].name} wins priority flip!` 
      });
    }

    const resolvePowerPre = (pUid: string, oUid: string, p: number | null, oPower: number | null) => {
      if (p === 16) { // Tower
        if (oPower !== null && oPower !== 16) {
          const destroyedName = MAJOR_ARCANA[oPower]?.name ?? `Power ${oPower}`;
          events.push({
            type: 'POWER_TRIGGER',
            uid: pUid,
            powerCardId: 16,
            message: `${players[pUid].name}'s Tower blocks ${players[oUid].name}'s power card.`,
          });
          events.push({
            type: 'POWER_DESTROYED',
            uid: oUid,
            powerCardId: oPower,
            message: `${players[oUid].name}'s ${destroyedName} is destroyed.`,
          });
          blockedPowers[oUid] = true;
          if (pUid === p1Uid) power2 = null;
          else power1 = null;
        }
      }
    };

    if (coinFlip === 'Opponent') {
      resolvePowerPre(p2Uid, p1Uid, power2, power1);
      resolvePowerPre(p1Uid, p2Uid, power1, power2);
    } else {
      resolvePowerPre(p1Uid, p2Uid, power1, power2);
      resolvePowerPre(p2Uid, p1Uid, power2, power1);
    }
    if (power1 === 16 && power2 === 16) {
      if (coinFlip === 'Host') blockedPowers[p2Uid] = true;
      else blockedPowers[p1Uid] = true;
    }

    const priestessFront: ResolutionEvent[] = [];
    const applyPriestessConsult = (
      uid: string,
      decision: PendingPowerDecision | null | undefined,
      isP1: boolean
    ) => {
      const playedPowerId = players[uid].currentPowerCard;
      if (playedPowerId !== 2 || blockedPowers[uid]) return;

      const locked = engageLocks[uid];
      const rawSwap =
        typeof decision?.priestessSwapToCard === 'string' && decision.priestessSwapToCard.trim() !== ''
          ? decision!.priestessSwapToCard
          : null;
      let finalCard = locked;
      if (
        rawSwap &&
        rawSwap !== locked &&
        players[uid].hand.includes(rawSwap)
      ) {
        finalCard = rawSwap;
      }
      const oppName = decision?.priestessOpponentName || 'Opponent';
      const oppUsed = Boolean(decision?.priestessOpponentUsesPower);

      if (!oppUsed) {
        if (decision?.priestessPeekStashEmpty) {
          priestessFront.push({
            type: 'POWER_TRIGGER',
            uid,
            powerCardId: 2,
            message: `${players[uid].name} (High Priestess): ${oppName} played no power card and has no spare power cards to reveal.`
          });
        } else if (typeof decision?.priestessPeekStashPowerId === 'number') {
          const peek = MAJOR_ARCANA[decision.priestessPeekStashPowerId];
          priestessFront.push({
            type: 'POWER_TRIGGER',
            uid,
            powerCardId: 2,
            message: `${players[uid].name} (High Priestess): glimpsed ${peek.name} among ${oppName}'s spare power cards.`
          });
        }
        return;
      }

      priestessFront.push({
        type: 'POWER_TRIGGER',
        uid,
        powerCardId: 2,
        message: `${players[uid].name} (High Priestess): ${oppName} played a power card${
          decision?.priestessPowerCandidates?.length === 3
            ? ' — three draft candidates are shown.'
            : '.'
        }`
      });
      if (finalCard !== locked) {
        priestessFront.push({
          type: 'CARD_SWAP',
          uid,
          cardId: finalCard,
          message: `${players[uid].name} swaps their played suit card before the flop.`
        });
      } else {
        priestessFront.push({
          type: 'POWER_TRIGGER',
          uid,
          powerCardId: 2,
          message: `${players[uid].name} keeps ${locked.replace('-', ' of ')} in play.`
        });
      }

      if (isP1) c1 = finalCard;
      else c2 = finalCard;
    };

    applyPriestessConsult(p1Uid, p1Decision, true);
    applyPriestessConsult(p2Uid, p2Decision, false);
    events.splice(0, 0, ...priestessFront);

    // Magician steal runs early; Fool / field powers run before Frogify so swaps apply first.
    const applyMagicianSteal = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 1 || blockedPowers[uid]) return;
      if (decision.selectedOption === 'STEAL_JOKER') {
        const oHand = players[oppUid].hand;
        const jokerStr = oHand.find(c => c.startsWith('Joker'));
        if (jokerStr) {
          events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 1, message: `${players[uid].name} casts Magician and steals a Joker!` });
          gains[uid].push({ type: 'card', id: jokerStr });
        }
      }
    };

    const applyMagicianFrog = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 1 || blockedPowers[uid]) return;
      if (decision.selectedOption === 'FROGIFY') {
        const targetCard = uid === p1Uid ? c2 : c1;
        const targetParsed = parseCard(targetCard);
        let frogged = 'Frogs-1';
        if (!targetParsed.isJoker && targetParsed.suit === 'Frogs') {
          const idx = VALUES.indexOf(targetParsed.value as any);
          const nextVal = VALUES[Math.min(idx + 1, VALUES.length - 1)];
          frogged = `Frogs-${nextVal}`;
        }
        if (uid === p1Uid) c2 = frogged;
        else c1 = frogged;
        events.push({
          type: 'TRANSFORM',
          uid: oppUid,
          cardId: frogged,
          powerCardId: 1,
          message: `${players[uid].name} casts Frogs and warps the opposing card to ${frogged.replace('-', ' of ')}!`,
        });
      }
    };

    const removeTwoRandomHandCards = (uid: string) => {
      const hand = players[uid].hand.filter(card => card !== players[uid].currentMove);
      const removed: string[] = [];
      for (let i = 0; i < 2 && hand.length > 0; i++) {
        const idx = Math.floor(Math.random() * hand.length);
        removed.push(hand.splice(idx, 1)[0]);
      }
      return removed;
    };

    const applyDevilDecision = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 15 || blockedPowers[uid]) return;
      const discarded = removeTwoRandomHandCards(uid);
      if (discarded.length < 2) return;
      gains[uid].push({ type: 'draw', id: -2 });
      if (decision.selectedOption === 'DEVIL_KING') {
        if (uid === p1Uid) {
          const pc = parseCard(c1);
          c1 = `${pc.suit}-K`;
        } else {
          const pc = parseCard(c2);
          c2 = `${pc.suit}-K`;
        }
        events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 15, message: `${players[uid].name} makes a Devil Deal: their card becomes a King!` });
      } else if (decision.selectedOption === 'DEVIL_BLOCK') {
        if (uid === p1Uid) {
          power2 = null;
          blockedPowers[p2Uid] = true;
        } else {
          power1 = null;
          blockedPowers[p1Uid] = true;
        }
        events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 15, message: `${players[uid].name} makes a Devil Deal and blocks the opposing power!` });
      } else if (decision.selectedOption === 'DEVIL_RANDOMIZE') {
        const s1 = SUITS[Math.floor(Math.random() * SUITS.length)];
        const s2 = SUITS[Math.floor(Math.random() * SUITS.length)];
        const pc1 = parseCard(c1);
        const pc2 = parseCard(c2);
        c1 = pc1.isJoker ? c1 : `${s1}-${pc1.value}`;
        c2 = pc2.isJoker ? c2 : `${s2}-${pc2.value}`;
        events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 15, message: `${players[uid].name} makes a Devil Deal and randomizes both suits!` });
      }
    };

    applyMagicianSteal(p1Uid, p2Uid, p1Decision);
    applyMagicianSteal(p2Uid, p1Uid, p2Decision);
    applyDevilDecision(p1Uid, p2Uid, p1Decision);
    applyDevilDecision(p2Uid, p1Uid, p2Decision);

    // Phase 2: Before Resolution
    const applyBefore = (pUid: string, oUid: string, p: number | null) => {
      if (blockedPowers[pUid]) return;
      let pc1 = parseCard(c1);
      let pc2 = parseCard(c2);
      
      if (p === 17) { // Star
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 17, message: `${players[pUid].name}'s Star transforms the field!` });
        targetSuit = 'Stars';
        events.push({ type: 'TARGET_CHANGE', suit: 'Stars', message: `Target suit is now Stars!` });
      }

      if (p === 0) { // Fool
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 0, message: `${players[pUid].name}'s Fool swaps the cards!` });
        const temp = c1; c1 = c2; c2 = temp;
        events.push({ type: 'CARD_SWAP', message: `Cards have been swapped!` });
      }
      if (p === 6) { // Lovers
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 6, message: `${players[pUid].name}'s Lovers change target suit to Hearts!` });
        targetSuit = 'Hearts';
        events.push({ type: 'TARGET_CHANGE', suit: 'Hearts', message: `Target suit is now Hearts!` });
      }
      if (p === 4) { // Emperor
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 4, message: `${players[pUid].name}'s Emperor empowers the card!` });
        if (pUid === p1Uid) {
          c1 = `${targetSuit}-${VALUES[Math.min(VALUES.indexOf(pc1.value as any) + 2, VALUES.length - 1)]}`;
          events.push({ type: 'CARD_EMPOWER', uid: p1Uid, cardId: c1, message: `${players[p1Uid].name}'s card upgraded to target suit!` });
        } else {
          c2 = `${targetSuit}-${VALUES[Math.min(VALUES.indexOf(pc2.value as any) + 2, VALUES.length - 1)]}`;
          events.push({ type: 'CARD_EMPOWER', uid: p2Uid, cardId: c2, message: `${players[p2Uid].name}'s card upgraded to target suit!` });
        }
      }
      if (p === 8) { // Strength
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 8, message: `${players[pUid].name}'s Strength boosts the card!` });
        if (pUid === p1Uid) {
          const pc = parseCard(c1);
          c1 = pc.isJoker ? c1 : `${pc.suit}-${VALUES[Math.min(VALUES.indexOf(pc.value as any) + 4, VALUES.length - 1)]}`;
          events.push({ type: 'CARD_EMPOWER', uid: p1Uid, cardId: c1, message: `${players[p1Uid].name}'s card value increased!` });
        } else {
          const pc = parseCard(c2);
          c2 = pc.isJoker ? c2 : `${pc.suit}-${VALUES[Math.min(VALUES.indexOf(pc.value as any) + 4, VALUES.length - 1)]}`;
          events.push({ type: 'CARD_EMPOWER', uid: p2Uid, cardId: c2, message: `${players[p2Uid].name}'s card value increased!` });
        }
      }
      if (p === 11) { // Justice
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 11, message: `${players[pUid].name}'s Justice summons an ally!` });
        const summoned = `${targetSuit}-${VALUES[Math.floor(Math.random() * VALUES.length)]}`;
        summonedCards[pUid] = summoned;
        events.push({ type: 'SUMMON_CARD', uid: pUid, cardId: summoned, message: `Justice summoned ${summoned.replace('-', ' of ')}!` });
      }
    };

    applyBefore(p1Uid, p2Uid, power1);
    applyBefore(p2Uid, p1Uid, power2);

    applyMagicianFrog(p1Uid, p2Uid, p1Decision);
    applyMagicianFrog(p2Uid, p1Uid, p2Decision);

    // TRANSFORMATION: If target suit is Stars, all normal cards transform to Stars
    if (targetSuit === 'Stars') {
      const pc1 = parseCard(c1);
      const pc2 = parseCard(c2);
      if (!pc1.isJoker && pc1.suit !== 'Stars') {
        c1 = `Stars-${pc1.value}`;
        events.push({
          type: 'TRANSFORM',
          uid: p1Uid,
          cardId: c1,
          powerCardId: 17,
          message: `${players[p1Uid].name}'s card became a Star!`,
        });
      }
      if (!pc2.isJoker && pc2.suit !== 'Stars') {
        c2 = `Stars-${pc2.value}`;
        events.push({
          type: 'TRANSFORM',
          uid: p2Uid,
          cardId: c2,
          powerCardId: 17,
          message: `${players[p2Uid].name}'s card became a Star!`,
        });
      }
    }

    const hermitSwap = (pUid: string, oCard: string) => {
      const p = players[pUid];
      const pool = p.hand.filter(card => card !== p.currentMove);

      const pickPreferNonJoker = (cands: string[]): string | null => {
        if (cands.length === 0) return null;
        const nonJoker = cands.find(c => !parseCard(c).isJoker);
        return nonJoker ?? cands[0];
      };

      const winCandidates = pool.filter(
        card => evaluateTrickClash(card, oCard, targetSuit) === 'p1'
      );
      const winPick = pickPreferNonJoker(winCandidates);
      if (winPick) {
        return { card: winPick, reason: 'win' as const };
      }

      const drawCandidates = pool.filter(
        card => evaluateTrickClash(card, oCard, targetSuit) === 'draw'
      );
      const drawPick = pickPreferNonJoker(drawCandidates);
      if (drawPick) {
        return { card: drawPick, reason: 'draw' as const };
      }
      return { card: null, reason: 'none' as const };
    };

    if (power1 === 9) {
        if (blockedPowers[p1Uid]) {
          events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 9, message: `${players[p1Uid].name}'s Hermit was blocked by Tower.` });
        } else {
          const better = hermitSwap(p1Uid, c2);
          if (better.card) {
            c1 = better.card;
            events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 9, message: `${players[p1Uid].name}'s Hermit found a ${better.reason === 'win' ? 'winning' : 'drawing'} line.` });
            events.push({ type: 'CARD_SWAP', uid: p1Uid, cardId: c1, message: `${players[p1Uid].name} swapped to ${c1.replace('-', ' of ')}.` });
          } else {
            events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 9, message: `${players[p1Uid].name}'s Hermit could not find a winning or drawing card.` });
          }
        }
    }
    if (power2 === 9) {
        if (blockedPowers[p2Uid]) {
          events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 9, message: `${players[p2Uid].name}'s Hermit was blocked by Tower.` });
        } else {
          const better = hermitSwap(p2Uid, c1);
          if (better.card) {
            c2 = better.card;
            events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 9, message: `${players[p2Uid].name}'s Hermit found a ${better.reason === 'win' ? 'winning' : 'drawing'} line.` });
            events.push({ type: 'CARD_SWAP', uid: p2Uid, cardId: c2, message: `${players[p2Uid].name} swapped to ${c2.replace('-', ' of ')}.` });
          } else {
            events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 9, message: `${players[p2Uid].name}'s Hermit could not find a winning or drawing card.` });
          }
        }
    }

    // Phase 3: Resolution
    if (power1 === 14 || power2 === 14) {
        winnerUid = 'draw';
        events.push({
          type: 'POWER_TRIGGER',
          powerCardId: 14,
          message: 'Temperance forced transparency and balance.',
        });
    } else {
        const res = evaluateTrickClash(c1, c2, targetSuit);
        const s1 = summonedCards[p1Uid];
        const s2 = summonedCards[p2Uid];

        if (s1 && s2) {
          const r1 = evaluateTrickClash(s1, s2, targetSuit);
          const rMain = res;
          if (rMain === 'p1' || r1 === 'p1') winnerUid = p1Uid;
          else if (rMain === 'p2' || r1 === 'p2') winnerUid = p2Uid;
          else winnerUid = 'draw';
        } else if (s1) {
          const resSummon = evaluateTrickClash(s1, c2, targetSuit);
          if (res === 'p1' || resSummon === 'p1') winnerUid = p1Uid;
          else if (res === 'p2' && resSummon === 'p2') winnerUid = p2Uid;
          else winnerUid = 'draw';
        } else if (s2) {
          const resSummon = evaluateTrickClash(s2, c1, targetSuit);
          if (res === 'p2' || resSummon === 'p2') winnerUid = p2Uid;
          else if (res === 'p1' && resSummon === 'p1') winnerUid = p1Uid;
          else winnerUid = 'draw';
        } else {
          winnerUid = res === 'p1' ? p1Uid : (res === 'p2' ? p2Uid : 'draw');
        }

        let wheelDjLock = false;

        type WheelEvt = { uid: string; res: string };
        const wheels: WheelEvt[] = [];
        if (power1 === 10 && !blockedPowers[p1Uid] && p1Decision?.wheelResult) wheels.push({ uid: p1Uid, res: p1Decision.wheelResult });
        if (power2 === 10 && !blockedPowers[p2Uid] && p2Decision?.wheelResult) wheels.push({ uid: p2Uid, res: p2Decision.wheelResult });

        if (wheels.length === 2) {
          let p1First: boolean;
          if (coinFlip === 'Host') {
            p1First = true;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p1Uid].name}'s Wheel resolves first (twin Wheels — initiative already ${coinFlip}).`
            });
          } else if (coinFlip === 'Opponent') {
            p1First = false;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p2Uid].name}'s Wheel resolves first (twin Wheels — initiative already ${coinFlip}).`
            });
          } else {
            p1First = Math.random() > 0.5;
            coinFlip = p1First ? 'Host' : 'Opponent';
            events.push({
              type: 'COIN_FLIP',
              message: `${p1First ? players[p1Uid].name : players[p2Uid].name} wins Wheel order (${p1First ? players[p1Uid].name : players[p2Uid].name}'s Wheel resolves first, then ${p1First ? players[p2Uid].name : players[p1Uid].name}).`
            });
          }

          wheels.sort((a, b) => {
            const aP1 = a.uid === p1Uid;
            const bP1 = b.uid === p1Uid;
            if (aP1 === bP1) return 0;
            if (p1First) return aP1 ? -1 : 1;
            return bP1 ? -1 : 1;
          });
        }

        const applyWheelStep = (uid: string, outcomeLabel: string) => {
          if (wheelDjLock && (outcomeLabel === 'LOSE_ROUND' || outcomeLabel === 'WIN_ROUND')) {
            events.push({
              type: 'POWER_TRIGGER',
              uid,
              powerCardId: 10,
              message: `${players[uid].name}'s Wheel (${outcomeLabel.replaceAll('_', ' ')}) is swallowed by twin Jokers on the table.`
            });
            return;
          }
          if (outcomeLabel === 'LOSE_ROUND') {
            winnerUid = uid === p1Uid ? p2Uid : p1Uid;
          } else if (outcomeLabel === 'WIN_ROUND') {
            if (!wheelDjLock) winnerUid = uid;
          } else if (outcomeLabel === 'WIN_2_CARDS') {
            gains[uid].push({ type: 'draw', id: 2 });
            gains[uid].push({ type: 'draw', id: 2 });
          } else if (outcomeLabel === 'DOUBLE_JOKER') {
            c1 = 'Joker-1';
            c2 = 'Joker-2';
            winnerUid = 'draw';
            wheelDjLock = true;
          } else if (outcomeLabel === 'JACKPOT') {
            if (uid === p1Uid) c1 = 'Coins-10';
            else c2 = 'Coins-10';
          } else if (outcomeLabel === 'POWER_CARD') {
            gains[uid].push({ type: 'draw', id: 'random-power' });
          } else if (outcomeLabel === 'LOSE_2_CARDS') {
            gains[uid].push({ type: 'draw', id: -2 });
          }
          events.push({
            type: 'POWER_TRIGGER',
            uid,
            powerCardId: 10,
            message: `${players[uid].name}'s Wheel of Fortune outcome: ${outcomeLabel.replaceAll('_', ' ')}`
          });
        };

        for (const w of wheels) {
          applyWheelStep(w.uid, w.res);
        }

        if (power1 === 13 && power2 === 13 && !blockedPowers[p1Uid] && !blockedPowers[p2Uid]) {
          if (coinFlip === 'Host') {
            winnerUid = p1Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p1Uid].name} wins the duel of Death (initiative ${coinFlip}).`
            });
          } else if (coinFlip === 'Opponent') {
            winnerUid = p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p2Uid].name} wins the duel of Death (initiative ${coinFlip}).`
            });
          } else {
            const hostWins = Math.random() > 0.5;
            coinFlip = hostWins ? 'Host' : 'Opponent';
            winnerUid = hostWins ? p1Uid : p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[winnerUid].name} wins the duel of Death (fresh flip — ${coinFlip}).`
            });
          }
          events.push({
            type: 'POWER_TRIGGER',
            uid: winnerUid,
            powerCardId: 13,
            message: `${players[winnerUid].name}'s Death wins the duel.`
          });
        } else {
          if (power1 === 13 && !blockedPowers[p1Uid]) {
            winnerUid = p1Uid;
            events.push({
              type: 'POWER_TRIGGER',
              uid: p1Uid,
              powerCardId: 13,
              message: `${players[p1Uid].name}'s Death claims the round.`
            });
          }
          if (power2 === 13 && !blockedPowers[p2Uid]) {
            winnerUid = p2Uid;
            events.push({
              type: 'POWER_TRIGGER',
              uid: p2Uid,
              powerCardId: 13,
              message: `${players[p2Uid].name}'s Death claims the round.`
            });
          }
        }

        if (power1 === 20 || power2 === 20) {
          if (!(power1 === 20 && power2 === 20)) {
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: 20,
              message: `Judgement has inverted the fate!`,
            });
            if (winnerUid === p1Uid) winnerUid = p2Uid;
            else if (winnerUid === p2Uid) winnerUid = p1Uid;
          }
        }

        if (power1 === 7 && winnerUid === p2Uid) {
          const played = c1;
          const pc = parseCard(played);
          const newVal = VALUES[Math.min(VALUES.indexOf(pc.value as any) + 1, VALUES.length - 1)];
          gains[p1Uid].push({ type: 'card', id: `${pc.suit}-${newVal}` });
          events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 7, message: `${players[p1Uid].name}'s Chariot saves the card!` });
        }
        if (power2 === 7 && winnerUid === p1Uid) {
          const played = c2;
          const pc = parseCard(played);
          const newVal = VALUES[Math.min(VALUES.indexOf(pc.value as any) + 1, VALUES.length - 1)];
          gains[p2Uid].push({ type: 'card', id: `${pc.suit}-${newVal}` });
          events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 7, message: `${players[p2Uid].name}'s Chariot saves the card!` });
        }

        const bothHanged =
          committedPower1 === 12 &&
          committedPower2 === 12 &&
          !blockedPowers[p1Uid] &&
          !blockedPowers[p2Uid];

        if (bothHanged) {
          if (coinFlip === 'Host') {
            winnerUid = p1Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p1Uid].name} wins the twin Hanged Man tie (initiative ${coinFlip}).`,
            });
          } else if (coinFlip === 'Opponent') {
            winnerUid = p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p2Uid].name} wins the twin Hanged Man tie (initiative ${coinFlip}).`,
            });
          } else {
            const hostWins = Math.random() > 0.5;
            coinFlip = hostWins ? 'Host' : 'Opponent';
            winnerUid = hostWins ? p1Uid : p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[winnerUid].name} wins the twin Hanged Man tie (fresh flip — ${coinFlip}).`,
            });
          }
          events.push({
            type: 'POWER_TRIGGER',
            powerCardId: 12,
            message: `${players[p1Uid].name} and ${players[p2Uid].name} both played The Hanged Man.`,
          });
        } else {
          if (power1 === 12 && !blockedPowers[p1Uid]) {
            winnerUid = p2Uid;
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: 12,
              message: `${players[p1Uid].name} forfeits via The Hanged Man.`,
            });
          }
          if (power2 === 12 && !blockedPowers[p2Uid]) {
            winnerUid = p1Uid;
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: 12,
              message: `${players[p2Uid].name} forfeits via The Hanged Man.`,
            });
          }
        }
    }

    // Hierophant 5
    if (power1 === 5) {
      events.push({ type: 'INTEL_REVEAL', uid: p1Uid, message: `${players[p1Uid].name} used The Hierophant to peek into ${players[p2Uid].name}'s hand!` });
    }
    if (power2 === 5) {
      events.push({ type: 'INTEL_REVEAL', uid: p2Uid, message: `${players[p2Uid].name} used The Hierophant to peek into ${players[p1Uid].name}'s hand!` });
    }
    let finalMessage = "";
    if (winnerUid === 'draw') {
       if (power1 === 14 || power2 === 14) finalMessage = "Temperance has balanced the scale of fate.";
       else finalMessage = "A perfect deadlock. Zero sum.";
    } else {
       const wName = players[winnerUid].name;

       const hanged1 = committedPower1 === 12 && !blockedPowers[p1Uid];
       const hanged2 = committedPower2 === 12 && !blockedPowers[p2Uid];
       if (hanged1 || hanged2) finalMessage = `${wName} takes the round — The Hanged Man.`;
       else if (power1 === 20 || power2 === 20) finalMessage = `Judgement names ${wName} as the survivor.`;
       else {
          const winnerCardStr = winnerUid === p1Uid ? c1 : c2;
          const loserCardStr = winnerUid === p1Uid ? c2 : c1;
          finalMessage = `${wName} wins — ${explainPlainClash(winnerCardStr, loserCardStr, targetSuit)}`;
       }
    }

    // Phase 4: Post-Resolution Gains Determination
    if (winnerUid !== 'draw' && winnerUid) {
      if (roomData.famineActive) {
        const loserUid = winnerUid === p1Uid ? p2Uid : p1Uid;
        gains[loserUid].push({ type: 'draw', id: -1 });
        events.push({
          type: 'POWER_TRIGGER',
          uid: loserUid,
          message: `${players[loserUid].name} loses 1 random card (Famine rule).`,
        });
      } else {
        gains[winnerUid].push({ type: 'draw', id: 'standard' });
      }
    }

    if (power1 === 3) {
      events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 3, message: `${players[p1Uid].name}'s Empress collects both suit cards!` });
      gains[p1Uid].push({ type: 'card', id: c1 });
      gains[p1Uid].push({ type: 'card', id: c2 });
    }
    if (power2 === 3) {
      events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 3, message: `${players[p2Uid].name}'s Empress collects both suit cards!` });
      gains[p2Uid].push({ type: 'card', id: c1 });
      gains[p2Uid].push({ type: 'card', id: c2 });
    }
    if (committedPower1 === 12 && !blockedPowers[p1Uid]) gains[p1Uid].push({ type: 'draw', id: 3 });
    if (committedPower2 === 12 && !blockedPowers[p2Uid]) gains[p2Uid].push({ type: 'draw', id: 3 });
    if (power1 === 2 && winnerUid === p2Uid) gains[p1Uid].push({ type: 'draw', id: 1 });
    if (power2 === 2 && winnerUid === p1Uid) gains[p2Uid].push({ type: 'draw', id: 1 });
    if (power1 === 19) gains[p1Uid].push({ type: 'card', id: c1 }); // Copy own card
    if (power2 === 19) gains[p2Uid].push({ type: 'card', id: c2 }); // Copy own card
    if (power1 === 18) {
      for (let i = 0; i < 2; i++) {
        const val = VALUES[Math.floor(Math.random() * VALUES.length)];
        gains[p1Uid].push({ type: 'card', id: `Moons-${val}` });
      }
    }
    if (power2 === 18) {
      for (let i = 0; i < 2; i++) {
        const val = VALUES[Math.floor(Math.random() * VALUES.length)];
        gains[p2Uid].push({ type: 'card', id: `Moons-${val}` });
      }
    }
    if (power1 === 21) {
      gains[p1Uid].push({ type: 'draw', id: 'random-power' });
      gains[p1Uid].push({ type: 'draw', id: 'new-card' });
    }
    if (power2 === 21) {
      gains[p2Uid].push({ type: 'draw', id: 'random-power' });
      gains[p2Uid].push({ type: 'draw', id: 'new-card' });
    }

    // Precompute famine spillover for the results log: if draw requests exceed deck, mark those gains as famine-bone draws.
    const hostUid = roomData.hostUid;
    const guestUid = hostUid === p1Uid ? p2Uid : p1Uid;
    const drawBudget: Record<string, number> = { [p1Uid]: 0, [p2Uid]: 0 };
    [p1Uid, p2Uid].forEach((uid) => {
      for (const g of gains[uid]) {
        if (g.type !== 'draw') continue;
        if (g.id === 'standard') drawBudget[uid] += 1;
        else if (typeof g.id === 'number' && g.id > 0) drawBudget[uid] += g.id;
      }
    });
    let projectedDeck = roomData.deck.length;
    const projectedFamineBones: Record<string, number> = { [p1Uid]: 0, [p2Uid]: 0 };
    const order = [hostUid, guestUid];
    while ((drawBudget[p1Uid] ?? 0) > 0 || (drawBudget[p2Uid] ?? 0) > 0) {
      let moved = false;
      for (const uid of order) {
        if ((drawBudget[uid] ?? 0) <= 0) continue;
        drawBudget[uid] -= 1;
        if (projectedDeck > 0) projectedDeck -= 1;
        else projectedFamineBones[uid] += 1;
        moved = true;
        break;
      }
      if (!moved) break;
    }
    const totalProjectedBones = projectedFamineBones[p1Uid] + projectedFamineBones[p2Uid];
    if (totalProjectedBones > 0) {
      events.push({ type: 'POWER_TRIGGER', message: 'Famine has begun.' });
      [p1Uid, p2Uid].forEach((uid) => {
        const n = projectedFamineBones[uid];
        if (n <= 0) return;
        events.push({
          type: 'POWER_TRIGGER',
          uid,
          message: `${players[uid].name} got ${n} bone${n === 1 ? '' : 's'} to balance hands.`,
        });
        for (let i = 0; i < n; i++) gains[uid].push({ type: 'draw', id: 'famine-bone' });
      });
    }

    return {
      targetSuit,
      winnerUid,
      message: finalMessage,
      cardsPlayed: { [p1Uid]: c1, [p2Uid]: c2 },
      initialCardsPlayed,
      powerCardsPlayed: {
        [p1Uid]: committedPower1 !== null ? MAJOR_ARCANA[committedPower1].name : 'None',
        [p2Uid]: committedPower2 !== null ? MAJOR_ARCANA[committedPower2].name : 'None',
      },
      powerCardIdsPlayed: { [p1Uid]: committedPower1, [p2Uid]: committedPower2 },
      powerCardTowerBlocked: { [p1Uid]: blockedPowers[p1Uid], [p2Uid]: blockedPowers[p2Uid] },
      coinFlip,
      events,
      summonedCards,
      gains
    };
  }

  private applyRoundResults(roomData: RoomData, players: Record<string, PlayerData>): RoomData {
    const outcome = roomData.lastOutcome!;
    const uids = Object.keys(players);
    const updatedPlayers = { ...players };
    const p1Uid = this.myUid;
    const p2Uid = uids.find(id => id !== p1Uid)!;
    const newDeck = [...roomData.deck];
    const powerDeck = [...roomData.powerDeck];
    
    // Reset status and cards
    uids.forEach(uid => {
      const p = updatedPlayers[uid];
      const initialCard = outcome.initialCardsPlayed?.[uid] || outcome.cardsPlayed[uid];
      const cardIdx = p.hand.indexOf(initialCard);
      if (cardIdx !== -1) {
        p.hand.splice(cardIdx, 1);
      }
      
      const usedPower = outcome.powerCardIdsPlayed[uid];
      if (usedPower !== null) {
        const pIdx = p.powerCards.indexOf(usedPower);
        if (pIdx !== -1) p.powerCards.splice(pIdx, 1);
      }

      p.currentMove = null;
      p.currentPowerCard = null;
      p.confirmed = false;
      p.readyForNextRound = false;
      p.priestessVisionUsed = false;
      p.secretIntel = null;
    });

    // Vision power (Hierophant)
    const setVisionIntel = (pUid: string, oUid: string) => {
      if (outcome.powerCardTowerBlocked?.[pUid]) return;
      const pPower = outcome.powerCardIdsPlayed[pUid];
      if (pPower === 5) { // 5: Hierophant
        updatedPlayers[pUid].secretIntel = {
          type: 'Hierophant',
          cards: [...updatedPlayers[oUid].hand],
          powerCards: [...updatedPlayers[oUid].powerCards]
        };
      }
    };
    setVisionIntel(p1Uid, p2Uid);
    setVisionIntel(p2Uid, p1Uid);

    const winnerUid = outcome.winnerUid;
    const temperanceActive = Object.values(outcome.powerCardIdsPlayed).includes(14);
    
    // NOTE: Power-card post-round gains are authored in `calculateOutcome(...).gains`
    // and applied below in the generic gains pass. Keep this section side-effect free
    // to avoid duplicate grants (e.g. Chariot, Empress, Sun).

    const hostUid = roomData.hostUid;
    const guestUid = uids.find(id => id !== hostUid)!;

    /** Deck pulls from numbered draws + winner “standard”; host and guest alternate so neither eats the deck first. */
    const deckPullBudget: Record<string, number> = {};
    uids.forEach((uid) => {
      deckPullBudget[uid] = 0;
    });
    const famineBoneBudget: Record<string, number> = {};
    uids.forEach((uid) => {
      famineBoneBudget[uid] = 0;
    });
    const boneCursorByUid: Record<string, number> = {};
    uids.forEach((uid) => {
      boneCursorByUid[uid] = 0;
    });
    const nextBoneCard = (uid: string) => {
      const rank = VALUES[boneCursorByUid[uid] % VALUES.length];
      boneCursorByUid[uid] += 1;
      return `Bones-${rank}`;
    };

    // Generic outcome gains application (deck pulls aggregated into deckPullBudget and resolved below).
    uids.forEach(uid => {
      const uidGains = outcome.gains?.[uid] || [];
      uidGains.forEach(gain => {
        if (gain.type === 'card' && typeof gain.id === 'string') {
          updatedPlayers[uid].hand.push(gain.id);
        } else if (gain.type === 'power' && typeof gain.id === 'number') {
          updatedPlayers[uid].powerCards.push(gain.id);
        } else if (gain.type === 'draw') {
          if (gain.id === 'random-power') {
            if (powerDeck.length > 0) updatedPlayers[uid].powerCards.push(powerDeck.splice(0, 1)[0]);
          } else if (gain.id === 'standard') {
            deckPullBudget[uid] += 1;
          } else if (gain.id === 'famine-bone') {
            famineBoneBudget[uid] += 1;
          } else if (gain.id === 'new-card') {
            const s = SUITS[Math.floor(Math.random() * SUITS.length)];
            const v = VALUES[Math.floor(Math.random() * VALUES.length)];
            updatedPlayers[uid].hand.push(`${s}-${v}`);
          } else if (typeof gain.id === 'number' && gain.id > 0) {
            deckPullBudget[uid] += gain.id;
          } else if (typeof gain.id === 'number' && gain.id < 0) {
            const removeCount = Math.abs(gain.id);
            for (let i = 0; i < removeCount; i++) {
              if (updatedPlayers[uid].hand.length === 0) break;
              const randomIndex = Math.floor(Math.random() * updatedPlayers[uid].hand.length);
              updatedPlayers[uid].hand.splice(randomIndex, 1);
            }
          }
        }
      });
    });

    const turnOrder = [hostUid, guestUid];
    while ((deckPullBudget[hostUid] ?? 0) > 0 || (deckPullBudget[guestUid] ?? 0) > 0) {
      let moved = false;
      for (const uid of turnOrder) {
        if ((deckPullBudget[uid] ?? 0) <= 0) continue;
        deckPullBudget[uid] -= 1;
        if (newDeck.length > 0) {
          updatedPlayers[uid].hand.push(newDeck.shift()!);
        }
        moved = true;
        break;
      }
      if (!moved) break;
    }
    uids.forEach((uid) => {
      const count = famineBoneBudget[uid] ?? 0;
      for (let i = 0; i < count; i++) {
        updatedPlayers[uid].hand.push(nextBoneCard(uid));
      }
    });

    const availableSuits = [...(roomData.availableSuits || SUITS)];
    uids.forEach(uid => {
      const power = outcome.powerCardIdsPlayed[uid];
      if (power === 17 && !availableSuits.includes('Stars')) {
        availableSuits.push('Stars');
      }
      if (power === 18 && !availableSuits.includes('Moons')) {
        availableSuits.push('Moons');
        // Add all moon cards to deck for future draws
        const moonCards = VALUES.map(v => `Moons-${v}`);
        newDeck.push(...moonCards);
      }
    });

    if (newDeck.length > roomData.deck.length) {
      // If we added cards, reshuffle
      const shuffledDeck = shuffle(newDeck);
      newDeck.length = 0;
      newDeck.push(...shuffledDeck);
    }

    if (temperanceActive) {
      // Temperance returns played suit cards (power cards remain consumed).
      uids.forEach(uid => {
        const cardToReturn = outcome.initialCardsPlayed?.[uid] || outcome.cardsPlayed[uid];
        if (cardToReturn) updatedPlayers[uid].hand.push(cardToReturn);
      });
    }

    let famineActive = roomData.famineActive || false;
    if (!famineActive && newDeck.length === 0) {
      famineActive = true;
      const diff = updatedPlayers[p1Uid].hand.length - updatedPlayers[p2Uid].hand.length;
      if (diff !== 0) {
        const targetUid = diff < 0 ? p1Uid : p2Uid;
        const needed = Math.abs(diff);
        for (let i = 0; i < needed; i++) {
          updatedPlayers[targetUid].hand.push(nextBoneCard(targetUid));
        }
      }
    }

    const targetSuit = availableSuits[Math.floor(Math.random() * availableSuits.length)];
    const nextStatus = (updatedPlayers[p1Uid].hand.length === 0 || updatedPlayers[p2Uid].hand.length === 0) ? 'finished' : 'playing';
    let winner = roomData.winner;
    if (nextStatus === 'finished' && !winner) {
      if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length > 0) winner = p2Uid;
      else if (updatedPlayers[p2Uid].hand.length === 0 && updatedPlayers[p1Uid].hand.length > 0) winner = p1Uid;
      else if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length === 0 && outcome.winnerUid !== 'draw') winner = outcome.winnerUid;
    }

    return {
      ...roomData,
      players: updatedPlayers,
      lastOutcome: outcome,
      status: nextStatus,
      winner,
      currentTurn: roomData.currentTurn + 1,
      targetSuit,
      availableSuits,
      wheelOffset: Math.random(),
      deck: newDeck,
      powerDeck,
      pendingPowerDecisions: {},
      engageMoves: null,
      awaitingPowerShowdown: false,
      famineActive,
      updatedAt: Date.now()
    };
  }

  destroy() {
    if (this.powerShowdownClearTimer) {
      clearTimeout(this.powerShowdownClearTimer);
      this.powerShowdownClearTimer = null;
    }
    if (this.powerResolutionTimer) {
      clearTimeout(this.powerResolutionTimer);
      this.powerResolutionTimer = null;
    }
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
  }
}

export const gameService = new GameService();
