import Peer, { DataConnection } from 'peerjs';
import {
  RoomData,
  PlayerData,
  Suit,
  SUITS,
  VALUES,
  PANIC_BLADE_RANK_VALUES,
  isPanicBladeNumericValue,
  GameSettings,
  PlayerRole,
  MAJOR_ARCANA,
  ResolutionEvent,
  PendingPowerDecision,
  PendingCardShopPurchase,
  ChatMessageEntry,
  ActiveCurseState,
  SlothDreamResult,
  CardShopState,
  type CardArtSessionPayload,
  type OutcomeGainItem,
} from '../types';
import { CARD_ART_TOOLS_ENABLED } from '../cardArt/toolsAccess';
import { DESPERATION_GAME_SLICES, FORTUNE_GAME_SLICES, SLOTH_DREAM_GAME_SLICES } from '../wheels/presets';
import {
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_IDS,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_ENVY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_SLOTH,
  CURSE_WRATH,
  CURSES,
  cursePlayedActivatesEnvyTable,
  pickDevilCurseFromOffset,
  curseEffectActive,
  gluttonyCurseActive,
  greedCurseActive,
  LUST_METER_MAX,
  greedTaxAmount,
  isCurseCardId,
  isMajorArcanaId,
  lustCurseActive,
  envyCurseActive,
  prideCurseActive,
  wrathCurseActive,
  slothCurseActive,
} from '../curses';
import {
  normalizeGameSettings as normalizeLobbyGameSettings,
  loadPersistedLobbySettings,
  persistLobbyDefaults,
} from '../settings/normalizeGameSettings';
import { sanitizeRoomDataForClient } from '../settings/sanitizeRoomData';
import { panicDiceSeatAllowed } from './panicDiceSeat';
import {
  createInitialCardShop,
  refreshDiscountSlot,
  slotChargeTokens,
  describeShopOfferLine,
} from '../cardShop';
import { isShopPackPlaceholder, shopPackCardId } from '../shopPack';



export * from './gameServiceCore';
import type { DiceTestRollPayload, GameEvent } from './gameServiceCore';
import { calculateRoundOutcome } from './outcome';
import {
  DESPERATION_SLICES,
  ENVY_MONSTER_START_HP,
  GROVEL_CARD_ID,
  bumpPlayingCardRank,
  compactCardLabel,
  computeOverkillTokenAward,
  computePanicCombatEffects,
  createFreshCurseState,
  createMultiDeck,
  desperationSpinAllowed,
  envyAllowsPlayCardId,
  envyFreeCopiesInHand,
  evaluateTrickClash,
  explainPlainClash,
  fairHalfFromD6,
  getCardValue,
  getWrathMagnitude,
  handHasLegalEnvyPlay,
  handHasLegalPridePlay,
  handIndexAfterReorder,
  heartsRemainInDeckHandsOrCommits,
  isCardBlockedByPride,
  isOnTargetField,
  labelCommittedPowerOrCurse,
  loadSettings,
  lustBumpHeartIfApplicable,
  lustReplayContextFromOutcome,
  mergeEnvySealDeltas,
  normalizeGameSettings,
  panicClashDisplayedCardPair,
  panicDiceTotalToCardId,
  parseCard,
  pickEnvyCovetedForRound,
  pickSlothDreamResult,
  plainCardLabelForLustEmpower,
  resolveFrozenTrickWinnerForPanic,
  rollFairD6,
  samePlayingHandMultiset,
  saveSettings,
  sentenceCard,
  shuffle,
  wrathMinionCardForRound,
} from './gameServiceCore';


export class GameService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost = false;
  private state: RoomData | null = null;
  private onStateChange: ((state: RoomData) => void) | null = null;
  private onDiceTestRoll: ((payload: DiceTestRollPayload) => void) | null = null;
  private myUid: string = '';
  private powerResolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private powerShowdownClearTimer: ReturnType<typeof setTimeout> | null = null;
  private rescueHostRebindInFlight = false;
  /** Host: debounce shop cursor broadcasts (~14 Hz flush of latest coords). */
  private shopCursorFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private shopCursorPending: { uid: string; nx: number; ny: number } | null = null;
  /** Throttle host focus broadcasts / guest resync pings so tab wake storms stay cheap. */
  private lastHostSessionResyncAt = 0;
  private lastGuestSessionResyncRequestAt = 0;

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

        const playerCount = this.state ? Object.keys(this.state.players).length : 0;
        const aliveRemote =
          !!this.connection && 'open' in this.connection ? (this.connection as DataConnection & { open: boolean }).open : false;

        if (aliveRemote && playerCount >= 2) {
          conn.close();
          return;
        }

        if (this.connection && !aliveRemote) {
          try {
            this.connection.close();
          } catch {
            /* ignore */
          }
        }

        this.connection = conn;
        this.setupConnection(conn);
      });
    });
  }

  getUid() {
    return this.myUid;
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  getState(): RoomData | null {
    return this.state;
  }

  /** Dev only: publish Card Creator pack for guest browsers that do not share the hostâ€™s localStorage. */
  publishCardArtSession(payload: CardArtSessionPayload) {
    if (!CARD_ART_TOOLS_ENABLED || !this.isHost || !this.state) return;
    this.state = {
      ...this.state,
      cardArtSession: payload,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  /**
   * Local split-screen / tab refresh: reclaim the same PeerJS id and room state after UI unmount.
   * Caller should `await` a short delay before guest `resumeDualGuest` connects.
   */
  async resumeDualHost(
    snapshot: { roomId: string; myUid: string; room: RoomData; playerName: string },
    onStateChange: (state: RoomData) => void,
  ): Promise<void> {
    this.destroy();
    await new Promise<void>((r) => setTimeout(r, 80));
    this.myUid = snapshot.myUid;
    this.isHost = true;
    this.onStateChange = onStateChange;
    this.state = {
      ...snapshot.room,
      code: snapshot.roomId,
      updatedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      try {
        this.peer = new Peer(snapshot.roomId);
      } catch (e) {
        reject(e);
        return;
      }
      const t = setTimeout(() => reject(new Error('Host resume timeout')), 16000);
      this.peer!.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
      this.peer!.on('open', () => {
        clearTimeout(t);
        resolve();
      });
      this.peer!.on('connection', (conn) => {
        if (!this.isHost) {
          conn.close();
          return;
        }
        const playerCount = this.state ? Object.keys(this.state.players).length : 0;
        const aliveRemote =
          !!this.connection && 'open' in this.connection
            ? (this.connection as DataConnection & { open: boolean }).open
            : false;
        if (aliveRemote && playerCount >= 2) {
          conn.close();
          return;
        }
        if (this.connection && !aliveRemote) {
          try {
            this.connection.close();
          } catch {
            /* ignore */
          }
        }
        this.connection = conn;
        this.setupConnection(conn);
      });
    });
    onStateChange(this.state!);
  }

  async resumeDualGuest(
    snapshot: { roomId: string; myUid: string; playerName: string },
    onStateChange: (state: RoomData) => void,
  ): Promise<void> {
    return this.joinRoom(snapshot.roomId, snapshot.playerName, onStateChange, { reuseUid: snapshot.myUid });
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
          desperationOffset: 0,
          panicDiceUsed: false,
          tokenBalance: 0,
          sacrificialBowlBurnsRemaining: 2,
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
      updatedAt: Date.now(),
      chatMessages: [],
      activeCurses: [],
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

  async joinRoom(
    roomId: string,
    playerName: string,
    onStateChange: (state: RoomData) => void,
    opts?: { reuseUid?: string },
  ): Promise<void> {
    this.onStateChange = onStateChange;
    this.isHost = false;
    if (opts?.reuseUid) {
      this.myUid = opts.reuseUid;
    }
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
      if (this.connection === conn) this.connection = null;
      if (this.isHost) {
        if (this.state?.settings.enablePokerChips) {
          this.clearShopCursorPipeline();
          this.state = {
            ...this.state,
            cardShopBrowsersUids: [],
            shopBrowsingUid: null,
            shopRemoteCursor: null,
            updatedAt: Date.now(),
          };
          this.broadcastState();
        }
        return;
      }
      void this.promoteGuestToRescueHost();
    });
  }

  /**
   * Guest contingency: if the host disappears, rebind this client as host on the same room id so the match can continue.
   * Falls back to local host-authority mode even if room-id rebind fails.
   */
  private async promoteGuestToRescueHost() {
    if (this.isHost || this.rescueHostRebindInFlight || !this.state) return;
    this.rescueHostRebindInFlight = true;
    const roomId = this.state.code;

    const adoptLocalHostState = () => {
      this.isHost = true;
      if (!this.state) return;
      this.state = {
        ...this.state,
        hostUid: this.myUid,
        cardShopBrowsersUids: [],
        shopBrowsingUid: null,
        shopRemoteCursor: null,
        updatedAt: Date.now(),
      };
      this.onStateChange?.(this.state);
    };

    try {
      this.clearShopCursorPipeline();
      if (this.connection) {
        try {
          this.connection.close();
        } catch {
          /* noop */
        }
      }
      this.connection = null;
      if (this.peer) {
        try {
          this.peer.destroy();
        } catch {
          /* noop */
        }
      }
      this.peer = null;

      if (!roomId) {
        adoptLocalHostState();
        return;
      }

      await new Promise<void>((r) => setTimeout(r, 120));
      this.isHost = true;
      this.state = {
        ...this.state,
        hostUid: this.myUid,
        cardShopBrowsersUids: [],
        shopBrowsingUid: null,
        shopRemoteCursor: null,
        updatedAt: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        try {
          this.peer = new Peer(roomId);
        } catch (err) {
          reject(err);
          return;
        }
        const timeout = setTimeout(() => reject(new Error('Rescue host rebind timeout')), 9000);
        this.peer!.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        this.peer!.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        this.peer!.on('connection', (nextConn) => {
          if (!this.isHost) {
            nextConn.close();
            return;
          }
          if (this.connection && (this.connection as DataConnection & { open?: boolean }).open) {
            nextConn.close();
            return;
          }
          this.connection = nextConn;
          this.setupConnection(nextConn);
        });
      });

      this.broadcastState();
    } catch {
      adoptLocalHostState();
    } finally {
      this.rescueHostRebindInFlight = false;
    }
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
      } else if (event.type === 'REORDER_HAND') {
        if (remoteUid && event.uid === remoteUid) {
          this.processReorderHand(remoteUid, event.hand);
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
      } else if (event.type === 'CHEAT_ACTIVATE_CURSE') {
        if (remoteUid) {
          this.handleCheatActivateCurse(event.curseId);
        }
      } else if (event.type === 'CHEAT_CLEAR_ACTIVE_CURSES') {
        if (remoteUid) {
          this.handleCheatClearActiveCurses();
        }
      } else if (event.type === 'PLAY_POWER_CARD') {
        if (remoteUid) {
          this.handlePlayPowerCard(remoteUid, event.powerCardId);
        }
      } else if (event.type === 'SUBMIT_POWER_DECISION') {
        if (remoteUid) {
          this.handleSubmitPowerDecision(remoteUid, event.option, event.wheelOffset, event.priestessSwapToCard);
        }
      } else if (event.type === 'SEND_CHAT') {
        if (remoteUid && event.uid === remoteUid) {
          this.handleChatMessage(remoteUid, event.text);
        }
      } else if (event.type === 'USE_PANIC_DICE') {
        if (remoteUid && event.uid === remoteUid) {
          this.handlePanicDiceUse(remoteUid);
        }
      } else if (event.type === 'CARD_SHOP_SET_OPEN') {
        if (remoteUid && event.uid === remoteUid) {
          this.handleCardShopSetBrowsing(event.uid, event.open);
        }
      } else if (event.type === 'CARD_SHOP_BUY') {
        if (remoteUid && event.uid === remoteUid) {
          this.tryPurchaseCardShopSlot(event.uid, event.slotId);
        }
      } else if (event.type === 'SHOP_CURSOR') {
        if (remoteUid && event.uid === remoteUid) {
          this.handleShopCursorDirect(event.uid, event.nx, event.ny);
        }
      } else if (event.type === 'REQUEST_STATE_SYNC') {
        if (remoteUid && event.uid === remoteUid && this.state) {
          this.broadcastState();
        }
      } else if (event.type === 'SACRIFICIAL_BOWL_BURN') {
        if (remoteUid && event.uid === remoteUid) {
          this.processSacrificialBowlBurn(remoteUid, event.handIndex);
        }
      }
    } else {
      if (event.type === 'STATE_UPDATE') {
        /** Full snapshot sanitize: missing `deck` / `hand` / `tiers` after P2P sync whitescreens the table UI. */
        this.state = sanitizeRoomDataForClient(event.state);
        this.onStateChange?.(this.state);
      } else if (event.type === 'ROLL_DICE_TEST_BROADCAST') {
        this.onDiceTestRoll?.({
          uid: event.uid,
          rollId: event.rollId,
          notation: event.notation,
          dice: event.dice,
          total: event.total,
          startedAt: event.startedAt,
          presentation: event.presentation,
        });
      }
    }
  }

  private getRemotePlayerUid(): string | null {
    if (!this.state) return null;
    return Object.keys(this.state.players).find(uid => uid !== this.myUid) || null;
  }

  private handlePlayerJoin(name: string, uid: string) {
    if (!this.state) return;
    /** Dev / P2P: rejoin matches by player name â€” release builds should authenticate room + invite token before migration. */

    const existingPlayerUid = Object.keys(this.state.players).find((id) => this.state!.players[id].name === name);

    if (existingPlayerUid) {
      if (existingPlayerUid === uid) {
        this.broadcastState();
        return;
      }
      const player = this.state.players[existingPlayerUid];
      const updatedPlayers = { ...this.state.players };
      delete updatedPlayers[existingPlayerUid];
      updatedPlayers[uid] = { ...player, uid };

      let hostUid = this.state.hostUid;
      if (hostUid === existingPlayerUid) hostUid = uid;

      this.state = {
        ...this.state,
        hostUid,
        players: updatedPlayers,
        updatedAt: Date.now(),
      };
      this.broadcastState();
      return;
    }

    if (this.state.status !== 'waiting' || Object.keys(this.state.players).length >= 2) return;
    
    const settings = this.state.settings;

    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;

    if (hostRole === 'Preydator') {
      // Internal roles for logic: Host is Pred, Guest is Prey
      hostRole = 'Predator';
      guestRole = 'Prey';
    } else {
      guestRole = hostRole === 'Predator' ? 'Prey' : 'Predator';
    }

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
          desperationOffset: 0,
          panicDiceUsed: false,
          tokenBalance: 0,
          sacrificialBowlBurnsRemaining: 2,
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
    const deck = createMultiDeck(settings.deckSizeMultiplier, settings.disableJokers);

    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;

    if (hostRole === 'Preydator') {
      hostRole = 'Predator';
      guestRole = 'Prey';
    } else {
      guestRole = hostRole === 'Predator' ? 'Prey' : 'Predator';
    }

    const predatorHandSize = settings.predatorStartingCards;
    const preyHandSize = settings.preyStartingCards;

    const hostHandSize = hostRole === 'Predator' ? predatorHandSize : preyHandSize;
    const guestHandSize = guestRole === 'Predator' ? predatorHandSize : preyHandSize;

    const hostHand = deck.splice(0, hostHandSize);
    const guestHand = deck.splice(0, guestHandSize);

    let powerDeck = shuffle(Array.from({ length: 22 }, (_, i) => i));
    if (
      !settings.disablePowerCards &&
      settings.enableCurseCards &&
      settings.curseCardsInPowerDeck
    ) {
      powerDeck.push(
        CURSE_LUST,
        CURSE_LUST,
        CURSE_GLUTTONY,
        CURSE_GLUTTONY,
        CURSE_GREED,
        CURSE_GREED,
        CURSE_PRIDE,
        CURSE_PRIDE,
        CURSE_ENVY,
        CURSE_GREEN_EYED_MONSTER,
        CURSE_WRATH,
        CURSE_WRATH,
        CURSE_SLOTH,
        CURSE_SLOTH,
      );
      powerDeck = shuffle(powerDeck);
    }
    const draftSets: number[][] = [];
    if (!settings.disablePowerCards) {
      for (let i = 0; i < 3; i++) {
        draftSets.push(powerDeck.splice(0, 3));
      }
    }
    const draftPowerAppearances = settings.disablePowerCards ? [] : Array.from(new Set(draftSets.flat()));
    /** Prey seats: tier 0 on ladder when enabled; âˆ’1 = not on ladder until first spin â†’ then tier 1. */
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
            settings.enableDesperation && (settings.hostRole !== 'Predator') ? desperationOpenTier : 0,
          panicDiceUsed: false,
          tokenBalance: 0,
          sacrificialBowlBurnsRemaining: 2,
        },
        [guestUid]: {
          ...this.state.players[guestUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : guestRole,
          hand: guestHand,
          desperationTier:
            settings.enableDesperation && guestRole !== 'Predator' ? desperationOpenTier : 0,
          panicDiceUsed: false,
          tokenBalance: 0,
          sacrificialBowlBurnsRemaining: 2,
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
      ...(settings.enablePokerChips
        ? {
            cardShop: createInitialCardShop(),
            cardShopBrowsersUids: [],
            shopBrowsingUid: null,
            pendingCardShopPurchases: [],
          }
        : {
            cardShop: undefined,
            cardShopBrowsersUids: undefined,
            shopBrowsingUid: undefined,
            pendingCardShopPurchases: undefined,
          }),
      updatedAt: Date.now()
    };

    this.broadcastState();
  }

  private processMove(uid: string, cardId: string) {
    if (!this.state || !this.state.players[uid]) return;

    const player = this.state.players[uid];
    if (player.confirmed) return;
    if (!player.hand.includes(cardId)) return;
    if (isShopPackPlaceholder(cardId)) return;

    const curseOk = this.state.settings.enableCurseCards !== false;
    const lustHr = curseOk && lustCurseActive(this.state.activeCurses);
    const greedTx = curseOk && greedCurseActive(this.state.activeCurses);
    if (
      curseOk &&
      prideCurseActive(this.state.activeCurses) &&
      this.state.prideCeilingCard &&
      isCardBlockedByPride(cardId, this.state.prideCeilingCard, lustHr, greedTx)
    ) {
      return;
    }
    if (
      curseOk &&
      envyCurseActive(this.state.activeCurses) &&
      !envyAllowsPlayCardId(player.hand, uid, cardId, this.state.envySealedCards)
    ) {
      return;
    }

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

  private processReorderHand(uid: string, newHandOrder: string[]) {
    if (!this.state || !this.state.players[uid]) return;

    const player = this.state.players[uid];
    if (player.confirmed) return;
    if (!samePlayingHandMultiset(player.hand, newHandOrder)) return;

    let nextEnvyCovet = this.state.envyCovet;
    const ec = nextEnvyCovet;
    if (ec && ec.uid === uid && player.hand.length) {
      const nextIdx = handIndexAfterReorder(player.hand, newHandOrder, ec.handIndex);
      if (nextIdx >= 0 && nextIdx < newHandOrder.length && nextIdx !== ec.handIndex) {
        nextEnvyCovet = { ...ec, handIndex: nextIdx };
      }
    }

    const updatedPlayers = {
      ...this.state.players,
      [uid]: {
        ...player,
        hand: [...newHandOrder],
      },
    };

    this.state = {
      ...this.state,
      players: updatedPlayers,
      ...(nextEnvyCovet !== this.state.envyCovet ? { envyCovet: nextEnvyCovet } : {}),
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  /**
   * Sacrificial Bowl reward while Curse Lust is on the table: draw the first Heart still in the deck
   * (searching from the top). If none remain, behaves like a normal top-of-deck pull.
   */
  private pullSacrificialBowlRewardFromDeck(deck: string[], lustActive: boolean): { card: string; nextDeck: string[] } {
    const next = [...deck];
    if (next.length === 0) return { card: GROVEL_CARD_ID, nextDeck: next };
    if (!lustActive) {
      const card = next.shift()!;
      return { card, nextDeck: next };
    }
    const heartIdx = next.findIndex((id) => {
      const pc = parseCard(id);
      return !pc.isJoker && pc.suit === 'Hearts';
    });
    if (heartIdx < 0) {
      const card = next.shift()!;
      return { card, nextDeck: next };
    }
    const [card] = next.splice(heartIdx, 1);
    return { card, nextDeck: next };
  }

  private processSacrificialBowlBurn(uid: string, handIndex: number) {
    if (!this.state || !this.state.players[uid]) return;
    if (this.state.status !== 'playing') return;
    const player = this.state.players[uid];
    if (player.confirmed) return;
    const hand = player.hand;
    if (handIndex < 0 || handIndex >= hand.length) return;
    const burnedId = hand[handIndex];
    if (!burnedId || burnedId === GROVEL_CARD_ID || isShopPackPlaceholder(burnedId)) return;

    const curseOk = this.state.settings.enableCurseCards !== false;
    const lustOnTable = curseOk && lustCurseActive(this.state.activeCurses ?? []);
    if (lustOnTable && parseCard(burnedId).suit === 'Hearts') return;

    const nextHand = [...hand];
    nextHand.splice(handIndex, 1);

    let burns = player.sacrificialBowlBurnsRemaining ?? 2;
    burns -= 1;

    let deck = [...this.state.deck];
    if (burns === 0) {
      const { card: reward, nextDeck } = this.pullSacrificialBowlRewardFromDeck(deck, lustOnTable);
      deck = nextDeck;
      nextHand.push(reward);
      burns = 2;
    }

    let nextEnvyCovet = this.state.envyCovet;
    const ec = nextEnvyCovet;
    if (ec && ec.uid === uid) {
      if (ec.handIndex === handIndex && ec.cardId === burnedId) {
        nextEnvyCovet = null;
      } else if (handIndex < ec.handIndex) {
        nextEnvyCovet = { ...ec, handIndex: ec.handIndex - 1 };
      }
    }

    const updatedPlayers = {
      ...this.state.players,
      [uid]: {
        ...player,
        hand: nextHand,
        sacrificialBowlBurnsRemaining: burns,
      },
    };

    this.state = {
      ...this.state,
      players: updatedPlayers,
      deck,
      ...(nextEnvyCovet !== this.state.envyCovet ? { envyCovet: nextEnvyCovet } : {}),
      sacrificialBowlToast: { uid, at: Date.now() },
      updatedAt: Date.now(),
    };
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

  private clearShopCursorPipeline() {
    if (this.shopCursorFlushTimer) {
      clearTimeout(this.shopCursorFlushTimer);
      this.shopCursorFlushTimer = null;
    }
    this.shopCursorPending = null;
  }

  private flushShopCursorToState = () => {
    this.shopCursorFlushTimer = null;
    if (!this.isHost || !this.state || !this.shopCursorPending) return;
    const { uid, nx, ny } = this.shopCursorPending;
    this.shopCursorPending = null;
    const shoppers = this.normalizeCardShopBrowsersUids();
    if (shoppers.length < 2 || !shoppers.includes(uid)) return;
    const prevSeq = this.state.shopRemoteCursor?.seq ?? 0;
    this.state = {
      ...this.state,
      shopRemoteCursor: { uid, nx, ny, seq: prevSeq + 1 },
      updatedAt: Date.now(),
    };
    this.broadcastState();
  };

  private handleShopCursorDirect(uid: string, nx: number, ny: number) {
    if (!this.isHost || !this.state?.settings.enablePokerChips) return;
    const shoppers = this.normalizeCardShopBrowsersUids();
    if (shoppers.length < 2 || !shoppers.includes(uid)) return;
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));
    this.shopCursorPending = { uid, nx: cx, ny: cy };
    if (this.shopCursorFlushTimer) return;
    this.shopCursorFlushTimer = setTimeout(this.flushShopCursorToState, 24);
  }

  private normalizeCardShopBrowsersUids(): string[] {
    if (!this.state?.settings.enablePokerChips) return [];
    const raw = this.state.cardShopBrowsersUids;
    if (Array.isArray(raw)) {
      if (raw.length === 0) return [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const u of raw) {
        if (typeof u === 'string' && u.length > 0 && !seen.has(u)) {
          seen.add(u);
          out.push(u);
        }
      }
      return out;
    }
    const leg = this.state.shopBrowsingUid;
    return typeof leg === 'string' && leg.length > 0 ? [leg] : [];
  }

  private handleCardShopSetBrowsing(uid: string, open: boolean) {
    if (!this.isHost || !this.state?.settings.enablePokerChips) return;
    this.clearShopCursorPipeline();
    const prevSorted = [...this.normalizeCardShopBrowsersUids()].sort();
    let next: string[];
    if (open) {
      next = [...new Set([...prevSorted, uid])];
    } else {
      next = prevSorted.filter((u) => u !== uid);
    }
    next.sort();
    if (prevSorted.join('|') === next.join('|')) return;

    let shopRemoteCursor = this.state.shopRemoteCursor ?? null;
    if (next.length < 2) shopRemoteCursor = null;
    else if (shopRemoteCursor && !next.includes(shopRemoteCursor.uid)) shopRemoteCursor = null;

    this.state = {
      ...this.state,
      cardShopBrowsersUids: next,
      shopBrowsingUid: null,
      shopRemoteCursor,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private tryPurchaseCardShopSlot(uid: string, slotId: string) {
    if (!this.isHost || !this.state?.settings.enablePokerChips || !this.state.cardShop) return;
    if (!['playing', 'powering', 'results'].includes(this.state.status)) return;
    const shop = this.state.cardShop;
    const slot = shop.slots[slotId];
    const player = this.state.players[uid];
    if (!slot || slot.soldOut || !player) return;

    const price = slotChargeTokens(slot);
    const balance = player.tokenBalance ?? 0;
    if (balance < price) return;

    const offer = slot.offer;
    if (offer.type === 'curse') {
      if (!isCurseCardId(offer.curseId)) return;
    } else if (offer.type === 'major') {
      if (!isMajorArcanaId(offer.powerId)) return;
    } else if (offer.type === 'joker') {
      if (offer.cardId !== 'Joker-1' && offer.cardId !== 'Joker-2') return;
    } else if (offer.type === 'suit') {
      parseCard(offer.cardId);
    }

    const mode = this.state.settings.cardShopConflictMode ?? 'coin_flip';

    /** Black Friday: first payer gets immediate delivery (sold out locks the row). */
    if (mode === 'black_friday') {
      const nextHand = [...player.hand];
      const nextPowers = [...player.powerCards];
      if (offer.type === 'curse') {
        nextPowers.push(offer.curseId);
      } else if (offer.type === 'major') {
        nextPowers.push(offer.powerId);
      } else {
        nextHand.push(offer.cardId);
      }

      this.state = {
        ...this.state,
        cardShop: {
          ...shop,
          slots: {
            ...shop.slots,
            [slotId]: { ...slot, soldOut: true },
          },
        },
        players: {
          ...this.state.players,
          [uid]: {
            ...player,
            hand: nextHand,
            powerCards: nextPowers,
            tokenBalance: balance - price,
          },
        },
        updatedAt: Date.now(),
      };
      this.broadcastState();
      return;
    }

    const packCardId = shopPackCardId(slotId);
    if (player.hand.includes(packCardId)) return;

    const turnNow = typeof this.state.currentTurn === 'number' && Number.isFinite(this.state.currentTurn) ? this.state.currentTurn : 1;
    const existing = [...(this.state.pendingCardShopPurchases ?? [])];
    if (existing.some((p) => p.uid === uid && p.slotId === slotId && p.scheduledResolveTurn === turnNow)) return;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [uid]: {
          ...player,
          hand: [...player.hand, packCardId],
          tokenBalance: balance - price,
        },
      },
      pendingCardShopPurchases: [
        ...existing,
        { uid, slotId, tokensPaid: price, scheduledResolveTurn: turnNow },
      ],
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  /**
   * Coin Flip shop mode: when a trick resolves, packs bought during that trick (`scheduledResolveTurn === completingTurn`)
   * open â€” solo buyer gets delivery; paired buyers flip for the offer and the loser is refunded.
   */
  private flushCoinFlipShopPurchases(args: {
    completingTurn: number;
    players: Record<string, PlayerData>;
    cardShop: CardShopState;
    pendingAll: PendingCardShopPurchase[];
  }): { cardShop: CardShopState; pendingRemaining: PendingCardShopPurchase[]; extraEvents: ResolutionEvent[] } {
    const { players, cardShop, pendingAll } = args;
    const pendingRemaining = pendingAll.filter((p) => p.scheduledResolveTurn !== args.completingTurn);
    const due = pendingAll.filter((p) => p.scheduledResolveTurn === args.completingTurn);
    const extraEvents: ResolutionEvent[] = [];

    if (due.length === 0) {
      return { cardShop, pendingRemaining, extraEvents: [] };
    }

    let slots: CardShopState['slots'] = { ...cardShop.slots };

    const bySlot = new Map<string, PendingCardShopPurchase[]>();
    for (const p of due) {
      const list = bySlot.get(p.slotId) ?? [];
      list.push(p);
      bySlot.set(p.slotId, list);
    }

    const stripPackOnce = (hand: string[], slotIdS: string) => {
      const pid = shopPackCardId(slotIdS);
      const i = hand.indexOf(pid);
      if (i === -1) return false;
      hand.splice(i, 1);
      return true;
    };

    const nameOf = (u: string) => players[u]?.name ?? 'Player';

    const applyGrantOffer = (uidW: string, slotIdW: string): boolean => {
      const slotLive = slots[slotIdW];
      if (!slotLive || slotLive.soldOut) return false;
      const pl = players[uidW];
      if (!pl) return false;
      const { offer } = slotLive;
      if (offer.type === 'curse') {
        pl.powerCards = [...pl.powerCards, offer.curseId];
      } else if (offer.type === 'major') {
        pl.powerCards = [...pl.powerCards, offer.powerId];
      } else {
        pl.hand = [...pl.hand, offer.cardId];
      }
      slots = {
        ...slots,
        [slotIdW]: { ...slotLive, soldOut: true },
      };
      return true;
    };

    for (const [slotIdS, entries] of bySlot) {
      const slotLive = slots[slotIdS];
      if (!slotLive || slotLive.soldOut) {
        for (const e of entries) {
          const pl = players[e.uid];
          if (!pl) continue;
          stripPackOnce(pl.hand, slotIdS);
          pl.tokenBalance = (pl.tokenBalance ?? 0) + e.tokensPaid;
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)}: Cash Chips shelf unavailable â€” refunded ${e.tokensPaid} tokens.`,
          });
        }
        continue;
      }

      const dedupByUid = new Map<string, PendingCardShopPurchase>();
      for (const e of entries) {
        if (!dedupByUid.has(e.uid)) dedupByUid.set(e.uid, e);
      }
      const contenders = [...dedupByUid.values()];
      const offerLabel = describeShopOfferLine(slotLive.offer);

      if (contenders.length === 1) {
        const e = contenders[0]!;
        const pl = players[e.uid];
        if (!pl) continue;
        if (!stripPackOnce(pl.hand, slotIdS)) {
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)}: shop pack missing â€” refunded ${e.tokensPaid} chips.`,
          });
          pl.tokenBalance = (pl.tokenBalance ?? 0) + e.tokensPaid;
          continue;
        }
        if (applyGrantOffer(e.uid, slotIdS)) {
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)} unwraps Cash Chips (${offerLabel}).`,
          });
        } else {
          pl.tokenBalance = (pl.tokenBalance ?? 0) + e.tokensPaid;
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)} delivery failed â€” refunded ${e.tokensPaid} chips.`,
          });
        }
        continue;
      }

      const a = contenders[0]!;
      const b = contenders[1]!;
      /** First queued player = Heads, second = Tails (`1dc` coin: value 1 = heads, 0 = tails). */
      const headsUid = a.uid;
      const tailsUid = b.uid;
      extraEvents.push({
        type: 'COIN_FLIP',
        message: `Cash Chips â€” contested delivery\n${nameOf(headsUid)} â†’ Heads\n${nameOf(tailsUid)} â†’ Tails\nFlipping silver coinâ€¦`,
      });

      const plA = players[a.uid];
      const plB = players[b.uid];
      if (!plA || !plB) continue;

      const pk = shopPackCardId(slotIdS);
      const readyA = plA.hand.includes(pk);
      const readyB = plB.hand.includes(pk);
      if (!readyA || !readyB) {
        stripPackOnce(plA.hand, slotIdS);
        stripPackOnce(plB.hand, slotIdS);
        plA.tokenBalance = (plA.tokenBalance ?? 0) + a.tokensPaid;
        plB.tokenBalance = (plB.tokenBalance ?? 0) + b.tokensPaid;
        extraEvents.push({
          type: 'COIN_FLIP',
          message: `Contest dropped â€” missing packs; both players refunded their stakes.`,
        });
        continue;
      }
      stripPackOnce(plA.hand, slotIdS);
      stripPackOnce(plB.hand, slotIdS);

      const coinUp: 0 | 1 = Math.random() < 0.5 ? 1 : 0;
      const winnerEntry = coinUp === 1 ? a : b;
      const loserEntry = winnerEntry.uid === a.uid ? b : a;
      players[loserEntry.uid].tokenBalance = (players[loserEntry.uid].tokenBalance ?? 0) + loserEntry.tokensPaid;

      extraEvents.push({
        type: 'COIN_FLIP',
        coinFlipSides: { headsUid, tailsUid },
        message: `${nameOf(winnerEntry.uid)} wins â€” unwraps Cash Chips (${offerLabel}).\n${nameOf(loserEntry.uid)} refunded ${loserEntry.tokensPaid} chips. Coin: ${coinUp === 1 ? 'Heads' : 'Tails'} (${coinUp === 1 ? nameOf(headsUid) : nameOf(tailsUid)}).`,
        resolutionDice: [coinUp],
      });

      if (!applyGrantOffer(winnerEntry.uid, slotIdS)) {
        players[winnerEntry.uid].tokenBalance = (players[winnerEntry.uid].tokenBalance ?? 0) + winnerEntry.tokensPaid;
        extraEvents.push({
          type: 'COIN_FLIP',
          message: `${nameOf(winnerEntry.uid)} could not collect â€” refunded ${winnerEntry.tokensPaid} chips.`,
        });
      }
    }

    return { cardShop: { ...cardShop, slots }, pendingRemaining, extraEvents };
  }

  async playCard(cardId: string) {
    if (this.isHost) {
      this.processMove(this.myUid, cardId);
    } else {
      const me = this.state?.players?.[this.myUid];
      if (this.state && me && !me.confirmed && me.hand.includes(cardId)) {
        this.state = {
          ...this.state,
          players: {
            ...this.state.players,
            [this.myUid]: {
              ...me,
              currentMove: cardId,
              confirmed: true,
            },
          },
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'PLAY_CARD', uid: this.myUid, cardId });
    }
  }

  async reorderHand(newHandOrder: string[]) {
    if (this.isHost) {
      this.processReorderHand(this.myUid, newHandOrder);
    } else {
      this.sendEvent({ type: 'REORDER_HAND', uid: this.myUid, hand: newHandOrder });
    }
  }

  /** Burn a hand card into the Sacrificial Bowl (host-authoritative). */
  async burnSacrificialBowlCard(handIndex: number) {
    if (this.isHost) {
      this.processSacrificialBowlBurn(this.myUid, handIndex);
    } else {
      this.sendEvent({ type: 'SACRIFICIAL_BOWL_BURN', uid: this.myUid, handIndex });
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

  onDiceTestRollEvent(handler: ((payload: DiceTestRollPayload) => void) | null) {
    this.onDiceTestRoll = handler;
  }

  async setCardShopOpen(open: boolean) {
    if (this.isHost) {
      this.handleCardShopSetBrowsing(this.myUid, open);
    } else {
      this.sendEvent({ type: 'CARD_SHOP_SET_OPEN', uid: this.myUid, open });
    }
  }

  /** Normalized viewport pointer while this client has the cash shop open (throttle on the caller). */
  sendShopCursor(nx: number, ny: number) {
    if (!this.state?.settings.enablePokerChips) return;
    const shoppers = this.normalizeCardShopBrowsersUids();
    if (!shoppers.includes(this.myUid) || shoppers.length < 2) return;
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));
    if (this.isHost) {
      this.handleShopCursorDirect(this.myUid, cx, cy);
    } else {
      this.sendEvent({ type: 'SHOP_CURSOR', uid: this.myUid, nx: cx, ny: cy });
    }
  }

  async buyCardShopSlot(slotId: string) {
    if (this.isHost) {
      this.tryPurchaseCardShopSlot(this.myUid, slotId);
    } else {
      this.sendEvent({ type: 'CARD_SHOP_BUY', uid: this.myUid, slotId });
    }
  }

  async usePanicDice() {
    if (this.isHost) this.handlePanicDiceUse(this.myUid);
    else this.sendEvent({ type: 'USE_PANIC_DICE', uid: this.myUid });
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
      const me = this.state?.players?.[this.myUid];
      if (
        this.state &&
        me &&
        (powerCardId === null || me.powerCards.includes(powerCardId))
      ) {
        this.state = {
          ...this.state,
          players: {
            ...this.state.players,
            [this.myUid]: {
              ...me,
              currentPowerCard: powerCardId,
            },
          },
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
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

  async cheatActivateCurseOnTable(curseId: number) {
    if (!isCurseCardId(curseId)) return;
    if (this.isHost) {
      this.handleCheatActivateCurse(curseId);
    } else {
      this.sendEvent({ type: 'CHEAT_ACTIVATE_CURSE', uid: this.myUid, curseId });
    }
  }

  async cheatClearActiveCursesOnTable() {
    if (this.isHost) {
      this.handleCheatClearActiveCurses();
    } else {
      this.sendEvent({ type: 'CHEAT_CLEAR_ACTIVE_CURSES', uid: this.myUid });
    }
  }

  /** Dev: initial `ActiveCurseState` entries mirroring legal post-resolution state. */
  private freshCheatedActiveCurseLayer(curseId: number): ActiveCurseState {
    return createFreshCurseState(curseId);
  }

  private handleCheatActivateCurse(curseId: number) {
    if (!this.state?.players || !this.isHost || !isCurseCardId(curseId)) return;
    if (this.state.settings.enableCurseCards === false) return;
    const okStatuses: RoomData['status'][] = ['playing', 'powering', 'results'];
    if (!okStatuses.includes(this.state.status)) return;

    const layer = this.freshCheatedActiveCurseLayer(curseId);
    let nextActive = [...(this.state.activeCurses ?? [])];
    const envyTableCheat = curseId === CURSE_ENVY || curseId === CURSE_GREEN_EYED_MONSTER;
    if (envyTableCheat) {
      nextActive = nextActive.filter((c) => c.id !== CURSE_ENVY);
      nextActive.push(layer);
    } else {
      const ix = nextActive.findIndex((c) => c.id === curseId);
      if (ix >= 0) nextActive[ix] = layer;
      else nextActive.push(layer);
    }

    let deck = [...this.state.deck];
    let greedInjected = this.state.greedInjectedCoins;
    if (curseId === CURSE_GREED && (!greedInjected || greedInjected.length === 0)) {
      const coinCards = VALUES.map((v) => `Coins-${v}`);
      greedInjected = coinCards;
      deck.push(...coinCards);
      deck = shuffle(deck);
    }

    let prideCeilingCard = this.state.prideCeilingCard ?? null;
    if (curseId === CURSE_PRIDE) {
      const ts = this.state.targetSuit ?? SUITS[Math.floor(Math.random() * SUITS.length)];
      prideCeilingCard = `${ts}-${VALUES[Math.floor(Math.random() * VALUES.length)]}`;
    }

    const uids = Object.keys(this.state.players);
    let wrathTargetUid = this.state.wrathTargetUid ?? null;
    let wrathMinionCard = this.state.wrathMinionCard ?? null;
    if (curseId === CURSE_WRATH && uids.length >= 2) {
      wrathTargetUid = uids[Math.floor(Math.random() * uids.length)];
      wrathMinionCard = wrathMinionCardForRound(1);
    }

    let availableSuits = [...(this.state.availableSuits ?? SUITS)];
    let slothSavedAvailableSuits = this.state.slothSavedAvailableSuits ?? null;
    if (curseId === CURSE_SLOTH) {
      if (!slothCurseActive(this.state.activeCurses ?? []) && availableSuits.length > 0) {
        slothSavedAvailableSuits = [...availableSuits];
      }
      availableSuits = ['Stars', 'Moons'];
    }

    let nextEnvyCovet: RoomData['envyCovet'] = null;
    if (envyCurseActive(nextActive)) {
      const cheatUids = Object.keys(this.state.players);
      const p1Uid = this.myUid;
      const p2Uid = cheatUids.find((id) => id !== p1Uid);
      if (p2Uid) {
        const tableSuit: Suit = this.state.targetSuit ?? 'Stars';
        const lustHeartRules = lustCurseActive(nextActive);
        const greedTaxActive = greedCurseActive(nextActive);
        const joint = greedTaxActive && tableSuit === 'Diamonds';
        nextEnvyCovet = pickEnvyCovetedForRound(
          this.state.players,
          p1Uid,
          p2Uid,
          tableSuit,
          this.state.envySealedCards,
          lustHeartRules,
          greedTaxActive,
          joint,
        );
      }
    }

    this.state = {
      ...this.state,
      activeCurses: nextActive,
      deck,
      greedInjectedCoins: greedInjected,
      prideCeilingCard,
      wrathTargetUid,
      wrathMinionCard,
      availableSuits,
      slothSavedAvailableSuits,
      envyCovet: nextEnvyCovet,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private handleCheatClearActiveCurses() {
    if (!this.state?.players || !this.isHost) return;
    const okStatuses: RoomData['status'][] = ['playing', 'powering', 'results'];
    if (!okStatuses.includes(this.state.status)) return;
    const hadSloth = slothCurseActive(this.state.activeCurses ?? []);

    let availableSuits =
      hadSloth && this.state.slothSavedAvailableSuits?.length
        ? [...this.state.slothSavedAvailableSuits]
        : [...(this.state.availableSuits ?? SUITS)];

    let deck = [...this.state.deck];
    const greedy = new Set(this.state.greedInjectedCoins ?? []);
    if (greedy.size > 0) {
      deck = deck.filter((c) => !greedy.has(c));
    }

    this.state = {
      ...this.state,
      activeCurses: [],
      prideCeilingCard: null,
      wrathTargetUid: null,
      wrathMinionCard: null,
      greedInjectedCoins: undefined,
      envyCovet: null,
      envySealedCards: {},
      envyBothGrovelTrap: false,
      slothSavedAvailableSuits: null,
      availableSuits,
      deck,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  async submitPowerDecision(option: string, wheelOffset?: number, priestessSwapToCard?: string | null) {
    if (this.isHost) {
      this.handleSubmitPowerDecision(this.myUid, option, wheelOffset, priestessSwapToCard);
    } else {
      const state = this.state;
      const pending = state?.pendingPowerDecisions?.[this.myUid];
      if (
        state &&
        state.status === 'powering' &&
        pending &&
        pending.selectedOption === null &&
        (pending.options.includes(option) || option === 'SPIN_WHEEL') &&
        !pending.disabledReasons?.[option]
      ) {
        const nextPendingAll = { ...(state.pendingPowerDecisions ?? {}) };
        const nextPendingSelf: PendingPowerDecision = { ...pending, selectedOption: option };
        if (nextPendingSelf.powerCardId === 10) {
          const resolvedOffset = typeof wheelOffset === 'number' ? wheelOffset : Math.random();
          nextPendingSelf.wheelOffset = resolvedOffset;
          nextPendingSelf.wheelResult = this.getWheelOutcome(resolvedOffset);
        }
        if (nextPendingSelf.powerCardId === 2) {
          nextPendingSelf.priestessSwapToCard =
            typeof priestessSwapToCard === 'string' && priestessSwapToCard.trim() !== ''
              ? priestessSwapToCard
              : null;
        }
        nextPendingAll[this.myUid] = nextPendingSelf;
        this.state = {
          ...state,
          pendingPowerDecisions: nextPendingAll,
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'SUBMIT_POWER_DECISION', uid: this.myUid, option, wheelOffset, priestessSwapToCard });
    }
  }

  private static normalizeChatBody(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim().slice(0, 280);
  }

  private handleChatMessage(uid: string, text: string) {
    if (!this.state || !this.state.players[uid]) return;
    const body = GameService.normalizeChatBody(text);
    if (!body) return;
    const name = this.state.players[uid].name;
    const entry: ChatMessageEntry = { uid, name, text: body, at: Date.now() };
    const prev = this.state.chatMessages ?? [];
    this.state = {
      ...this.state,
      chatMessages: [...prev, entry].slice(-40),
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  async sendChat(rawText: string) {
    const text = GameService.normalizeChatBody(rawText);
    if (!text) return;
    if (this.isHost) {
      this.handleChatMessage(this.myUid, text);
    } else {
      /** Optimistic echo: guest sees their line immediately; next STATE_UPDATE replaces full history. */
      if (this.state?.players[this.myUid]) {
        const name = this.state.players[this.myUid].name;
        const entry: ChatMessageEntry = { uid: this.myUid, name, text, at: Date.now() };
        const prev = this.state.chatMessages ?? [];
        this.state = {
          ...this.state,
          chatMessages: [...prev, entry].slice(-40),
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'SEND_CHAT', uid: this.myUid, text });
    }
  }

  /**
   * Mitigate Chrome tab throttling / missed P2P deliveries: host rebroadcasts; guest asks host for a snapshot.
   * Called from visibility + online handlers while a match is active.
   */
  notifySessionResync(_reason?: string) {
    void _reason;
    if (!this.state) return;
    const conn = this.connection as (DataConnection & { open?: boolean }) | null;
    if (!conn?.open) return;

    const now = Date.now();
    if (this.isHost) {
      if (now - this.lastHostSessionResyncAt < 900) return;
      this.lastHostSessionResyncAt = now;
      this.broadcastState();
      return;
    }
    if (now - this.lastGuestSessionResyncRequestAt < 500) return;
    this.lastGuestSessionResyncRequestAt = now;
    this.sendEvent({ type: 'REQUEST_STATE_SYNC', uid: this.myUid });
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
    if (
      powerCardId !== null &&
      isCurseCardId(powerCardId) &&
      this.state.settings.enableCurseCards === false
    ) {
      return;
    }
    if (
      powerCardId !== null &&
      isCurseCardId(powerCardId) &&
      curseEffectActive(this.state.activeCurses)
    ) {
      return;
    }
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
    const slices = FORTUNE_GAME_SLICES;
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

      if (isCurseCardId(power)) {
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
        if (oppUsesPower && realPowerId !== null && isMajorArcanaId(realPowerId)) {
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
        decisions[uid] = {
          powerCardId: 15,
          options: ['DEVIL_KING', 'DEVIL_RANDOMIZE'],
          disabledReasons: {
            DEVIL_KING: '',
            DEVIL_RANDOMIZE: '',
          },
          selectedOption: null,
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
        const curseOk = this.state.settings.enableCurseCards !== false;
        if (
          curseOk &&
          envyCurseActive(this.state.activeCurses ?? []) &&
          envyFreeCopiesInHand(player.hand, uid, swapAccepted, this.state.envySealedCards) <= 0
        ) {
          swapAccepted = null;
        }
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

  /** HUD dice overlay (@3d-dice/dice-box-threejs pip dice + forced totals). */
  private broadcastHudDiceRoll(payload: DiceTestRollPayload) {
    this.onDiceTestRoll?.(payload);
    this.sendEvent({
      type: 'ROLL_DICE_TEST_BROADCAST',
      uid: payload.uid,
      rollId: payload.rollId,
      notation: payload.notation,
      dice: payload.dice,
      total: payload.total,
      startedAt: payload.startedAt,
      presentation: payload.presentation,
    });
  }

  private handlePanicDiceUse(uid: string) {
    if (!this.state || !this.isHost || this.state.status !== 'results' || !this.state.lastOutcome) return;

    const room = this.state;
    const me = room.players[uid];
    if (!me || me.panicDiceUsed || me.readyForNextRound) return;
    if (!room.settings.enablePanicDice || !panicDiceSeatAllowed(room, uid)) return;

    const oppUid = Object.keys(room.players).find((id) => id !== uid);
    if (!oppUid) return;

    const prev = room.lastOutcome;
    const oppCard = prev.cardsPlayed[oppUid];
    const hostUid = room.hostUid;
    const guestUid = Object.keys(room.players).find((id) => id !== hostUid)!;

    if (!oppCard || typeof oppCard !== 'string') return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;
    const panicCard = panicDiceTotalToCardId(total);
    const rollId = `panic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const greedTaxActive =
      room.settings.enableCurseCards !== false && greedCurseActive(room.activeCurses ?? []);

    const lustReplay = lustReplayContextFromOutcome(room, prev, hostUid, guestUid);

    let wrathPenOpp = 0;
    if (prev.wrathFx?.targetUid === oppUid && prev.wrathFx.minionCard) {
      const pc = parseCard(oppCard);
      if (!pc.isJoker && oppCard !== GROVEL_CARD_ID) {
        wrathPenOpp = getWrathMagnitude(prev.wrathFx.minionCard);
      }
    }

    const combat = computePanicCombatEffects({
      panicCardId: panicCard,
      opponentCardId: oppCard,
      opponentWrathPenalty: wrathPenOpp,
      greedTaxActive,
      opponentLustBump: lustReplay.lhPlayed(oppCard),
    });

    const extras: Record<string, number> = { [hostUid]: 0, [guestUid]: 0 };
    extras[oppUid] = combat.extraOpponentPenalty;

    /** Keep both playersâ€™ committed suit cards â€” panic only applies clash penalty to the opponent of the roller. */
    const panicFrozenCardsPlayed = { ...prev.cardsPlayed };

    const nw = resolveFrozenTrickWinnerForPanic({
      roomData: room,
      hostUid,
      guestUid,
      frozen: {
        cardsPlayed: panicFrozenCardsPlayed,
        summonedCards: prev.summonedCards,
        targetSuit: prev.targetSuit,
        wrathFx: prev.wrathFx,
      },
      extraClashPenaltyByUid: extras,
      lustReplay,
    });

    const tableauDisplay = panicClashDisplayedCardPair({
      panicCardId: panicCard,
      opponentCardId: oppCard,
      opponentWrathPenalty: wrathPenOpp,
      greedTaxActive,
      opponentLustBump: lustReplay.lhPlayed(oppCard),
    });
    const nextCardsPlayedVisual = {
      ...prev.cardsPlayed,
      [oppUid]: combat.opponentDestroyed ? '' : tableauDisplay.opponentDisplayed,
    };

    const clashDestroyed: Record<string, boolean> = { ...(prev.clashDestroyedByPenalty ?? {}) };
    if (!parseCard(oppCard).isJoker && oppCard !== GROVEL_CARD_ID) {
      clashDestroyed[oppUid] = combat.opponentDestroyed;
    }

    let finalMessage: string;
    if (nw === 'draw') {
      finalMessage = 'Panic dice â€” the field deadlocks again.';
    } else {
      const loserUid = nw === hostUid ? guestUid : hostUid;
      /** Tableau strings already encode post-panic printed ranks â€” do not double-apply clash penalties in the sentence. */
      let winnerCard = panicFrozenCardsPlayed[nw];
      let loserCard = panicFrozenCardsPlayed[loserUid];
      if (nw === uid) winnerCard = tableauDisplay.panicDisplayed;
      else if (nw === oppUid) winnerCard = combat.opponentDestroyed ? '' : tableauDisplay.opponentDisplayed;
      if (loserUid === uid) loserCard = tableauDisplay.panicDisplayed;
      else if (loserUid === oppUid) loserCard = combat.opponentDestroyed ? '' : tableauDisplay.opponentDisplayed;

      finalMessage = `${room.players[nw].name} wins â€” ${explainPlainClash(
        winnerCard,
        loserCard,
        prev.targetSuit,
        lustReplay.lustHeartRules,
        greedTaxActive,
        greedTaxActive && prev.targetSuit === 'Diamonds',
        [lustReplay.lhPlayed(winnerCard), lustReplay.lhPlayed(loserCard)],
        [0, 0],
      )}`;
    }
    const clashPenByUid: Record<string, number> = {
      [hostUid]:
        (prev.wrathFx?.targetUid === hostUid && prev.wrathFx?.minionCard
          ? getWrathMagnitude(prev.wrathFx.minionCard)
          : 0) + (extras[hostUid] ?? 0),
      [guestUid]:
        (prev.wrathFx?.targetUid === guestUid && prev.wrathFx?.minionCard
          ? getWrathMagnitude(prev.wrathFx.minionCard)
          : 0) + (extras[guestUid] ?? 0),
    };
    const tokenByUid = computeOverkillTokenAward({
      p1Uid: hostUid,
      p2Uid: guestUid,
      c1: panicFrozenCardsPlayed[hostUid],
      c2: panicFrozenCardsPlayed[guestUid],
      targetSuit: prev.targetSuit,
      greedJointTrump: greedTaxActive && prev.targetSuit === 'Diamonds',
      greedTaxActive,
      clashPenaltyByUid: clashPenByUid,
      lustPlayedByUid: {
        [hostUid]: lustReplay.lhPlayed(panicFrozenCardsPlayed[hostUid]),
        [guestUid]: lustReplay.lhPlayed(panicFrozenCardsPlayed[guestUid]),
      },
    });

    // Panic re-resolution must not carry stale rewards from the pre-panic snapshot.
    const gains: NonNullable<RoomData['lastOutcome']>['gains'] = { [hostUid]: [], [guestUid]: [] };
    if (nw !== 'draw' && nw) {
      const loserUid = nw === hostUid ? guestUid : hostUid;
      if (room.famineActive) gains[loserUid].push({ type: 'draw', id: -1 });
      else gains[nw].push({ type: 'draw', id: 'standard' });
    }
    for (const uid of [hostUid, guestUid]) {
      const n = tokenByUid[uid] ?? 0;
      if (n > 0) gains[uid].push({ type: 'token', id: n });
    }

    if (nw !== 'draw') {
      const tn = tokenByUid[nw] ?? 0;
      if (tn > 0) finalMessage += ` (+${tn} token${tn === 1 ? '' : 's'})`;
    }
    if (combat.opponentDestroyed) {
      finalMessage += ` ${room.players[oppUid].name}'s card was destroyed!`;
    }

    const panicLine: ResolutionEvent = {
      type: 'POWER_TRIGGER',
      message: `${room.players[uid].name} rolls panic dice (${d1}+${d2}=${total}) â€” ${compactCardLabel(panicCard)} clashes with ${room.players[oppUid].name}'s play (${combat.exchanges} exchanges).`,
    };
    const panicDestroyEvents: ResolutionEvent[] = [];
    if (combat.opponentDestroyed) {
      panicDestroyEvents.push({
        type: 'CLASH_DESTROYED',
        uid: oppUid,
        cardId: oppCard,
        message: `${room.players[oppUid].name}'s card was destroyed by panic clash.`,
      });
    }

    const nextOutcome: NonNullable<RoomData['lastOutcome']> = {
      ...prev,
      winnerUid: nw,
      message: finalMessage,
      gains,
      cardsPlayed: nextCardsPlayedVisual,
      clashDestroyedByPenalty: clashDestroyed,
      events: [...prev.events, panicLine, ...panicDestroyEvents],
      panicFx: {
        attackerUid: uid,
        opponentUid: oppUid,
        panicCardId: panicCard,
        dice: [d1, d2],
        diceRollId: rollId,
        exchanges: combat.exchanges,
        panicDestroyed: combat.panicDestroyed,
        opponentDestroyed: combat.opponentDestroyed,
        extraOpponentPenalty: combat.extraOpponentPenalty,
      },
    };

    const updatedPlayers = { ...room.players };
    for (const u of [hostUid, guestUid]) {
      const p = updatedPlayers[u];
      updatedPlayers[u] = {
        ...p,
        readyForNextRound: false,
        panicDiceUsed: u === uid ? true : p.panicDiceUsed,
      };
    }

    this.broadcastHudDiceRoll({
      uid,
      rollId,
      notation: '2dpip',
      dice: [d1, d2],
      total,
      startedAt: Date.now(),
    });

    this.state = {
      ...room,
      players: updatedPlayers,
      lastOutcome: nextOutcome,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }


  private calculateOutcome(roomData: RoomData, players: Record<string, PlayerData>) {
    return calculateRoundOutcome(this.myUid, roomData, players);
  }


  private applyRoundResults(roomData: RoomData, players: Record<string, PlayerData>): RoomData {
    const outcome = roomData.lastOutcome!;
    const uids = Object.keys(players);
    const updatedPlayers = { ...players };
    const p1Uid = this.myUid;
    const p2Uid = uids.find(id => id !== p1Uid)!;
    const newDeck = [...roomData.deck];
    const powerDeck = [...roomData.powerDeck];
    let cardShopForRefresh: CardShopState | null | undefined = roomData.cardShop ?? undefined;
    let pendingAfterFlush: PendingCardShopPurchase[] | undefined = roomData.pendingCardShopPurchases ?? undefined;

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
    const curseOk = roomData.settings.enableCurseCards !== false;
    const gluttonyWasActiveForRound = curseOk && gluttonyCurseActive(roomData.activeCurses);

    let nextTyrant: RoomData['tyrantCrownPending'] = roomData.tyrantCrownPending;
    let nextGreedInjected: RoomData['greedInjectedCoins'] = roomData.greedInjectedCoins;
    let outcomeForState: NonNullable<RoomData['lastOutcome']> = outcome;

    const greedPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_GREED &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_GREED &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    const pridePlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_PRIDE &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_PRIDE &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    // NOTE: Power-card post-round gains are authored in `calculateOutcome(...).gains`
    // and applied below in the generic gains pass. Keep this section side-effect free
    // to avoid duplicate grants (e.g. Chariot, Empress, Sun).

    const hostUid = roomData.hostUid;
    const guestUid = uids.find(id => id !== hostUid)!;

    /** Deck pulls from numbered draws + winner â€œstandardâ€; host and guest alternate so neither eats the deck first. */
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
          } else if (gain.id === 'world-curse') {
            const pool = shuffle([...CURSE_IDS]);
            if (pool.length > 0) updatedPlayers[uid].powerCards.push(pool[0]!);
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
        } else if (gain.type === 'token' && typeof gain.id === 'number' && gain.id > 0) {
          updatedPlayers[uid].tokenBalance = (updatedPlayers[uid].tokenBalance ?? 0) + gain.id;
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

    const slothDreamEnds =
      curseOk &&
      outcome.slothDreamFx?.result === 'SUN' &&
      slothCurseActive(roomData.activeCurses ?? []);

    let availableSuits = [...(roomData.availableSuits || SUITS)];
    if (slothDreamEnds) {
      const saved = roomData.slothSavedAvailableSuits;
      availableSuits = saved && saved.length > 0 ? [...saved] : [...SUITS];
    }

    uids.forEach((uid) => {
      const power = outcome.powerCardIdsPlayed[uid];
      if (power === 17 && !availableSuits.includes('Stars')) {
        availableSuits.push('Stars');
      }
      if (power === 18 && !availableSuits.includes('Moons')) {
        availableSuits.push('Moons');
        const moonCards = VALUES.map((v) => `Moons-${v}`);
        newDeck.push(...moonCards);
      }
    });

    if (greedPlayed) {
      const coinCards = VALUES.map((v) => `Coins-${v}`);
      nextGreedInjected = coinCards;
      newDeck.push(...shuffle([...coinCards]));
    }

    if (newDeck.length > roomData.deck.length) {
      // If we added cards, reshuffle
      const shuffledDeck = shuffle(newDeck);
      newDeck.length = 0;
      newDeck.push(...shuffledDeck);
    }

    if (temperanceActive || gluttonyWasActiveForRound) {
      uids.forEach((uid) => {
        const lockedId = outcome.initialCardsPlayed?.[uid];
        const finalId = outcome.cardsPlayed[uid];
        if (!finalId && !lockedId) return;

        const heartEngaged =
          lockedId != null ? parseCard(lockedId).suit === 'Hearts' : parseCard(finalId!).suit === 'Hearts';
        const digest =
          gluttonyWasActiveForRound && heartEngaged && finalId != null && !parseCard(finalId).isJoker;
        const boneFromDigest =
          digest && typeof finalId === 'string' ? `Bones-${parseCard(finalId).value}` : null;

        const alreadyFromGains =
          boneFromDigest != null &&
          (outcome.gains?.[uid] ?? []).some((g) => g.type === 'card' && g.id === boneFromDigest);

        if (alreadyFromGains) {
          return;
        }

        if (temperanceActive) {
          if (digest && boneFromDigest) {
            updatedPlayers[uid].hand.push(boneFromDigest);
          } else {
            updatedPlayers[uid].hand.push(finalId!);
          }
        } else if (digest && boneFromDigest) {
          updatedPlayers[uid].hand.push(boneFromDigest);
        }
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

    if (curseOk && nextTyrant && winnerUid !== 'draw') {
      updatedPlayers[winnerUid].hand.push('Crowns-E');
      nextTyrant = undefined;
    }

    let nextActiveCurses: ActiveCurseState[] = curseOk ? [...(roomData.activeCurses ?? [])] : [];
    const hadCurseEnteringApply = curseOk && curseEffectActive(roomData.activeCurses ?? []);
    let nextSlothSaved: Suit[] | null | undefined = roomData.slothSavedAvailableSuits ?? null;
    let nextEnvySealed = mergeEnvySealDeltas(roomData.envySealedCards, outcome.envyRoundFx?.newSeals);
    if (outcome.envyRoundFx?.defeated || outcome.envyRoundFx?.departedDoubleGrovel) {
      nextEnvySealed = {};
    }

    const lustPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_LUST &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_LUST &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));
    if (lustPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_LUST);
      if (ix < 0) nextActiveCurses.push({ id: CURSE_LUST, lustAccumulated: 0 });
    }

    const gluttonyPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_GLUTTONY &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_GLUTTONY &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));
    if (gluttonyPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GLUTTONY);
      const fresh: ActiveCurseState = { id: CURSE_GLUTTONY, gluttonyPhase: 0, gluttonyNoHeartStreak: 0 };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }
    if (greedPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GREED);
      const fresh: ActiveCurseState = { id: CURSE_GREED, greedCrown: 0 };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }
    if (pridePlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_PRIDE);
      const fresh: ActiveCurseState = { id: CURSE_PRIDE };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }

    const envyPlayed =
      curseOk &&
      ((cursePlayedActivatesEnvyTable(outcome.powerCardIdsPlayed[p1Uid]) &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (cursePlayedActivatesEnvyTable(outcome.powerCardIdsPlayed[p2Uid]) &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    if (envyPlayed) {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_ENVY);
      nextActiveCurses.push({ id: CURSE_ENVY, envyMonsterHp: ENVY_MONSTER_START_HP });
    }

    if (curseOk && outcome.slothDreamFx?.result === 'SUN' && slothCurseActive(roomData.activeCurses ?? [])) {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_SLOTH);
      nextSlothSaved = null;
    }

    const slothPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_SLOTH &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_SLOTH &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    if (slothPlayed) {
      const hadSlothAtStart = slothCurseActive(roomData.activeCurses ?? []);
      const dreamSunEnded = outcome.slothDreamFx?.result === 'SUN';
      if (!hadSlothAtStart || dreamSunEnded) {
        nextSlothSaved = [...availableSuits];
      }
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_SLOTH);
      const fresh: ActiveCurseState = { id: CURSE_SLOTH };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }

    const wrathWasActiveAtStart = curseOk && wrathCurseActive(roomData.activeCurses);
    const wrathRoundAtStart = roomData.activeCurses?.find((c) => c.id === CURSE_WRATH)?.wrathRound ?? 1;

    const wrathPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_WRATH &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_WRATH &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    if (wrathPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_WRATH);
      const fresh: ActiveCurseState = { id: CURSE_WRATH, wrathRound: 1 };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }

    if (wrathWasActiveAtStart && !wrathPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_WRATH);
      if (ix >= 0) {
        if (wrathRoundAtStart >= 5) {
          nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_WRATH);
          outcomeForState = {
            ...outcomeForState,
            events: [
              ...outcomeForState.events,
              {
                type: 'POWER_TRIGGER',
                message: 'Wrath ends â€” the Warlord was the last stroke.',
              },
            ],
          };
        } else {
          nextActiveCurses[ix] = {
            ...nextActiveCurses[ix],
            wrathRound: wrathRoundAtStart + 1,
          };
        }
      }
    }

    const prideEndedByGrovel =
      curseOk &&
      prideCurseActive(roomData.activeCurses) &&
      (outcome.cardsPlayed[p1Uid] === GROVEL_CARD_ID || outcome.cardsPlayed[p2Uid] === GROVEL_CARD_ID);
    if (prideEndedByGrovel) {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_PRIDE);
      uids.forEach((uid) => {
        updatedPlayers[uid].hand = updatedPlayers[uid].hand.filter((c) => c !== GROVEL_CARD_ID);
      });
      outcomeForState = {
        ...outcomeForState,
        events: [
          ...outcomeForState.events,
          { type: 'POWER_TRIGGER', message: 'Pride ends â€” someone groveled.' },
        ],
      };
    }

    if (curseOk && outcome.gluttonyPersistence) {
      if (outcome.gluttonyPersistence.remove) {
        nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_GLUTTONY);
      } else {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GLUTTONY);
        if (ix >= 0) {
          nextActiveCurses[ix] = {
            ...nextActiveCurses[ix],
            gluttonyPhase: outcome.gluttonyPersistence.phase,
            gluttonyNoHeartStreak: outcome.gluttonyPersistence.streak,
          };
        }
      }
    }

    if (curseOk && outcome.lustRoundFx) {
      const { nextMeter, sated, heartsExhausted } = outcome.lustRoundFx;
      if (sated || heartsExhausted) {
        nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_LUST);
      } else {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_LUST);
        if (ix >= 0) {
          nextActiveCurses[ix] = { ...nextActiveCurses[ix], lustAccumulated: nextMeter };
        } else if (lustCurseActive(roomData.activeCurses ?? []) || lustPlayed) {
          nextActiveCurses.push({ id: CURSE_LUST, lustAccumulated: nextMeter });
        }
      }
    }

    if (curseOk && outcome.envyRoundFx && envyCurseActive(nextActiveCurses)) {
      const fx = outcome.envyRoundFx;
      if (fx.defeated || fx.departedDoubleGrovel) {
        nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_ENVY);
      } else {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_ENVY);
        if (ix >= 0) {
          nextActiveCurses[ix] = { ...nextActiveCurses[ix], envyMonsterHp: fx.monsterHpEnd };
        }
      }
    }

    if (curseOk && outcome.devilForcedCurseId !== undefined && !hadCurseEnteringApply) {
      const cid = outcome.devilForcedCurseId;
      const layer = createFreshCurseState(cid);
      const ixC =
        cid === CURSE_ENVY || cid === CURSE_GREEN_EYED_MONSTER
          ? nextActiveCurses.findIndex((c) => c.id === CURSE_ENVY)
          : nextActiveCurses.findIndex((c) => c.id === cid);
      if (ixC >= 0) nextActiveCurses[ixC] = layer;
      else nextActiveCurses.push(layer);

      if (cid === CURSE_GREED && (!nextGreedInjected || nextGreedInjected.length === 0)) {
        const coinCards = VALUES.map((v) => `Coins-${v}`);
        nextGreedInjected = coinCards;
        newDeck.push(...shuffle([...coinCards]));
        const rd = shuffle(newDeck);
        newDeck.length = 0;
        newDeck.push(...rd);
      }

      if (cid === CURSE_SLOTH && !slothCurseActive(roomData.activeCurses ?? [])) {
        nextSlothSaved = [...availableSuits];
        availableSuits = ['Stars', 'Moons'];
      }
    }

    const stripGreedInjectedFromDeck = () => {
      if (!nextGreedInjected?.length) return;
      const rm = new Set(nextGreedInjected);
      const filtered = newDeck.filter((c) => !rm.has(c));
      newDeck.length = 0;
      newDeck.push(...filtered);
      nextGreedInjected = undefined;
    };

    const finishGreedCurse = (crownTotal: number) => {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_GREED);
      stripGreedInjectedFromDeck();
      if (winnerUid === 'draw') {
        nextTyrant = { crownTotal };
      } else {
        updatedPlayers[winnerUid].hand.push('Crowns-E');
      }
    };

    if (curseOk && outcome.greedPersistence && greedCurseActive(roomData.activeCurses)) {
      if (outcome.greedPersistence.removeReason !== 'crown') {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GREED);
        if (ix >= 0) {
          nextActiveCurses[ix] = { ...nextActiveCurses[ix], greedCrown: outcome.greedPersistence.nextCrown };
        }
      }
    }

    if (
      curseOk &&
      outcome.greedPersistence?.removeReason === 'crown' &&
      greedCurseActive(roomData.activeCurses)
    ) {
      finishGreedCurse(outcome.greedPersistence.nextCrown);
    }

    if (
      roomData.settings.enablePokerChips === true &&
      roomData.settings.cardShopConflictMode === 'coin_flip' &&
      cardShopForRefresh &&
      pendingAfterFlush &&
      pendingAfterFlush.length > 0
    ) {
      const flush = this.flushCoinFlipShopPurchases({
        completingTurn: roomData.currentTurn,
        players: updatedPlayers,
        cardShop: cardShopForRefresh,
        pendingAll: pendingAfterFlush,
      });
      cardShopForRefresh = flush.cardShop;
      pendingAfterFlush = flush.pendingRemaining;
      outcomeForState = {
        ...outcomeForState,
        events: [...(outcomeForState.events ?? []), ...flush.extraEvents],
      };
    }

    if (curseOk && greedCurseActive(nextActiveCurses) && outcome.greedPersistence?.removeReason !== 'crown') {
      let diamCoin = 0;
      for (const c of newDeck) {
        const p = parseCard(c);
        if (!p.isJoker && (p.suit === 'Diamonds' || p.suit === 'Coins')) diamCoin += 1;
      }
      for (const uid of uids) {
        for (const c of updatedPlayers[uid].hand) {
          const p = parseCard(c);
          if (!p.isJoker && (p.suit === 'Diamonds' || p.suit === 'Coins')) diamCoin += 1;
        }
      }
      if (diamCoin === 0) {
        const entry = nextActiveCurses.find((c) => c.id === CURSE_GREED);
        finishGreedCurse(entry?.greedCrown ?? 0);
        outcomeForState = {
          ...outcome,
          events: [
            ...outcome.events,
            { type: 'POWER_TRIGGER', message: 'The Tyrant is dead. Only their crown remains.' },
          ],
        };
      }
    }

    if (curseOk && slothCurseActive(nextActiveCurses)) {
      availableSuits = ['Stars', 'Moons'];
    }

    const lustForWheel = curseOk && lustCurseActive(nextActiveCurses);
    const greedForWheel = curseOk && greedCurseActive(nextActiveCurses);
    const suitWeights = availableSuits.map((s) => {
      let w = s === 'Hearts' && lustForWheel ? 3 : 1;
      if (greedForWheel && (s === 'Hearts' || s === 'Clubs' || s === 'Spades')) {
        w *= 0.5;
      }
      return w;
    });
    const totalW = suitWeights.reduce((a, b) => a + b, 0) || 1;
    const wheelOffset = Math.random();
    const r = wheelOffset * totalW;
    let accPick = 0;
    let targetSuit = availableSuits[availableSuits.length - 1];
    for (let i = 0; i < availableSuits.length; i++) {
      accPick += suitWeights[i];
      if (r < accPick) {
        targetSuit = availableSuits[i];
        break;
      }
    }

    let nextPrideCeiling: string | null = null;
    if (curseOk && prideCurseActive(nextActiveCurses)) {
      const rank = VALUES[Math.floor(Math.random() * VALUES.length)];
      nextPrideCeiling = `${targetSuit}-${rank}`;
    }

    if (!curseOk || (!prideCurseActive(nextActiveCurses) && !envyCurseActive(nextActiveCurses))) {
      uids.forEach((uid) => {
        updatedPlayers[uid].hand = updatedPlayers[uid].hand.filter((c) => c !== GROVEL_CARD_ID);
      });
    } else if (nextPrideCeiling) {
      const lustNext = curseOk && lustCurseActive(nextActiveCurses);
      const greedNext = curseOk && greedCurseActive(nextActiveCurses);
      for (const uid of uids) {
        const hand = updatedPlayers[uid].hand;
        if (hand.includes(GROVEL_CARD_ID)) continue;
        if (!handHasLegalPridePlay(hand, nextPrideCeiling, lustNext, greedNext)) {
          updatedPlayers[uid].hand = [...hand, GROVEL_CARD_ID];
        }
      }
    }

    let nextEnvyBothTrap = false;
    if (curseOk && envyCurseActive(nextActiveCurses)) {
      const lustNext = curseOk && lustCurseActive(nextActiveCurses);
      const greedNext = curseOk && greedCurseActive(nextActiveCurses);
      const p1Trap = !handHasLegalEnvyPlay(updatedPlayers[p1Uid].hand, p1Uid, nextEnvySealed);
      const p2Trap = !handHasLegalEnvyPlay(updatedPlayers[p2Uid].hand, p2Uid, nextEnvySealed);
      for (const uid of uids) {
        const hand = updatedPlayers[uid].hand;
        if (hand.includes(GROVEL_CARD_ID)) continue;
        if (!handHasLegalEnvyPlay(hand, uid, nextEnvySealed)) {
          updatedPlayers[uid].hand = [...hand, GROVEL_CARD_ID];
        }
      }
      nextEnvyBothTrap = p1Trap && p2Trap;
    }

    let nextEnvyCovet: RoomData['envyCovet'] = null;
    if (curseOk && envyCurseActive(nextActiveCurses)) {
      const lustNext = curseOk && lustCurseActive(nextActiveCurses);
      const greedNext = curseOk && greedCurseActive(nextActiveCurses);
      const jointNext = greedNext && targetSuit === 'Diamonds';
      nextEnvyCovet = pickEnvyCovetedForRound(
        updatedPlayers,
        p1Uid,
        p2Uid,
        targetSuit,
        nextEnvySealed,
        lustNext,
        greedNext,
        jointNext,
      );
    }

    let nextWrathTarget: string | null = null;
    let nextWrathMinion: string | null = null;
    if (curseOk && wrathCurseActive(nextActiveCurses)) {
      const wrathEntry = nextActiveCurses.find((c) => c.id === CURSE_WRATH);
      const kr = wrathEntry?.wrathRound ?? 1;
      nextWrathMinion = wrathMinionCardForRound(kr);
      nextWrathTarget = Math.random() > 0.5 ? hostUid : guestUid;
    }

    const nextStatus = (updatedPlayers[p1Uid].hand.length === 0 || updatedPlayers[p2Uid].hand.length === 0) ? 'finished' : 'playing';
    let winner = roomData.winner;
    if (nextStatus === 'finished' && !winner) {
      if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length > 0) winner = p2Uid;
      else if (updatedPlayers[p2Uid].hand.length === 0 && updatedPlayers[p1Uid].hand.length > 0) winner = p1Uid;
      else if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length === 0 && outcome.winnerUid !== 'draw') winner = outcome.winnerUid;
    }

    if (
      nextStatus === 'finished' &&
      roomData.settings.enablePokerChips === true &&
      roomData.settings.cardShopConflictMode === 'coin_flip' &&
      pendingAfterFlush &&
      pendingAfterFlush.length > 0
    ) {
      const refundEv: ResolutionEvent[] = [];
      for (const p of pendingAfterFlush) {
        const pl = updatedPlayers[p.uid];
        if (!pl) continue;
        const pk = shopPackCardId(p.slotId);
        const ix = pl.hand.indexOf(pk);
        if (ix !== -1) pl.hand.splice(ix, 1);
        pl.tokenBalance = (pl.tokenBalance ?? 0) + p.tokensPaid;
        const label =
          cardShopForRefresh?.slots[p.slotId]?.offer != null
            ? describeShopOfferLine(cardShopForRefresh.slots[p.slotId]!.offer)
            : p.slotId;
        refundEv.push({
          type: 'COIN_FLIP',
          message: `${pl.name}'s pending Cash Chips pack (${label}) â€” match ended; refunded ${p.tokensPaid} tokens.`,
        });
      }
      pendingAfterFlush = [];
      outcomeForState = {
        ...outcomeForState,
        events: [...(outcomeForState.events ?? []), ...refundEv],
      };
    }

    const chipsOn = roomData.settings.enablePokerChips === true;

    return {
      ...roomData,
      players: updatedPlayers,
      lastOutcome: outcomeForState,
      status: nextStatus,
      winner,
      currentTurn: roomData.currentTurn + 1,
      targetSuit,
      availableSuits,
      wheelOffset,
      deck: newDeck,
      powerDeck,
      pendingPowerDecisions: {},
      engageMoves: null,
      awaitingPowerShowdown: false,
      famineActive,
      activeCurses: curseOk ? nextActiveCurses : [],
      tyrantCrownPending: nextTyrant,
      greedInjectedCoins: nextGreedInjected,
      prideCeilingCard: nextPrideCeiling,
      wrathTargetUid: curseOk ? nextWrathTarget : null,
      wrathMinionCard: curseOk ? nextWrathMinion : null,
      envySealedCards: curseOk ? nextEnvySealed : {},
      envyCovet: curseOk ? nextEnvyCovet : null,
      envyBothGrovelTrap: curseOk ? nextEnvyBothTrap : false,
      slothSavedAvailableSuits: curseOk ? nextSlothSaved ?? null : null,
      ...(chipsOn
        ? {
            shopBrowsingUid: null,
            cardShopBrowsersUids: [],
            shopRemoteCursor: null,
            pendingCardShopPurchases:
              roomData.settings.cardShopConflictMode === 'coin_flip' ? pendingAfterFlush ?? [] : undefined,
            ...(cardShopForRefresh ? { cardShop: refreshDiscountSlot(cardShopForRefresh) } : {}),
          }
        : {}),
      updatedAt: Date.now()
    };
  }

  destroy() {
    this.clearShopCursorPipeline();
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
