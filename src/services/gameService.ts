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
  | { type: 'PLAY_POWER_CARD', uid: string, powerCardId: number | null }
  | { type: 'SUBMIT_POWER_DECISION', uid: string, option: string, wheelOffset?: number; priestessSwapToCard?: string | null };

const STORAGE_KEY = 'preydator_settings';

const loadSettings = (): GameSettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
  return {
    hostRole: 'Predator',
    difficulty: 'Normal',
    disableJokers: false,
    disablePowerCards: false,
    enableDesperation: false,
    tiers: ['TIER 0']
  };
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

export class GameService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost = false;
  private state: RoomData | null = null;
  private onStateChange: ((state: RoomData) => void) | null = null;
  private myUid: string = '';
  private powerResolutionTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.state = { ...this.state, settings };
    saveSettings(settings);
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
        this.updateSettings(event.settings);
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

  async startGame() {
    if (!this.isHost || !this.state) return;
    const players = Object.keys(this.state.players);
    if (players.length < 2) return;

    const settings = this.state.settings;
    const deck = createDeck(settings.disableJokers);
    
    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;
    
    const guestUid = players.find(uid => uid !== this.myUid)!;

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

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.myUid]: {
          ...this.state.players[this.myUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : hostRole,
          hand: hostHand,
          desperationTier: settings.enableDesperation && (settings.hostRole !== 'Predator') ? 1 : 0
        },
        [guestUid]: {
          ...this.state.players[guestUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : guestRole,
          hand: guestHand,
          desperationTier: settings.enableDesperation && guestRole !== 'Predator' ? 1 : 0
        }
      },
      status: settings.disablePowerCards ? 'playing' : 'drafting',
      deck,
      powerDeck,
      draftSets,
      draftTurn: 0,
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
      const pendingPowerDecisions = this.createPendingPowerDecisions(updatedPlayers);
      const hasPendingDecisions = Object.values(pendingPowerDecisions).some(Boolean);
      if (hasPendingDecisions) {
        const uidsLocked = Object.keys(updatedPlayers);
        const engageMoves: Record<string, string> = {
          [uidsLocked[0]]: updatedPlayers[uidsLocked[0]].currentMove!,
          [uidsLocked[1]]: updatedPlayers[uidsLocked[1]].currentMove!
        };
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'powering',
          engageMoves,
          pendingPowerDecisions,
          updatedAt: Date.now()
        };
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
    if (this.isHost) {
      this.updateSettings(settings);
    } else {
      this.sendEvent({ type: 'UPDATE_SETTINGS', settings });
    }
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

  private createPendingPowerDecisions(players: Record<string, PlayerData>): Record<string, PendingPowerDecision | null> {
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
        decisions[uid] = {
          powerCardId: 2,
          options: ['PRIESTESS_RESOLVE'],
          selectedOption: null,
          priestessOpponentUsesPower: oppUsesPower,
          priestessOpponentName: players[oppUid].name,
          priestessSwapToCard: null
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
    const result = player.desperationResult;
    const updatedPlayers = { ...this.state.players };
    const newDeck = [...this.state.deck];
    let newWinner = this.state.winner;

    if (result === 'GAME OVER') {
      newWinner = Object.keys(this.state.players).find(id => id !== uid)!;
      updatedPlayers[uid] = {
        ...player,
        desperationTier: player.desperationTier + 1,
        desperationSpinning: false
      };
    } else if (result?.startsWith('Gain')) {
      const numStr = result.split(' ')[1];
      const count = parseInt(numStr);
      const cards = newDeck.splice(0, count);
      updatedPlayers[uid] = {
        ...player,
        desperationTier: player.desperationTier + 1,
        hand: [...player.hand, ...cards],
        desperationSpinning: false,
        desperationResult: null
      };
    } else {
      updatedPlayers[uid] = {
        ...player,
        desperationTier: player.desperationTier + 1,
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
    let power1 = players[p1Uid].currentPowerCard;
    let power2 = players[p2Uid].currentPowerCard;
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
          events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 16, message: `${players[pUid].name}'s Tower blocks ${players[oUid].name}'s power!` });
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
      priestessFront.push({
        type: 'POWER_TRIGGER',
        uid,
        powerCardId: 2,
        message: oppUsed
          ? `${players[uid].name} consults the High Priestess · ${oppName} is playing a Major Arcana this round.`
          : `${players[uid].name} consults the High Priestess · ${oppName} is not playing a Major Arcana this round.`
      });
      if (finalCard !== locked) {
        priestessFront.push({
          type: 'CARD_SWAP',
          uid,
          cardId: finalCard,
          message: `${players[uid].name} changes their committed card via the Priestess.`
        });
      } else {
        priestessFront.push({
          type: 'POWER_TRIGGER',
          uid,
          powerCardId: 2,
          message: `${players[uid].name} holds course with ${locked.replace('-', ' of ')}.`
        });
      }

      if (isP1) c1 = finalCard;
      else c2 = finalCard;
    };

    applyPriestessConsult(p1Uid, p1Decision, true);
    applyPriestessConsult(p2Uid, p2Decision, false);
    events.splice(0, 0, ...priestessFront);

    // Interactive powers (Magician / Devil / Wheel) resolve before standard before-resolution effects.
    const applyMagicianDecision = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 1 || blockedPowers[uid]) return;
      if (decision.selectedOption === 'STEAL_JOKER') {
        const oHand = players[oppUid].hand;
        const jokerStr = oHand.find(c => c.startsWith('Joker'));
        if (jokerStr) {
          events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 1, message: `${players[uid].name} casts Magician and steals a Joker!` });
          gains[uid].push({ type: 'card', id: jokerStr });
        }
      } else if (decision.selectedOption === 'FROGIFY') {
        if (uid === p1Uid) c2 = 'Frogs-1';
        else c1 = 'Frogs-1';
        events.push({ type: 'TRANSFORM', uid: oppUid, cardId: 'Frogs-1', message: `${players[uid].name} casts Frogs and warps the opposing card!` });
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

    applyMagicianDecision(p1Uid, p2Uid, p1Decision);
    applyMagicianDecision(p2Uid, p1Uid, p2Decision);
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

    // TRANSFORMATION: If target suit is Stars, all normal cards transform to Stars
    if (targetSuit === 'Stars') {
      const pc1 = parseCard(c1);
      const pc2 = parseCard(c2);
      if (!pc1.isJoker && pc1.suit !== 'Stars') {
        c1 = `Stars-${pc1.value}`;
        events.push({ type: 'TRANSFORM', uid: p1Uid, cardId: c1, message: `${players[p1Uid].name}'s card became a Star!` });
      }
      if (!pc2.isJoker && pc2.suit !== 'Stars') {
        c2 = `Stars-${pc2.value}`;
        events.push({ type: 'TRANSFORM', uid: p2Uid, cardId: c2, message: `${players[p2Uid].name}'s card became a Star!` });
      }
    }

    const hermitSwap = (pUid: string, oCard: string) => {
      const p = players[pUid];
      const winningCard = p.hand.find(card => {
        const pCard = parseCard(card);
        const oCardP = parseCard(oCard);
        if (pCard.isJoker) return true;
        if (oCardP.isJoker) return false;
        if (pCard.suit === targetSuit && oCardP.suit !== targetSuit) return true;
        if (pCard.suit !== targetSuit && oCardP.suit === targetSuit) return false;
        return getCardValue(card) > getCardValue(oCard);
      });
      if (winningCard) {
        return { card: winningCard, reason: 'win' as const };
      }
      const drawingCard = p.hand.find(card => {
        const pCard = parseCard(card);
        const oCardP = parseCard(oCard);
        if (pCard.isJoker && oCardP.isJoker) return true;
        if (pCard.isJoker || oCardP.isJoker) return false;
        const pTarget = pCard.suit === targetSuit;
        const oTarget = oCardP.suit === targetSuit;
        if (pTarget !== oTarget) return false;
        return getCardValue(card) === getCardValue(oCard);
      });
      if (drawingCard) {
        return { card: drawingCard, reason: 'draw' as const };
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
        events.push({ type: 'POWER_TRIGGER', message: 'Temperance forced transparency and balance.' });
    } else {
        const evalClash = (cr1: string, cr2: string) => {
          const pr1 = parseCard(cr1);
          const pr2 = parseCard(cr2);
          if (pr1.isJoker && pr2.isJoker) return 'draw';
          if (pr1.isJoker && !pr2.isJoker) return pr2.suit === targetSuit ? 'p1' : 'p2';
          if (pr2.isJoker && !pr1.isJoker) return pr1.suit === targetSuit ? 'p2' : 'p1';
          
          const p1Target = pr1.suit === targetSuit || (targetSuit === 'Stars' && !pr1.isJoker);
          const p2Target = pr2.suit === targetSuit || (targetSuit === 'Stars' && !pr2.isJoker);
          
          if (p1Target && !p2Target) return 'p1';
          if (!p1Target && p2Target) return 'p2';
          
          const v1 = getCardValue(cr1);
          const v2 = getCardValue(cr2);
          if (v1 > v2) return 'p1';
          if (v2 > v1) return 'p2';
          return 'draw';
        };

        const res = evalClash(c1, c2);
        const s1 = summonedCards[p1Uid];
        const s2 = summonedCards[p2Uid];

        if (s1 && s2) {
          const r1 = evalClash(s1, s2);
          const rMain = res;
          if (rMain === 'p1' || r1 === 'p1') winnerUid = p1Uid;
          else if (rMain === 'p2' || r1 === 'p2') winnerUid = p2Uid;
          else winnerUid = 'draw';
        } else if (s1) {
          const resSummon = evalClash(s1, c2);
          if (res === 'p1' || resSummon === 'p1') winnerUid = p1Uid;
          else if (res === 'p2' && resSummon === 'p2') winnerUid = p2Uid;
          else winnerUid = 'draw';
        } else if (s2) {
          const resSummon = evalClash(s2, c1);
          if (res === 'p2' || resSummon === 'p2') winnerUid = p2Uid;
          else if (res === 'p1' && resSummon === 'p1') winnerUid = p1Uid;
          else winnerUid = 'draw';
        } else {
          winnerUid = res === 'p1' ? p1Uid : (res === 'p2' ? p2Uid : 'draw');
        }

        const applyWheelOutcome = (uid: string, outcomeLabel?: string | null) => {
          if (!outcomeLabel) return;
          if (outcomeLabel === 'LOSE_ROUND') {
            winnerUid = uid === p1Uid ? p2Uid : p1Uid;
          } else if (outcomeLabel === 'WIN_ROUND') {
            winnerUid = uid;
          } else if (outcomeLabel === 'WIN_2_CARDS') {
            gains[uid].push({ type: 'draw', id: 2 });
            gains[uid].push({ type: 'draw', id: 2 });
          } else if (outcomeLabel === 'DOUBLE_JOKER') {
            c1 = 'Joker-1';
            c2 = 'Joker-2';
            winnerUid = 'draw';
          } else if (outcomeLabel === 'JACKPOT') {
            if (uid === p1Uid) c1 = 'Coins-10';
            else c2 = 'Coins-10';
          } else if (outcomeLabel === 'POWER_CARD') {
            gains[uid].push({ type: 'draw', id: 'random-power' });
          } else if (outcomeLabel === 'LOSE_2_CARDS') {
            gains[uid].push({ type: 'draw', id: -2 });
          }
          events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 10, message: `${players[uid].name}'s Wheel of Fortune outcome: ${outcomeLabel.replaceAll('_', ' ')}` });
        };
        if (power1 === 10 && !blockedPowers[p1Uid]) applyWheelOutcome(p1Uid, p1Decision?.wheelResult);
        if (power2 === 10 && !blockedPowers[p2Uid]) applyWheelOutcome(p2Uid, p2Decision?.wheelResult);

        if (power1 === 13 && power2 === 13 && !blockedPowers[p1Uid] && !blockedPowers[p2Uid]) {
          const hostWins = Math.random() > 0.5;
          winnerUid = hostWins ? p1Uid : p2Uid;
          events.push({ type: 'COIN_FLIP', message: `${players[winnerUid].name} wins the Death coin flip.` });
        } else {
          if (power1 === 13 && !blockedPowers[p1Uid]) winnerUid = p1Uid;
          if (power2 === 13 && !blockedPowers[p2Uid]) winnerUid = p2Uid;
        }

        if (power1 === 20 || power2 === 20) {
          if (!(power1 === 20 && power2 === 20)) {
            events.push({ type: 'POWER_TRIGGER', message: `Judgement has inverted the fate!` });
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

        if (power1 === 12) { winnerUid = p2Uid; events.push({ type: 'POWER_TRIGGER', powerCardId: 12, message: `${players[p1Uid].name} forfeits via The Hanged Man.` }); }
        if (power2 === 12) { winnerUid = p1Uid; events.push({ type: 'POWER_TRIGGER', powerCardId: 12, message: `${players[p2Uid].name} forfeits via The Hanged Man.` }); }
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
       const p1 = parseCard(c1);
       const p2 = parseCard(c2);
       const wCard = winnerUid === p1Uid ? p1 : p2;
       const lCard = winnerUid === p1Uid ? p2 : p1;
       const wVal = getCardValue(winnerUid === p1Uid ? c1 : c2);
       const lVal = getCardValue(winnerUid === p1Uid ? c2 : c1);

       if (power1 === 12 || power2 === 12) finalMessage = `${wName} takes the round by sacrifice!`;
       else if (power1 === 20 || power2 === 20) finalMessage = `Judgement declares ${wName} the survivor!`;
       else if (wCard.isJoker && !lCard.isJoker) {
         if (lCard.suit === targetSuit) finalMessage = `${wName}'s Joker was caught by the Target Suit!`;
         else finalMessage = `${wName}'s Joker overrides the field!`;
       }
       else if (wCard.suit === targetSuit && lCard.suit !== targetSuit) {
         finalMessage = `Target Suit advantage: ${wName} wins!`;
       }
       else if (wVal > lVal) {
         finalMessage = `${wName} wins with higher power (${wVal} vs ${lVal}).`;
       }
       else {
         finalMessage = `${wName} wins the round!`;
       }
    }

    // Phase 4: Post-Resolution Gains Determination
    if (winnerUid !== 'draw' && winnerUid) {
      gains[winnerUid].push({ type: 'draw', id: 'standard' });
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
    if (power1 === 12) gains[p1Uid].push({ type: 'draw', id: 3 });
    if (power2 === 12) gains[p2Uid].push({ type: 'draw', id: 3 });
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
      gains[p1Uid].push({ type: 'draw', id: 'random-card' });
    }
    if (power2 === 21) {
      gains[p2Uid].push({ type: 'draw', id: 'random-power' });
      gains[p2Uid].push({ type: 'draw', id: 'random-card' });
    }

    return {
      targetSuit,
      winnerUid,
      message: finalMessage,
      cardsPlayed: { [p1Uid]: c1, [p2Uid]: c2 },
      initialCardsPlayed,
      powerCardsPlayed: { 
        [p1Uid]: power1 !== null ? MAJOR_ARCANA[power1].name : 'None', 
        [p2Uid]: power2 !== null ? MAJOR_ARCANA[power2].name : 'None' 
      },
      powerCardIdsPlayed: { [p1Uid]: power1, [p2Uid]: power2 },
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
    
    // Special power cards after round
    uids.forEach(uid => {
      const power = outcome.powerCardIdsPlayed[uid];
      const oUid = uids.find(id => id !== uid)!;
      void oUid;

      // Empress: Collect Both
      if (power === 3) {
        // We use outcome.cardsPlayed (transformed cards) or initial? 
        // User said "The opponents suit card, and the players suit card"
        // Usually means the cards as they were played.
        updatedPlayers[uid].hand.push(outcome.cardsPlayed[p1Uid]);
        updatedPlayers[uid].hand.push(outcome.cardsPlayed[p2Uid]);
      }

      if (power === 7 && winnerUid === oUid) { // Chariot: Keep and upgrade
         const played = outcome.cardsPlayed[uid];
         const pc = parseCard(played);
         const newVal = VALUES[Math.min(VALUES.indexOf(pc.value as any) + 1, VALUES.length - 1)];
         updatedPlayers[uid].hand.push(`${pc.suit}-${newVal}`);
      }
      
      if (power === 19) { // Sun: Copy played card (the final resolved card)
        const played = outcome.cardsPlayed[uid];
        updatedPlayers[uid].hand.push(played);
      }
      
      if (power === 12) { // Hanged Man: Gain 3
        updatedPlayers[uid].hand.push(...newDeck.splice(0, 3));
      }
      
      if (power === 21) { // World: Power + Suit
         if (powerDeck.length > 0) updatedPlayers[uid].powerCards.push(powerDeck.splice(0, 1)[0]);
         if (newDeck.length > 0) updatedPlayers[uid].hand.push(newDeck.splice(0, 1)[0]);
      }
    });

    // Generic outcome gains application.
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
          } else if (gain.id === 'random-card' || gain.id === 'standard') {
            if (newDeck.length > 0) updatedPlayers[uid].hand.push(newDeck.splice(0, 1)[0]);
          } else if (typeof gain.id === 'number' && gain.id > 0) {
            for (let i = 0; i < gain.id; i++) {
              if (newDeck.length > 0) updatedPlayers[uid].hand.push(newDeck.splice(0, 1)[0]);
            }
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
          const val = VALUES[Math.floor(Math.random() * VALUES.length)];
          updatedPlayers[targetUid].hand.push(`Bones-${val}`);
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
      famineActive,
      updatedAt: Date.now()
    };
  }

  destroy() {
    if (this.powerResolutionTimer) {
      clearTimeout(this.powerResolutionTimer);
      this.powerResolutionTimer = null;
    }
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
  }
}

export const gameService = new GameService();
