import Peer, { DataConnection } from 'peerjs';
import { RoomData, PlayerData, Suit, SUITS, VALUES, GameSettings, PlayerRole } from '../types';

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
  if (cardStr.startsWith('Joker')) return 0;
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
  | { type: 'RESOLVE_DESPERATION', uid: string };

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
    tiers: ['TIER 1']
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
          currentMove: null,
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
      wheelOffset: Math.random(),
      deck: [],
      winner: null,
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
    this.isHost = false;
    await this.init(onStateChange);
    
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject('Peer not initialized');
      
      const conn = this.peer.connect(roomId);
      this.connection = conn;
      
      conn.on('open', () => {
        this.setupConnection(conn);
        this.sendEvent({ type: 'PLAYER_JOIN', name: playerName, uid: this.myUid });
        resolve();
      });

      conn.on('error', (err) => reject(err));
      
      // Timeout if cannot connect
      setTimeout(() => reject('Connection timeout'), 10000);
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
      if (event.type === 'PLAYER_JOIN') {
        this.handlePlayerJoin(event.name, event.uid);
      } else if (event.type === 'PLAY_CARD') {
        this.processMove(event.uid, event.cardId);
      } else if (event.type === 'PROCEED_NEXT') {
        this.handleProceedNext(event.uid);
      } else if (event.type === 'UPDATE_SETTINGS') {
        this.updateSettings(event.settings);
      } else if (event.type === 'SPIN_DESPERATION') {
        this.processSpinDesperation(event.uid, event.offset);
      } else if (event.type === 'RESOLVE_DESPERATION') {
        this.handleResolveDesperation(event.uid);
      }
    } else {
      if (event.type === 'STATE_UPDATE') {
        this.state = event.state;
        this.onStateChange?.(this.state);
      }
    }
  }

  private handlePlayerJoin(name: string, uid: string) {
    if (!this.state || this.state.status !== 'waiting') return;
    
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
          currentMove: null,
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

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.myUid]: {
          ...this.state.players[this.myUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : hostRole,
          hand: hostHand,
        },
        [guestUid]: {
          ...this.state.players[guestUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : guestRole,
          hand: guestHand,
        }
      },
      status: 'playing',
      deck,
      updatedAt: Date.now()
    };

    this.broadcastState();
  }

  private processMove(uid: string, cardId: string) {
    if (!this.state || !this.state.players[uid]) return;

    const player = this.state.players[uid];
    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      currentMove: cardId,
      confirmed: true
    };

    const allConfirmed = Object.values(updatedPlayers).every((p: PlayerData) => p.confirmed);

    if (allConfirmed) {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        status: 'results',
        lastOutcome: this.calculateOutcome(this.state, updatedPlayers),
        updatedAt: Date.now()
      };
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
    const p1Uid = uids[0];
    const p2Uid = uids[1];
    const c1 = players[p1Uid].currentMove!;
    const c2 = players[p2Uid].currentMove!;
    const targetSuit = roomData.targetSuit!;

    const pc1 = parseCard(c1);
    const pc2 = parseCard(c2);

    let winnerUid: string | 'draw' = 'draw';
    let message = '';

    if (pc1.isJoker && pc2.isJoker) {
      winnerUid = 'draw';
      message = 'Two Jokers! Mutual destruction.';
    } else if (pc1.isJoker) {
      if (pc2.suit === targetSuit) {
        winnerUid = p1Uid;
        message = 'The Joker trumps the Target Suit!';
      } else {
        winnerUid = p2Uid;
        message = 'The Joker was caught without the Target Suit!';
      }
    } else if (pc2.isJoker) {
      if (pc1.suit === targetSuit) {
        winnerUid = p2Uid;
        message = 'The Joker trumps the Target Suit!';
      } else {
        winnerUid = p1Uid;
        message = 'The Joker was caught without the Target Suit!';
      }
    } else {
      const hasS1 = pc1.suit === targetSuit;
      const hasS2 = pc2.suit === targetSuit;

      if (hasS1 && !hasS2) {
        winnerUid = p1Uid;
        message = 'The Target Suit reigns supreme!';
      } else if (!hasS1 && hasS2) {
        winnerUid = p2Uid;
        message = 'The Target Suit reigns supreme!';
      } else {
        const v1 = getCardValue(c1);
        const v2 = getCardValue(c2);
        if (v1 > v2) {
          winnerUid = p1Uid;
          message = 'Superior value wins the clash!';
        } else if (v2 > v1) {
          winnerUid = p2Uid;
          message = 'Superior value wins the clash!';
        } else {
          winnerUid = 'draw';
          message = 'A perfect stalemate!';
        }
      }
    }

    return {
      winnerUid,
      message,
      cardsPlayed: {
        [p1Uid]: c1,
        [p2Uid]: c2
      }
    };
  }

  private applyRoundResults(roomData: RoomData, players: Record<string, PlayerData>): RoomData {
    const outcome = roomData.lastOutcome!;
    const uids = Object.keys(players);
    const newDeck = [...roomData.deck];
    const updatedPlayers = { ...players };

    uids.forEach(uid => {
      const move = updatedPlayers[uid].currentMove;
      updatedPlayers[uid].hand = updatedPlayers[uid].hand.filter(c => c !== move);
      updatedPlayers[uid].currentMove = null;
      updatedPlayers[uid].confirmed = false;
      updatedPlayers[uid].readyForNextRound = false;
    });

    if (outcome.winnerUid !== 'draw' && newDeck.length > 0) {
      const reward = newDeck.splice(0, 1)[0];
      updatedPlayers[outcome.winnerUid].hand.push(reward);
    }

    let gameWinner: string | null = null;
    uids.forEach(uid => {
      if (updatedPlayers[uid].hand.length === 0) {
        gameWinner = uids.find(id => id !== uid)!;
      }
    });

    return {
      ...roomData,
      status: gameWinner ? 'finished' : 'playing',
      players: updatedPlayers,
      deck: newDeck,
      currentTurn: roomData.currentTurn + 1,
      targetSuit: SUITS[Math.floor(Math.random() * SUITS.length)],
      wheelOffset: Math.random(),
      winner: gameWinner,
      updatedAt: Date.now()
    };
  }

  destroy() {
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
  }
}

export const gameService = new GameService();
