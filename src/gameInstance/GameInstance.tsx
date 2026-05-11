/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Copy, 
  Check, 
  Hash, 
  Info,
  RefreshCw,
  Zap,
  LayoutGrid,
  Monitor,
  Rabbit,
  Skull,
  Gamepad2,
  UtensilsCrossed,
  Sparkles,
  Wand2,
  Eye,
  Crown,
  BookType,
  BookOpen,
  Heart,
  FastForward,
  BicepsFlexed,
  Lamp,
  Scale,
  Anchor,
  Waves,
  Flame,
  ZapOff,
  Star,
  Moon,
  Sun,
  Gavel,
  Globe,
  Coins,
  X,
  Play,
  Plus,
} from 'lucide-react';
import {
  GameService,
  type DiceTestRollPayload,
  parseCard,
  desperationSpinAllowed,
  displaySuitCardValue,
  GROVEL_CARD_ID,
  reorderHandSlots,
  handReorderGapNeighborIndices,
  handIndexAfterReorder,
  handSlotOccurrenceRank,
  describeCardPlain,
} from '../services/gameService';
import {
  RoomData,
  PlayerData,
  Suit,
  CARD_UNICODE,
  SUITS,
  GameSettings,
  ResolutionEvent,
  desperationTierRowsForDisplay,
  effectiveActiveDesperationTierCount,
} from '../types';
import { FortuneWheelVisual, PowerDecisionModal } from '../components/PowerInteraction';
import { DesperationWheel, TargetSuitWheel } from '../components/GameWheels';
import { RoomChat } from '../components/RoomChat';
import { DiceBoxTestOverlay } from '../components/DiceBoxTestOverlay';
import { diceTestCoinFlipPayload, diceTestRollPayloadFromValues } from '../utils/diceTestRollPayload';
import { ChipDropperTest } from '../components/ChipDropperTest';
import { CardShopModal } from '../components/CardShopModal';
import { ShopOpponentCursorOverlay } from '../components/ShopOpponentCursorOverlay';
import { DevilCurseSpinOverlay } from '../components/DevilCurseSpinOverlay';
import { PanicClashResolution, type PanicClashDismissReason } from '../components/PanicClashResolution';
import { PowerResolutionOverlay } from '../components/PowerResolutionOverlay';
import { SuitGlyph } from '../components/SuitGlyphs';
import { SuitRasterOrGlyph } from '../components/SuitRasterOrGlyph';
import { DualTableTrumpCard, DualTrumpTableLabel } from '../components/DualTableTrumpCard';
import {
  CardVisual,
  DesperationVignette,
  PowerCardVisual,
  SUIT_COLORS,
  WolfIcon,
} from '../components/GameVisuals';
import { CurseZonePanel } from '../components/CurseZonePanel';
import { ActiveCurseBackgroundTints, CompactTableGlyphRow } from '../components/TableHudDecor';
import { desperationLadderLabel } from '../utils/desperationUi';
import { resolutionLogLineClass } from '../utils/resolutionLogColors';
import { ResolutionSequence, formatRoundResultEventMessage } from '../resolution';
import { sanitizeRoomDataForClient } from '../settings/sanitizeRoomData';
import { useLayoutScaleBump } from '../hooks/useLayoutScaleBump';
import { useGameSessionResilience } from '../hooks/useGameSessionResilience';
import { useShopCursorBroadcast } from '../hooks/useShopCursorBroadcast';
import {
  HoldDelayTooltip,
  HUD_HOLD_TOOLTIP_RASTER_PANEL_CLASS,
  HUD_INSTANT_TOOLTIP_PANEL_CLASS,
} from '../components/HoldDelayTooltip';
import { jointTableTrumpPair, tableTrumpSuitNameClass } from '../suitPresentation';
import { playerHandFanMotion, computeHandFanSqueeze } from '../playerHandFan';
import { CARD_ART_HEIGHT, CARD_ART_WIDTH } from '../cardArt/AssembledPlayingCardFace';
import { CardArtSessionBridge } from '../cardArt/CardArtSessionBridge';
import {
  DisplayCardArtModeOverride,
  mergeCardArtWithRoom,
  useOptionalCardArt,
} from '../cardArt/cardArtContext';
import { cardArtAssetUrl } from '../cardArt/paths';
import { isShopPackPlaceholder } from '../shopPack';
import { SacrificialBowl } from '../components/SacrificialBowl';
import { CardBurnSacrifice } from '../components/CardBurnSacrifice';
import { panicDiceSeatAllowed } from '../services/panicDiceSeat';
import { warmCardArtImages } from '../cardArt/preload';
import { shippedPlayingCardBackRasterUrl } from '../cardArt/shippedRasterFallbacks';
import { PlayerSettingsMenu } from '../components/PlayerSettingsMenu';
import { usePlayerDisplayPreferences } from '../playerDisplayPreferences';
import { playSfx } from '../audio/sfx';
import {
  ornateGoldCompactButtonRasterStyle,
  ornateGreenSacrificialBowlHudWrapStyle,
  ornateGreenTooltipRasterStyle,
  ornatePurplePanelRasterStyle,
} from '../ui/ornateFrame';
import { sacrificialBowlHoldCaption } from '../ui/hudCopy';
import {
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_PRIDE,
  CURSE_ENVY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_SLOTH,
  CURSE_WRATH,
  CURSES,
  CURSE_IDS,
  curseEffectActive,
  isCurseCardId,
  greedCurseActive,
  gluttonyCurseActive,
  lustCurseActive,
  prideCurseActive,
  envyCurseActive,
  wrathCurseActive,
} from '../curses';


import {
  PRIDE_WOUND_TOOLTIP,
  GROVEL_FEED_TOOLTIP,
  ENVY_COVET_CARD_TOOLTIP,
  ENVY_SEALED_TOOLTIP,
  PANIC_DICE_STRIP_HOVER_HELP,
  PANIC_DICE_STRIP_CLICK_HELP,
  PANIC_DICE_USED_HOVER,
  HUD_HOLD_DECK_CAPTION,
  HUD_HOLD_OPPONENT_HAND_CAPTION,
  HUD_HOLD_OPPONENT_POWERS_CAPTION,
  HUD_HOLD_PLAYER_TOKENS_CAPTION,
  HUD_HOLD_OPPONENT_TOKENS_CAPTION,
  HUD_HOLD_TARGET_SUIT_CAPTION,
  HUD_HOLD_OPPONENT_DESPERATION_CAPTION,
  FAMINE_BONE_DEAL_UI_MS,
} from '../ui/hudCopy';
import { dualReconnectStorageKey, wipeDualReconnectSnapshots } from './dualReconnect';
import { envySealBlocksHandIndex, prideBlocksCard } from './playValidators';
import type { GameInstanceProps, FamineBannerPhase } from './types';
import { HUD_TABLE_ACTION_BTN, SACRIFICE_BOWL_REWARD_DRAW_SFX } from './constants';
import { RulesSheet } from './RulesSheet';
import { InsightModal, AcquiredAssets } from './AcquiredAssetsPanel';
import { DevPowerMenu } from './DevPowerMenu';
import { DraftingPhase } from './DraftingPhase';
import { TyrantCrownTablePiece, OpponentDesperationTopStrip, OpposingHandOverlayStack } from './TableOverlayPieces';
import { CLIPBOARD_SUIT_TAG } from './clipboardSuitTags';
import { GameInstanceJoinGate, GameInstanceConnecting, GameInstanceWaitingLobby } from './GameInstanceLobby';
import { useTableSeatDerived } from './useTableSeatDerived';
import { computePanicDiceUi } from './panicDiceUi';

export const GameInstance: React.FC<GameInstanceProps> = ({ instanceId, isDual }) => {
  const serviceRef = useRef(new GameService());
  const [playerName, setPlayerName] = useState(isDual ? `Tester ${instanceId.slice(-1)}` : '');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<RoomData | null>(null);
  const ingestRoomState = useCallback((state: RoomData) => {
    setRoom(sanitizeRoomDataForClient(state));
  }, []);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [selectedPowerCard, setSelectedPowerCard] = useState<number | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDesperationWheel, setShowDesperationWheel] = useState(false);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [isDevMenuOpen, setIsDevMenuOpen] = useState(false);
  const [showResolutionSequence, setShowResolutionSequence] = useState(false);
  /** Bumps when panic clash finishes so {@link ResolutionSequence} remounts and replays with post-panic outcome. */
  const [resolutionReplayNonce, setResolutionReplayNonce] = useState(0);
  const [seenIntel, setSeenIntel] = useState<PlayerData['secretIntel']>(null);
  const lastTurnRef = useRef(0);
  const cardSelectionTurnRef = useRef<number | null>(null);
  const myUid = serviceRef.current.getUid();
  const seat = useTableSeatDerived(room, myUid, roomId);
  const [famineBannerPhase, setFamineBannerPhase] = useState<FamineBannerPhase>('idle');
  const [hudDiceRoll, setHudDiceRoll] = useState<DiceTestRollPayload | null>(null);
  const [cashShopOpen, setCashShopOpen] = useState(false);
  /** Hover on Cash Chips action button — boosts 3D token emissive on your pile only. */
  const [cashShopBtnHover, setCashShopBtnHover] = useState(false);
  /** True until `cardShopBrowsersUids` echoes us — avoids closing the modal during the async open race. */
  const cashShopPresencePendingRef = useRef(false);
  const layoutScaleBump = useLayoutScaleBump();
  useGameSessionResilience(serviceRef, room);
  const [panicDiceConfirmOpen, setPanicDiceConfirmOpen] = useState(false);
  const [panicDiceStripExplainOpen, setPanicDiceStripExplainOpen] = useState(false);
  const [panicDiceStripHover, setPanicDiceStripHover] = useState(false);
  const [panicDiceResultsHover, setPanicDiceResultsHover] = useState(false);
  const [panicClashOpen, setPanicClashOpen] = useState(false);
  /** When panic dice rewrote the tableau, keep static result cards on `initialCardsPlayed` until clash FX finishes. */
  const [panicOutcomeCardsRevealedDiceId, setPanicOutcomeCardsRevealedDiceId] = useState<string | null>(null);
  /** Avoid scheduling duplicate timers (React Strict dev double-mount clears the first timeout). */
  const panicClashPlayedRollIdsRef = useRef<Set<string>>(new Set());
  const [handDragFromIndex, setHandDragFromIndex] = useState<number | null>(null);
  const [handDragHoverIndex, setHandDragHoverIndex] = useState<number | null>(null);
  const [sacrificialBowlFocused, setSacrificialBowlFocused] = useState(false);
  const [sacrificialBowlCatchHover, setSacrificialBowlCatchHover] = useState(false);
  const [sacrificialBowlBreathe, setSacrificialBowlBreathe] = useState(false);
  const [sacrificeBurnAnimCard, setSacrificeBurnAnimCard] = useState<string | null>(null);
  const [sacrificeOpponentBanner, setSacrificeOpponentBanner] = useState<string | null>(null);
  /** Expanded overlay vs HUD compact — must not share one ref during AnimatePresence overlap / detach races. */
  const sacrificialBowlCompactDropRef = useRef<HTMLDivElement | null>(null);
  const sacrificialBowlOverlayDropRef = useRef<HTMLDivElement | null>(null);

  function pickSacrificialBowlHitEl(): HTMLElement | null {
    const o = sacrificialBowlOverlayDropRef.current;
    const c = sacrificialBowlCompactDropRef.current;
    const connected = [o, c].filter((el): el is HTMLElement => Boolean(el && el.isConnected));
    if (connected.length === 0) return null;
    if (connected.length === 1) return connected[0];
    /** Exit animation can mount both briefly — prefer the larger expanded hit target. */
    return connected.reduce((best, el) => {
      const rb = best.getBoundingClientRect();
      const re = el.getBoundingClientRect();
      return rb.width * rb.height >= re.width * re.height ? best : el;
    });
  }
  const sacrificialBowlTimersRef = useRef<number[]>([]);
  const sacrificeBurnAnimRef = useRef<string | null>(null);
  sacrificeBurnAnimRef.current = sacrificeBurnAnimCard;
  const sacrificialBowlBreatheRef = useRef(false);
  sacrificialBowlBreatheRef.current = sacrificialBowlBreathe;
  const lastSacrificeToastAtRef = useRef<number | null>(null);
  /** Burn RPC deferred until burn FX + bowl overlay finish — holds resolve targets at drop time. */
  const pendingSacrificeBurnRef = useRef<{
    handIndex: number;
    cardId: string;
    playRewardDrawSfx: boolean;
  } | null>(null);
  const handHudLayoutRef = useRef<HTMLDivElement>(null);
  const [handHudNeedsStack, setHandHudNeedsStack] = useState(false);
  const handRowRef = useRef<HTMLDivElement>(null);
  const [handRowW, setHandRowW] = useState(400);
  const [handDealVisibleCount, setHandDealVisibleCount] = useState<number | null>(null);
  const handDealStartedForRef = useRef<string>('');
  const handDealStaggerIntervalRef = useRef<number | null>(null);
  const handDealStaggerTimeoutRef = useRef<number | null>(null);
  const famineActivePrev = useRef(false);
  const dualSnapRef = useRef({ instanceId, isDual, playerName, roomId, room });
  dualSnapRef.current = { instanceId, isDual, playerName, roomId, room };
  const dualResumeStartedRef = useRef(false);
  const { highVisibilityMode, sfxVolume } = usePlayerDisplayPreferences();

  useEffect(() => {
    handDealStartedForRef.current = '';
    setHandDealVisibleCount(null);
  }, [room?.code]);

  /**
   * Opening deal: reveal hand slots one-by-one (200ms) with deck-pull + draw SFX only after the hand strip is visible.
   * Gated the same way as `suppressHandCardsUi` — if we stagger while hidden (draft / wheel), the timer finishes before reveal and all cards pop in at once.
   */
  useEffect(() => {
    if (!room) {
      setHandDealVisibleCount(null);
      return;
    }
    const suppressed =
      room.status === 'drafting' ||
      room.status === 'powering' ||
      (room.status === 'playing' && isWheelSpinning && room.currentTurn === 1);
    if (suppressed) {
      setHandDealVisibleCount(null);
      /** Lets the deal restart once overlays / wheel clear (fixes one-frame stagger before spinning state exists). */
      handDealStartedForRef.current = '';
      return;
    }

    const self = room.players[myUid];
    if (!self || room.status !== 'playing' || room.currentTurn !== 1 || self.hand.length === 0) {
      setHandDealVisibleCount(null);
      return;
    }

    /** Exclude `hand.length` — mid-round burns/draws change count and must not replay the opening deal stagger + SFX. */
    const handSig = `${room.code}:${self.uid}:${room.currentTurn}`;
    if (handDealStartedForRef.current === handSig) return;
    handDealStartedForRef.current = handSig;

    /** When the tab sleeps, timeouts/RAF backlog can leave stagger + Motion stuck on opacity‑0 deck pulls; skip timer work while hidden. */
    let dealCompletedNaturally = false;

    if (self.hand.length <= 1) {
      setHandDealVisibleCount(1);
      const tick = () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        dealCompletedNaturally = true;
        handDealStaggerTimeoutRef.current = null;
        setHandDealVisibleCount(null);
      };
      const done = window.setTimeout(tick, 620);
      handDealStaggerTimeoutRef.current = done as unknown as number;
      return () => {
        window.clearTimeout(done);
        if (handDealStaggerTimeoutRef.current === (done as unknown as number))
          handDealStaggerTimeoutRef.current = null;
        if (!dealCompletedNaturally) setHandDealVisibleCount(null);
      };
    }

    setHandDealVisibleCount(1);
    let shown = 1;
    let timer = 0 as unknown as number;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      shown += 1;
      if (shown >= self.hand.length) {
        dealCompletedNaturally = true;
        handDealStaggerIntervalRef.current = null;
        setHandDealVisibleCount(null);
        window.clearInterval(timer);
      } else {
        setHandDealVisibleCount(shown);
      }
    };
    timer = window.setInterval(tick, 200);
    handDealStaggerIntervalRef.current = timer as unknown as number;
    return () => {
      window.clearInterval(timer);
      if (handDealStaggerIntervalRef.current === (timer as unknown as number))
        handDealStaggerIntervalRef.current = null;
      /** Room updates during turn 1 (P2P) were clearing this interval mid-stagger once `handSig` pinned — stranded count left deck-pull faces invisible until refocused. */
      if (!dealCompletedNaturally) setHandDealVisibleCount(null);
    };
  }, [room, myUid, isWheelSpinning]);

  /**
   * Tab sleep minimises RAF: deck-pull entrances can freeze on initial opacity 0 — finish the staged deal when returning.
   * Also covers bfcache restores where timers did not replay predictably.
   */
  useEffect(() => {
    const flushDealIfStale = () => {
      const iid = handDealStaggerIntervalRef.current;
      if (iid !== null) {
        window.clearInterval(iid);
        handDealStaggerIntervalRef.current = null;
      }
      const tid = handDealStaggerTimeoutRef.current;
      if (tid !== null) {
        window.clearTimeout(tid);
        handDealStaggerTimeoutRef.current = null;
      }
      setHandDealVisibleCount((c) => (c != null ? null : c));
    };
    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      flushDealIfStale();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) flushDealIfStale();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    return () => {
      const svc = serviceRef.current;
      const snap = dualSnapRef.current;
      try {
        if (
          snap.isDual &&
          snap.roomId &&
          snap.room &&
          (snap.room.status !== 'waiting' || Object.keys(snap.room.players ?? {}).length > 1)
        ) {
          const st = svc.getState();
          if (st) {
            sessionStorage.setItem(
              dualReconnectStorageKey(snap.instanceId),
              JSON.stringify({
                savedAt: Date.now(),
                roomId: snap.roomId,
                myUid: svc.getUid(),
                playerName: snap.playerName,
                isHost: svc.getIsHost(),
                room: st,
              }),
            );
          }
        }
      } catch {
        /* ignore */
      }
      svc.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isDual) {
      dualResumeStartedRef.current = false;
      return;
    }
    if (roomId) return;

    let alive = true;
    const raw = sessionStorage.getItem(dualReconnectStorageKey(instanceId));
    if (!raw || dualResumeStartedRef.current) return;

    let snap: {
      savedAt: number;
      roomId: string;
      myUid: string;
      playerName: string;
      isHost: boolean;
      room: RoomData;
    };
    try {
      snap = JSON.parse(raw) as typeof snap;
    } catch {
      return;
    }
    if (!snap?.room || !snap.roomId || !snap.myUid || !snap.playerName || typeof snap.isHost !== 'boolean') return;
    if (Date.now() - (snap.savedAt ?? 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(dualReconnectStorageKey(instanceId));
      return;
    }

    dualResumeStartedRef.current = true;
    void (async () => {
      try {
        if (!snap.isHost) {
          await new Promise((r) => setTimeout(r, 420));
        }
        if (!alive) return;
        if (snap.isHost) {
          await serviceRef.current.resumeDualHost(
            {
              roomId: snap.roomId,
              myUid: snap.myUid,
              room: snap.room,
              playerName: snap.playerName,
            },
            (st) => {
              if (alive) ingestRoomState(st);
            },
          );
        } else {
          await serviceRef.current.resumeDualGuest(
            { roomId: snap.roomId, myUid: snap.myUid, playerName: snap.playerName },
            (st) => {
              if (alive) ingestRoomState(st);
            },
          );
        }
        if (!alive) return;
        setRoomId(snap.roomId);
        if (!snap.isHost) setRoomCode(snap.roomId);
        setPlayerName(snap.playerName);
      } catch {
        dualResumeStartedRef.current = false;
        sessionStorage.removeItem(dualReconnectStorageKey(instanceId));
      }
    })();

    return () => {
      alive = false;
    };
  }, [instanceId, isDual, roomId]);

  useEffect(() => {
    if (!room) return;
    const on = Boolean(room.famineActive);
    if (!famineActivePrev.current && on) {
      setFamineBannerPhase('bone_deal');
      const tid = window.setTimeout(() => setFamineBannerPhase('famine_title'), FAMINE_BONE_DEAL_UI_MS);
      famineActivePrev.current = on;
      return () => window.clearTimeout(tid);
    }
    if (famineActivePrev.current && !on) {
      setFamineBannerPhase('idle');
    }
    famineActivePrev.current = on;
  }, [room?.famineActive]);

  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const mePlayer = room.players[myUid];
    if (!mePlayer) return;
    const turn = room.currentTurn;
    if (mePlayer.confirmed) {
      cardSelectionTurnRef.current = turn;
      return;
    }
    if (cardSelectionTurnRef.current !== turn) {
      cardSelectionTurnRef.current = turn;
      setSelectedCardIndex(null);
      return;
    }
    if (selectedCardIndex !== null) {
      const card = mePlayer.hand[selectedCardIndex];
      if (!card) {
        setSelectedCardIndex(null);
      } else if (prideBlocksCard(room, myUid, card)) {
        setSelectedCardIndex(null);
      }
    }
  }, [
    room,
    room?.currentTurn,
    room?.status,
    room?.players[myUid]?.confirmed,
    room?.prideCeilingCard,
    room?.activeCurses,
    selectedCardIndex,
    myUid,
  ]);

  useEffect(() => {
    const handleHashChange = () => {
      if (roomId) return; // Don't react to hash changes if already in a game
      const hash = window.location.hash.substring(1);
      if (hash && hash.length === 7) {
        setRoomCode(hash.toUpperCase());
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [roomId]);

  const [lastSeenIntelTurn, setLastSeenIntelTurn] = useState(-1);

  const wheelSpinClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Layout-phase so `isWheelSpinning` is true before passive effects — opening hand stagger must not complete while hidden. */
  useLayoutEffect(() => {
    if (room?.status !== 'playing' || lastTurnRef.current === room.currentTurn) return undefined;
    lastTurnRef.current = room.currentTurn;
    setIsWheelSpinning(true);
    if (wheelSpinClearTimerRef.current) clearTimeout(wheelSpinClearTimerRef.current);
    wheelSpinClearTimerRef.current = setTimeout(() => {
      setIsWheelSpinning(false);
      wheelSpinClearTimerRef.current = null;
    }, 5000);
    return () => {
      if (wheelSpinClearTimerRef.current) {
        clearTimeout(wheelSpinClearTimerRef.current);
        wheelSpinClearTimerRef.current = null;
      }
    };
  }, [room?.currentTurn, room?.status]);

  const [lastResolvedTurn, setLastResolvedTurn] = useState(-1);

  useEffect(() => {
    if (room?.status === 'results' && room.currentTurn > lastResolvedTurn) {
        setShowResolutionSequence(true);
        setLastResolvedTurn(room.currentTurn);
    }
    if (room?.status === 'playing' && room.players[myUid]?.secretIntel && lastSeenIntelTurn !== room.currentTurn) {
       setSeenIntel(room.players[myUid].secretIntel);
       setLastSeenIntelTurn(room.currentTurn);
    }
  }, [room?.status, room?.players[myUid]?.secretIntel, room?.currentTurn, lastResolvedTurn]);

  useEffect(() => {
    serviceRef.current.onDiceTestRollEvent((payload) => {
      setHudDiceRoll(payload);
    });
    return () => {
      serviceRef.current.onDiceTestRollEvent(null);
    };
  }, []);

  useEffect(() => {
    if (room?.status !== 'results') setPanicClashOpen(false);
    if (room?.status === 'playing') panicClashPlayedRollIdsRef.current.clear();
  }, [room?.status]);

  const panicOutcomeDiceRollId = room?.lastOutcome?.panicFx?.diceRollId ?? null;
  useEffect(() => {
    setPanicOutcomeCardsRevealedDiceId(null);
  }, [panicOutcomeDiceRollId]);

  useEffect(() => {
    const fx = room?.lastOutcome?.panicFx;
    if (!fx || room?.status !== 'results') return;
    if (panicClashPlayedRollIdsRef.current.has(fx.diceRollId)) return;
    /** After dice HUD fade (~4.7s) — show scripted panic exchange before recap. */
    const delayMs = 4600;
    const tid = window.setTimeout(() => {
      if (panicClashPlayedRollIdsRef.current.has(fx.diceRollId)) return;
      panicClashPlayedRollIdsRef.current.add(fx.diceRollId);
      setPanicClashOpen(true);
    }, delayMs);
    return () => window.clearTimeout(tid);
  }, [room?.lastOutcome?.panicFx?.diceRollId, room?.status]);

  const handLenForFan = room?.players?.[myUid]?.hand?.length ?? 0;
  const fanSqueeze = useMemo(
    () => computeHandFanSqueeze(handLenForFan, Math.max(240, handRowW), 'wide'),
    [handLenForFan, handRowW],
  );

  useEffect(() => {
    const el = handRowRef.current;
    if (!el) return;
    let roRaf = 0;
    const apply = () =>
      setHandRowW(el.clientWidth || Math.max(240, Math.floor(window.innerWidth * 0.82)));
    const update = () => {
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(apply);
    };
    apply();
    const raf = requestAnimationFrame(apply);
    let ro: ResizeObserver | null = null;
    const hasRO = typeof ResizeObserver !== 'undefined';
    if (hasRO) {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(roRaf);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [room?.status, handLenForFan]);

  const cardArtCtx = useOptionalCardArt();
  const cardArtForUi = useMemo(() => {
    if (!cardArtCtx) return null;
    if (!room) return cardArtCtx;
    const isHostAtTable = room.hostUid === myUid || serviceRef.current.getIsHost();
    return mergeCardArtWithRoom(cardArtCtx, room, isHostAtTable);
  }, [cardArtCtx, room, room?.cardArtSession, room?.updatedAt, myUid]);
  const displayCardArt = useMemo(() => {
    if (!cardArtForUi) return null;
    if (highVisibilityMode) return { ...cardArtForUi, mode: 'vector' as const };
    return cardArtForUi;
  }, [cardArtForUi, highVisibilityMode]);

  const handUniformRasterScale = useMemo(() => {
    if (!displayCardArt || displayCardArt.mode !== 'raster') return undefined;
    void layoutScaleBump;
    const rootPx =
      typeof document !== 'undefined'
        ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        : 16;
    const slotW = 7.2 * rootPx;
    const slotH = 10.8 * rootPx;
    return Math.min(1, slotW / CARD_ART_WIDTH, slotH / CARD_ART_HEIGHT);
  }, [displayCardArt?.mode, layoutScaleBump]);

  useEffect(() => {
    if (!cashShopOpen) return;
    const browsers = Array.isArray(room?.cardShopBrowsersUids) ? room.cardShopBrowsersUids : [];
    if (browsers.includes(myUid)) {
      cashShopPresencePendingRef.current = false;
    }
  }, [room?.cardShopBrowsersUids, cashShopOpen, myUid]);

  useEffect(() => {
    if (!room) return;
    if (['waiting', 'drafting', 'finished'].includes(room.status) || !room.settings.enablePokerChips) {
      cashShopPresencePendingRef.current = false;
      void serviceRef.current.setCardShopOpen(false);
      setCashShopOpen(false);
    }
  }, [room?.status, room?.settings?.enablePokerChips]);

  const deckBackRasterUrl = useMemo(() => {
    if (displayCardArt?.mode !== 'raster') return null;
    const m = displayCardArt?.manifest?.['back-deck'];
    const fromManifest =
      m?.customDataUrl ?? (m?.customImageFile?.trim() ? cardArtAssetUrl(m.customImageFile.trim()) : null);
    return fromManifest ?? shippedPlayingCardBackRasterUrl('back-deck');
  }, [displayCardArt?.mode, displayCardArt?.manifest, displayCardArt?.manifestVersion]);

  useEffect(() => {
    if (!displayCardArt || displayCardArt.mode !== 'raster') return;
    warmCardArtImages(displayCardArt.manifest);
  }, [displayCardArt?.mode, displayCardArt?.manifestVersion]);

  /** Warm raster assets in lobby so artwork is ready when the round starts (skipped for High Visibility / vector). */
  useEffect(() => {
    if (!room || room.status !== 'waiting') return;
    if (highVisibilityMode || !cardArtForUi || cardArtForUi.mode !== 'raster') return;
    warmCardArtImages(cardArtForUi.manifest);
  }, [
    room?.status,
    room?.cardArtSession?.seq,
    room?.updatedAt,
    highVisibilityMode,
    cardArtForUi?.mode,
    cardArtForUi?.manifestVersion,
  ]);

  useEffect(() => {
    if (!room || room.status === 'waiting') return;
    void import('@3d-dice/dice-box-threejs');
  }, [room?.status]);

  /** Clear scheduled sacrificial bowl timers (burn / breathe sequence). */
  const clearSacrificialBowlTimers = useCallback(() => {
    sacrificialBowlTimersRef.current.forEach((id) => window.clearTimeout(id));
    sacrificialBowlTimersRef.current = [];
    pendingSacrificeBurnRef.current = null;
  }, []);

  useEffect(() => () => clearSacrificialBowlTimers(), [clearSacrificialBowlTimers]);

  /** Sacrificial Bowl: expand + hit-test while dragging a hand card for burn. */
  useEffect(() => {
    const holdOverlayForBurn =
      Boolean(sacrificeBurnAnimCard) || sacrificialBowlBreathe;
    if (handDragFromIndex === null) {
      if (!holdOverlayForBurn) {
        setSacrificialBowlFocused(false);
        setSacrificialBowlCatchHover(false);
      }
      return;
    }
    /** `drag` fires sparsely in Chromium; `dragover` on document is reliable for cursor tracking. */
    const onDragOver = (e: DragEvent) => {
      if (e.clientY === 0 && e.clientX === 0) return;
      const el = pickSacrificialBowlHitEl();
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      /** Proximity to brazier only — pad scales with ref rect so compact bowl stays usable. */
      const base = Math.min(r.width, r.height);
      const expandPadPx = Math.max(72, Math.round(base * 0.55));
      const glowPadPx = Math.max(28, Math.round(base * 0.22));
      const inExpandProximity =
        x >= r.left - expandPadPx &&
        x <= r.right + expandPadPx &&
        y >= r.top - expandPadPx &&
        y <= r.bottom + expandPadPx;
      const overBurnTarget =
        x >= r.left - glowPadPx &&
        x <= r.right + glowPadPx &&
        y >= r.top - glowPadPx &&
        y <= r.bottom + glowPadPx;
      setSacrificialBowlFocused(inExpandProximity);
      setSacrificialBowlCatchHover(overBurnTarget);
    };
    document.addEventListener('dragover', onDragOver, true);
    return () => document.removeEventListener('dragover', onDragOver, true);
  }, [handDragFromIndex, sacrificeBurnAnimCard, sacrificialBowlBreathe]);

  /** Reset bowl proximity highlight after every drag ends — avoids stuck “expanded” state where overlay/table swap breaks hover on later drags. Refs avoid racing the burn drop handler. */
  useEffect(() => {
    const onDragEndClear = () => {
      if (sacrificeBurnAnimRef.current || sacrificialBowlBreatheRef.current) return;
      setSacrificialBowlFocused(false);
      setSacrificialBowlCatchHover(false);
    };
    document.addEventListener('dragend', onDragEndClear, true);
    return () => document.removeEventListener('dragend', onDragEndClear, true);
  }, []);

  /** Opponent-only banner when the other player burns a card. */
  useEffect(() => {
    if (!room || room.status === 'waiting') return;
    const t = room.sacrificialBowlToast;
    if (!t || t.uid === myUid) return;
    if (lastSacrificeToastAtRef.current === t.at) return;
    lastSacrificeToastAtRef.current = t.at;
    const name = room.players[t.uid]?.name ?? 'Player';
    setSacrificeOpponentBanner(`${name} sacrificed a card`);
    const timer = window.setTimeout(() => setSacrificeOpponentBanner(null), 3200);
    return () => window.clearTimeout(timer);
  }, [room, myUid]);

  const handleCreateRoom = async () => {
    if (!playerName) { setError('Please enter your name'); return; }
    setLoading(true);
    setError(null);
    wipeDualReconnectSnapshots();
    try {
      const id = await serviceRef.current.createRoom(playerName, (state) => {
        ingestRoomState(state);
      });
      setRoomId(id);
      window.location.hash = id;
    } catch (err: any) {
      setError(`Failed to create: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName || !roomCode) { setError('Please enter name and code'); return; }
    setLoading(true);
    setError(null);
    wipeDualReconnectSnapshots();
    try {
      await serviceRef.current.joinRoom(roomCode, playerName, (state) => {
        ingestRoomState(state);
      });
      setRoomId(roomCode);
      window.location.hash = roomCode;
    } catch (err: any) {
      setError(`Failed to join: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async () => {
    if (selectedCardIndex === null || !roomId || !room?.players[myUid]) return;
    setLoading(true);
    try {
      if (selectedPowerCard !== null) {
        await serviceRef.current.selectPowerCard(selectedPowerCard);
      }
      const selected = room.players[myUid].hand[selectedCardIndex];
      if (!selected) return;
      if (prideBlocksCard(room, myUid, selected)) return;
      await serviceRef.current.playCard(selected);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSelectedPowerCard(null);
      setLoading(false);
    }
  };

  const reorderMyHandSlots = useCallback(
    async (from: number, to: number) => {
      if (!room?.players[myUid] || loading) return;
      const player = room.players[myUid];
      if (player.confirmed) return;
      if (from === to || from < 0 || to < 0 || from >= player.hand.length || to >= player.hand.length) return;

      const oldHand = player.hand;
      const newOrder = reorderHandSlots(oldHand, from, to);
      setSelectedCardIndex((prev) =>
        prev === null || prev < 0 ? prev : handIndexAfterReorder(oldHand, newOrder, prev),
      );
      try {
        await serviceRef.current.reorderHand(newOrder);
      } catch (err: any) {
        setError(err?.message ?? String(err ?? 'Failed to reorder hand'));
      }
    },
    [room, myUid, loading],
  );

  /** Must run before any conditional returns — otherwise lobby → table changes hook count (React #310). */
  const confirmPanicDiceUse = useCallback(async () => {
    setLoading(true);
    try {
      await serviceRef.current.usePanicDice();
      setPanicDiceConfirmOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Panic dice failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissPanicClash = useCallback(
    (reason: PanicClashDismissReason) => {
      setPanicClashOpen(false);
      const diceId = room?.lastOutcome?.panicFx?.diceRollId;
      if (diceId) setPanicOutcomeCardsRevealedDiceId(diceId);
      if (reason !== 'complete' || room?.status !== 'results') return;
      setResolutionReplayNonce((n) => n + 1);
      setShowResolutionSequence(true);
    },
    [room?.status, room?.lastOutcome?.panicFx?.diceRollId],
  );

  /** Must run before any conditional return — same rule as other table hooks (React #310). */
  useLayoutEffect(() => {
    const el = handHudLayoutRef.current;
    const mePlayer = room?.players?.[myUid];
    if (!el || !room || !mePlayer || room.status === 'waiting') return;

    const fanSqueeze = 1;
    const handCardWidth = 115.2;
    const handOverlap = 36;
    const fanWidthPx =
      mePlayer.hand.length > 0
        ? mePlayer.hand.length * handCardWidth - Math.max(0, mePlayer.hand.length - 1) * handOverlap
        : 0;
    const powerCardWidth = 115.2;
    const powerOverlap = 24;
    const powerCount = mePlayer.powerCards.length;
    const powerBlockWidth =
      powerCount > 0 ? powerCount * powerCardWidth - Math.max(0, powerCount - 1) * powerOverlap : 0;
    const panicStripVisible =
      room.settings.enablePanicDice &&
      panicDiceSeatAllowed(room, myUid) &&
      (room.status === 'playing' || room.status === 'powering');

    const measure = () => {
      const cw = el.clientWidth;
      const cappedPowerW = Math.min(powerBlockWidth, 340);
      const panicReserve = panicStripVisible ? 128 : 0;
      const powerReserve = powerCount > 0 ? Math.round(cappedPowerW + 56) : 0;
      const gapReserve =
        ((powerCount > 0 ? 1 : 0) + (panicStripVisible ? 1 : 0)) * 28 + 40;
      const need = powerReserve + fanWidthPx + panicReserve + gapReserve;
      /** Keep 3-column [powers · hand · panic] unless the viewport is very narrow or genuinely overflowed */
      const veryNarrow = cw < 400;
      setHandHudNeedsStack(veryNarrow || need > cw + 112);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    room,
    myUid,
    handRowW,
    room?.status,
    room?.settings?.enablePanicDice,
    room?.players,
  ]);

  const pokerChipShopBrowsers = Array.isArray(room?.cardShopBrowsersUids) ? room.cardShopBrowsersUids : [];
  const shopCursorBroadcastEnabled =
    cashShopOpen &&
    room?.settings?.enablePokerChips === true &&
    pokerChipShopBrowsers.includes(myUid) &&
    pokerChipShopBrowsers.length >= 2;

  /** Before conditional returns — lobby → table would change hook count (React #310). */
  useShopCursorBroadcast(shopCursorBroadcastEnabled, (nx, ny) => {
    serviceRef.current.sendShopCursor(nx, ny);
  });

  const handleDraftSelect = async (powerId: number) => {
    setLoading(true);
    try {
      await serviceRef.current.selectDraftPowerCard(powerId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activePowerCardId = selectedPowerCard ?? room?.players?.[myUid]?.currentPowerCard ?? null;

  const handleTogglePowerCard = (powerId: number) => {
    if (
      room &&
      room.settings.enableCurseCards !== false &&
      curseEffectActive(room.activeCurses) &&
      isCurseCardId(powerId)
    ) {
      return;
    }
    if (activePowerCardId === powerId) {
      setSelectedPowerCard(null);
      serviceRef.current.selectPowerCard(null);
    } else {
      setSelectedPowerCard(powerId);
      serviceRef.current.selectPowerCard(powerId);
    }
  };

  const handleNextRound = async () => {
    setLoading(true);
    try {
      await serviceRef.current.proceedToNextRound();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyUnicodeSummary = () => {
    if (!room?.lastOutcome) return;
    const { cardsPlayed, winnerUid, message, powerCardsPlayed } = room.lastOutcome;
    const uids = Object.keys(cardsPlayed);
    
    const formatCard = (cardId: string) => {
      const { suit, value, isJoker } = parseCard(cardId);
      const color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
      const unicode =
        CARD_UNICODE[cardId] ||
        (isJoker ? '🃏' : `[${CLIPBOARD_SUIT_TAG[suit] || suit}]`);
      const fullName = isJoker ? 'The Joker' : `${suit === 'Crowns' ? displaySuitCardValue(suit, value) : value} of ${suit}`;
      return `[color=${color}]${unicode}[/color][sub](${fullName})[/sub]`;
    };

    const summary = `
[b]🃏 PREDATOR VS PREY - ROUND RESULTS 🃏[/b]
------------------------------------
${message}
Winner: ${winnerUid === 'draw' ? 'DRAW' : room.players[winnerUid].name}

Moves:
${uids.map(uid => `${room.players[uid].name}: ${formatCard(cardsPlayed[uid])} ${powerCardsPlayed?.[uid] ? `(Power: ${powerCardsPlayed[uid]})` : ''}`).join('\n')}
------------------------------------
    `.trim();
    navigator.clipboard.writeText(summary);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const handleUpdateSettings = (settings: GameSettings) => {
    serviceRef.current.syncSettings(settings);
  };

  const handleOpenDesperationWheel = () => {
    setShowDesperationWheel(true);
  };

  const handleSpinDesperation = async (_offset: number) => {
    try {
      await serviceRef.current.spinDesperation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitPowerDecision = async (option: string, wheelOffset?: number, priestessSwapToCard?: string | null) => {
    try {
      await serviceRef.current.submitPowerDecision(option, wheelOffset, priestessSwapToCard);
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const handleResolveDesperation = async () => {
    try {
      await serviceRef.current.resolveDesperation();
      setShowDesperationWheel(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      await serviceRef.current.startGame();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!roomId) {
    return (
      <GameInstanceJoinGate
        isDual={isDual}
        playerName={playerName}
        setPlayerName={setPlayerName}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        loading={loading}
        error={error}
        onHost={() => void handleCreateRoom()}
        onJoin={() => void handleJoinRoom()}
      />
    );
  }

  if (!room) return <GameInstanceConnecting />;

  if (room.status === 'waiting') {
    const lobbyGuestUid = Object.keys(room.players).find((uid) => uid !== room.hostUid);
    const guestLobbyReady = !!(lobbyGuestUid && room.players[lobbyGuestUid]?.lobbyGuestReady);
    const lobbyIsHost = Boolean(roomId && room.hostUid === myUid);
    const linkCode = roomId ?? room.code;
    const copyRoomId = () => {
      navigator.clipboard.writeText(linkCode);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    };
    return (
      <GameInstanceWaitingLobby
        room={room}
        roomId={roomId}
        isHost={lobbyIsHost}
        loading={loading}
        guestLobbyReady={guestLobbyReady}
        showCopySuccess={showCopySuccess}
        onRoomIdCopy={copyRoomId}
        onStartGame={() => void handleStartGame()}
        serviceRef={serviceRef}
      />
    );
  }

  if (!seat) return <div className="h-full flex items-center justify-center text-[10px] uppercase">DESYNCED</div>;
  const {
    me,
    opponent,
    tableShopBrowsers,
    powerShowdown,
    myPendingDecision,
    opponentPendingDecision,
    opponentWheelDecisionSpinning,
    myWheelDecisionSpinning,
    lustHeartUi,
    lustTripleWheel,
    greedHalveWheel,
    greedJointTrumpUi,
    curseSelectionLocked,
    hudPhaseLine,
  } = seat;
  const handCardWidth = 115.2;
  const handOverlap = 36;
  const fanWidthPx =
    me.hand.length > 0 ? me.hand.length * handCardWidth - Math.max(0, me.hand.length - 1) * handOverlap : 0;
  const fanOverflowPx = Math.max(0, Math.round((fanWidthPx - handRowW) / 2));
  const powerCardWidth = 115.2;
  const powerOverlap = 24;
  const powerCount = me.powerCards.length;
  const powerBlockWidth =
    powerCount > 0 ? powerCount * powerCardWidth - Math.max(0, powerCount - 1) * powerOverlap : 0;
  const powerClearancePx = powerCount > 0 ? Math.min(220, fanOverflowPx) : 0;
  const handPowerGapPx = 40 + Math.min(220, fanOverflowPx);

  const sacrificialBowlExpandedUi =
    sacrificialBowlFocused || Boolean(sacrificeBurnAnimCard) || sacrificialBowlBreathe;

  const handleSacrificialBowlDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleSacrificialBowlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (me.confirmed || room.status !== 'playing') return;
    const idx = Number(e.dataTransfer.getData('text/plain'));
    const card = me.hand[idx];
    if (!Number.isFinite(idx) || idx < 0 || idx >= me.hand.length) {
      setHandDragFromIndex(null);
      setHandDragHoverIndex(null);
      setSacrificialBowlFocused(false);
      setSacrificialBowlCatchHover(false);
      return;
    }
    if (!card || card === GROVEL_CARD_ID || isShopPackPlaceholder(card)) {
      setHandDragFromIndex(null);
      setHandDragHoverIndex(null);
      setSacrificialBowlFocused(false);
      setSacrificialBowlCatchHover(false);
      return;
    }
    const lustRejectHearts =
      room.settings.enableCurseCards !== false && lustCurseActive(room.activeCurses ?? []);
    if (lustRejectHearts && parseCard(card).suit === 'Hearts') {
      setHandDragFromIndex(null);
      setHandDragHoverIndex(null);
      setSacrificialBowlFocused(false);
      setSacrificialBowlCatchHover(false);
      return;
    }
    clearSacrificialBowlTimers();
    /** So `dragend` (same tick as drop) sees active burn before React re-renders. */
    sacrificeBurnAnimRef.current = card;
    const burnsTick = me.sacrificialBowlBurnsRemaining ?? 2;
    pendingSacrificeBurnRef.current = {
      handIndex: idx,
      cardId: card,
      /** Second burn in the pair grants a deck card — play draw SFX when state applies after FX. */
      playRewardDrawSfx: burnsTick === 1,
    };
    setSacrificeBurnAnimCard(card);
    setSacrificialBowlFocused(true);
    setSacrificialBowlBreathe(false);
    setHandDragFromIndex(null);
    setHandDragHoverIndex(null);
    setSacrificialBowlCatchHover(false);
    const burnStripMs = 2000;
    const breatheMs = 500;
    const tBurnEnd = window.setTimeout(() => {
      setSacrificeBurnAnimCard(null);
      setSacrificialBowlBreathe(true);
    }, burnStripMs);
    const tAllDone = window.setTimeout(() => {
      const pending = pendingSacrificeBurnRef.current;
      pendingSacrificeBurnRef.current = null;
      const liveRoom = dualSnapRef.current.room;
      const self = liveRoom?.players[myUid];
      if (pending && self) {
        let burnIdx = pending.handIndex;
        const h = self.hand;
        if (burnIdx < 0 || burnIdx >= h.length || h[burnIdx] !== pending.cardId) {
          burnIdx = h.indexOf(pending.cardId);
        }
        if (burnIdx >= 0) {
          void serviceRef.current.burnSacrificialBowlCard(burnIdx);
          if (pending.playRewardDrawSfx) {
            const src =
              SACRIFICE_BOWL_REWARD_DRAW_SFX[Math.floor(Math.random() * SACRIFICE_BOWL_REWARD_DRAW_SFX.length)]!;
            playSfx(src, sfxVolume);
          }
        }
      }
      setSacrificialBowlFocused(false);
      setSacrificialBowlBreathe(false);
    }, burnStripMs + breatheMs);
    sacrificialBowlTimersRef.current = [tBurnEnd, tAllDone];
  };

  const showOpponentShopCursor = Boolean(
    room.settings.enablePokerChips &&
      cashShopOpen &&
      opponent &&
      tableShopBrowsers.length >= 2 &&
      tableShopBrowsers.includes(myUid) &&
      tableShopBrowsers.includes(opponent.uid) &&
      room.shopRemoteCursor &&
      room.shopRemoteCursor.uid !== myUid,
  );

  const {
    panicDiceStripVisible,
    panicDiceStripInteractive,
    panicDiceResultsVisible,
    panicDiceResultsInteractive,
    panicDiceResultsUsedVisible,
  } = computePanicDiceUi(room, myUid, me);

  const panicStripHoverText = me.panicDiceUsed ? PANIC_DICE_USED_HOVER : PANIC_DICE_STRIP_HOVER_HELP;
  const panicStripFootnote = me.panicDiceUsed ? 'Used this game' : 'Locked until results';

  const artworkFelt = displayCardArt?.mode === 'raster';

  /** No cards in hand strip until drafting + power resolution finish and first-trick table suit wheel finishes (avoids leaking through blurred overlays). */
  const suppressHandCardsUi =
    room.status === 'drafting' ||
    room.status === 'powering' ||
    (room.status === 'playing' && isWheelSpinning && room.currentTurn === 1);

  const initialDealDragBlocked = handDealVisibleCount !== null && !suppressHandCardsUi;

  const handleTablePlayTargetDragOver = (e: React.DragEvent) => {
    if (suppressHandCardsUi || handDragFromIndex === null || room.status !== 'playing') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleTablePlayTargetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (
      suppressHandCardsUi ||
      room.status !== 'playing' ||
      me.confirmed ||
      initialDealDragBlocked ||
      handDragFromIndex === null
    ) {
      setHandDragFromIndex(null);
      setHandDragHoverIndex(null);
      return;
    }
    const from = handDragFromIndex;
    setHandDragFromIndex(null);
    setHandDragHoverIndex(null);
    if (from < 0 || from >= me.hand.length) return;
    const card = me.hand[from];
    if (!card || card === GROVEL_CARD_ID || isShopPackPlaceholder(card)) return;
    const prideMuted = prideBlocksCard(room, myUid, card);
    const envyMuted = envySealBlocksHandIndex(room, myUid, me.hand, from);
    if (prideMuted || envyMuted) return;
    setSelectedCardIndex(from);
  };

  return (
    <CardArtSessionBridge room={room} myUid={myUid} serviceRef={serviceRef}>
    <DisplayCardArtModeOverride highVisibilityMode={highVisibilityMode}>
    {/* Table shell: in-flow game layer; fixed HUD stays in-tree; overlay modals (rules, resolution) use higher z-index. */}
    <div className="table-shell relative flex h-full min-h-0 flex-col">
    <div
      data-table-layer="game"
      className={`relative flex h-full min-h-0 flex-1 flex-col overflow-x-visible overflow-y-hidden border-x border-emerald-900/50 px-5 py-4 sm:px-7 ${
        artworkFelt ? 'bg-emerald-950/25' : 'bg-emerald-950/40'
      }`}
      style={
        artworkFelt
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(2, 44, 34, 0.5), rgba(2, 44, 34, 0.78)), url(${cardArtAssetUrl('Background.png')})`,
              backgroundSize: 'cover, cover',
              backgroundPosition: 'center, center',
            }
          : undefined
      }
    >
      <ActiveCurseBackgroundTints
        enabled={Boolean(artworkFelt && room.settings.enableCurseCards !== false)}
        activeCurses={room.activeCurses}
      />
      {room.famineActive && famineBannerPhase === 'bone_deal' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[241] bg-stone-900/95 border border-stone-500 px-5 py-2 rounded-full shadow-lg max-w-[min(94vw,32rem)]">
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-stone-100 text-center block">
            Deck empty · dealing bone cards to even hands
          </span>
        </div>
      )}
      {room.famineActive && famineBannerPhase === 'famine_title' && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[233] bg-[radial-gradient(ellipse_95%_75%_at_50%_50%,rgba(120,53,15,0.10)_0%,rgba(120,53,15,0.16)_44%,rgba(41,37,36,0.52)_72%,rgba(12,10,9,0.82)_100%)]"
            aria-hidden
          />
          <div className="pointer-events-none absolute top-8 sm:top-10 left-1/2 -translate-x-1/2 z-[239] text-center">
            <span className="block text-[clamp(2.5rem,10vw,5.5rem)] font-black uppercase tracking-[0.12em] text-amber-950 drop-shadow-[0_4px_0_rgba(254,243,199,0.25),0_0_40px_rgba(251,191,36,0.35)]">
              FAMINE
            </span>
            <span className="mt-2 block text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.35em] text-amber-100/80">
              The draw pile is gone — bones only
            </span>
          </div>
        </>
      )}
      <DesperationVignette
        tier={me.desperationTier}
        totalTiers={effectiveActiveDesperationTierCount(room.settings)}
      />
      <DiceBoxTestOverlay roll={hudDiceRoll} />

      {sacrificeOpponentBanner && (
        <div className="pointer-events-none fixed left-1/2 top-[4.25rem] z-[447] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-full border border-amber-700/50 bg-slate-950/95 px-5 py-2 text-center text-[10px] font-black uppercase tracking-widest text-amber-200 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:top-[4.5rem] sm:text-[11px]">
          {sacrificeOpponentBanner}
        </div>
      )}

      <AnimatePresence>
        {sacrificialBowlExpandedUi && room.status === 'playing' && !me.confirmed && (
          <motion.div
            key="sacrificial-bowl-focus"
            className="fixed inset-0 z-[446] pointer-events-none flex flex-col items-center justify-center gap-6 bg-black/72 px-4 pt-[max(5rem,14vh)] pb-[min(22vh,9rem)] backdrop-blur-[2px] sm:gap-8 sm:pt-[max(6rem,16vh)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div
              onDragOver={handleSacrificialBowlDragOver}
              onDrop={handleSacrificialBowlDrop}
              className="pointer-events-auto flex flex-col items-center"
            >
              <SacrificialBowl
                ref={sacrificialBowlOverlayDropRef}
                rasterMode={displayCardArt?.mode === 'raster'}
                expanded
                breathe={sacrificialBowlBreathe}
                catchGlow={sacrificialBowlCatchHover}
                burnsRemaining={me.sacrificialBowlBurnsRemaining ?? 2}
                lustFire={lustTripleWheel}
              />
            </div>
            <p className="pointer-events-none max-w-sm px-2 text-center text-[10px] font-black uppercase tracking-widest text-stone-300/95 sm:text-[11px]">
              {sacrificeBurnAnimCard ? 'Burning…' : 'Release over the flame to sacrifice'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sacrificeBurnAnimCard && (
          <motion.div
            key={`sacrifice-burn-${sacrificeBurnAnimCard}`}
            className="pointer-events-none fixed inset-0 z-[448] flex items-start justify-center pt-[12vh] sm:pt-[16vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative flex justify-center">
              <CardBurnSacrifice cardId={sacrificeBurnAnimCard} variant="compact" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {room.settings.enablePokerChips &&
        (room.status === 'playing' || room.status === 'powering' || room.status === 'results') && (
          <>
            <ChipDropperTest
              room={room}
              myUid={myUid}
              selfBalance={me.tokenBalance ?? 0}
              opponentBalance={opponent ? opponent.tokenBalance ?? 0 : 0}
              highlightSelfTokens={cashShopBtnHover}
              selfTokensHoldCaption={HUD_HOLD_PLAYER_TOKENS_CAPTION}
              opponentTokensHoldCaption={HUD_HOLD_OPPONENT_TOKENS_CAPTION}
            />
            {cashShopOpen && room.cardShop ? (
              <CardShopModal
                cardShop={room.cardShop}
                tokenBalance={me.tokenBalance ?? 0}
                onBuy={(slotId) => void serviceRef.current.buyCardShopSlot(slotId)}
                onClose={() => {
                  cashShopPresencePendingRef.current = false;
                  setCashShopOpen(false);
                  void serviceRef.current.setCardShopOpen(false);
                }}
                purchaseMode={room.settings.cardShopConflictMode ?? 'coin_flip'}
                pendingPurchases={room.pendingCardShopPurchases ?? null}
                myUid={myUid}
              />
            ) : null}
            <ShopOpponentCursorOverlay
              visible={showOpponentShopCursor}
              nx={room.shopRemoteCursor?.nx ?? 0}
              ny={room.shopRemoteCursor?.ny ?? 0}
              opponentRole={opponent?.role ?? 'Prey'}
            />
          </>
        )}

      {(() => {
        const hudDockPhases = room.status === 'playing' || room.status === 'powering';
        const showDockCashBtn =
          room.settings.enablePokerChips && Boolean(room.cardShop) && hudDockPhases;
        const showDockPlayBtn = room.status === 'playing';
        if (!showDockCashBtn && !showDockPlayBtn) return null;
        const selectedCard = selectedCardIndex !== null ? me.hand[selectedCardIndex] ?? null : null;
        const playBlocked =
          !selectedCard ||
          (selectedCard != null &&
            (prideBlocksCard(room, myUid, selectedCard) ||
              envySealBlocksHandIndex(room, myUid, me.hand, selectedCardIndex!)));
        const playActionLocked = loading || me.confirmed || playBlocked;
        const playMuted =
          me.confirmed || !selectedCard || playBlocked || loading;
        const rasterDock = displayCardArt?.mode === 'raster';
        const playReadyStyle =
          !playMuted && selectedCard
            ? 'rounded-xl border-2 border-amber-500/90 bg-amber-400/95 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow-[0_8px_26px_rgba(0,0,0,0.38)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] sm:px-8 sm:py-3 sm:text-[11px]'
            : 'rounded-xl border-2 border-slate-600/80 bg-slate-800/90 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-none transition-[filter,transform] sm:px-8 sm:py-3 sm:text-[11px]';
        const playRasterStyle =
          rasterDock && !playMuted && selectedCard ? ornateGoldCompactButtonRasterStyle() : undefined;
        const playRasterClass =
          rasterDock && !playMuted && selectedCard
            ? 'rounded-xl border-0 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow-none transition-[filter,transform] hover:brightness-105 active:scale-[0.98] sm:px-9 sm:py-3 sm:text-[11px]'
            : '';
        let playLabel = 'Play card';
        if (me.confirmed) playLabel = 'Waiting for opponent';
        else if (selectedCard && selectedPowerCard !== null) {
          playLabel = isCurseCardId(selectedPowerCard) ? 'Play card & curse' : 'Play card & power';
        }
        return (
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[486] flex justify-center px-3 pb-[env(safe-area-inset-bottom,0px)] sm:bottom-6">
            <div className="pointer-events-auto relative flex h-[3.5rem] w-full max-w-[min(100vw-1.5rem,52rem)] items-center justify-center sm:h-[3.9rem]">
              {showDockPlayBtn ? (
                <button
                  type="button"
                  onClick={() => void handlePlayCard()}
                  disabled={playActionLocked}
                  style={playRasterStyle}
                  className={`${playRasterClass || playReadyStyle} disabled:pointer-events-none disabled:opacity-50`}
                >
                  {playLabel}
                </button>
              ) : null}
              {showDockCashBtn ? (
                <button
                  type="button"
                  disabled={me.confirmed}
                  onMouseEnter={() => setCashShopBtnHover(true)}
                  onMouseLeave={() => setCashShopBtnHover(false)}
                  onFocus={() => setCashShopBtnHover(true)}
                  onBlur={() => setCashShopBtnHover(false)}
                  onClick={() => {
                    cashShopPresencePendingRef.current = true;
                    setCashShopOpen(true);
                    void serviceRef.current.setCardShopOpen(true);
                  }}
                  style={rasterDock && !me.confirmed ? ornateGoldCompactButtonRasterStyle() : undefined}
                  className={`${
                    rasterDock && !me.confirmed
                      ? 'absolute right-0 top-1/2 -translate-y-1/2 rounded-xl border-0 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow-none transition-[filter,transform] hover:brightness-105 active:scale-[0.98] sm:px-8 sm:py-3 sm:text-[11px]'
                      : HUD_TABLE_ACTION_BTN
                  } absolute right-0 top-1/2 -translate-y-1/2 disabled:pointer-events-none disabled:opacity-40 disabled:grayscale`}
                >
                  Cash Chips
                </button>
              ) : null}
            </div>
          </div>
        );
      })()}

      {panicDiceStripExplainOpen && (
        <div
          className="fixed inset-0 z-[458] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Panic dice information"
          onClick={() => setPanicDiceStripExplainOpen(false)}
        >
          <div
            className="max-w-md rounded-2xl border border-amber-900/55 bg-slate-950 p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">Panic dice</p>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-100">
              {PANIC_DICE_STRIP_CLICK_HELP}
            </p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-slate-600 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800"
              onClick={() => setPanicDiceStripExplainOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {panicDiceConfirmOpen && (
        <div
          className="fixed inset-0 z-[460] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm panic dice"
        >
          <div className="max-w-md rounded-2xl border border-amber-900/50 bg-slate-950 p-6 shadow-[0_0_60px_rgba(0,0,0,0.55)]">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">Panic dice</p>
            <p className="mt-3 text-sm font-semibold leading-snug text-slate-100">
              Are you sure you want to use your panic dice? They can only be used once. The result of your panic dice
              roll will chip away at your opponent&apos;s committed clash rank and the round winner is rechecked from
              the frozen tableau (powers do not fire again).
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPanicDiceConfirmOpen(false)}
                className="rounded-xl border border-slate-600 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmPanicDiceUse()}
                className="rounded-xl border border-amber-500/70 bg-amber-600/90 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-amber-950 hover:bg-amber-500 disabled:opacity-40"
              >
                Yes, roll
              </button>
            </div>
          </div>
        </div>
      )}

      {!powerShowdown && room.status === 'powering' && myPendingDecision && myPendingDecision.selectedOption === null && (
        <PowerDecisionModal
          compactPane={Boolean(isDual)}
          decision={myPendingDecision}
          priestessLockedCard={myPendingDecision.powerCardId === 2 ? (room.engageMoves?.[myUid] ?? me.currentMove ?? null) : null}
          priestessHand={myPendingDecision.powerCardId === 2 ? me.hand : []}
          tableSuit={room.targetSuit ?? null}
          curseHoldsTable={room.settings.enableCurseCards !== false && curseEffectActive(room.activeCurses)}
          onSubmit={handleSubmitPowerDecision}
        />
      )}

      {opponent && <RoomChat room={room} myUid={myUid} serviceRef={serviceRef} />}

      {isDevMenuOpen && (
        <DevPowerMenu 
          onSelect={(id) => serviceRef.current.cheatPowerCard(id)} 
          onClose={() => setIsDevMenuOpen(false)} 
          onOpenAnimationPreview={() => {
            window.location.hash = '#card-anim-preview';
          }}
          curseControlsEnabled={Boolean(
            room.settings.enableCurseCards !== false &&
              (room.status === 'playing' || room.status === 'powering' || room.status === 'results'),
          )}
          onActivateCurseOnTable={(id: number) => void serviceRef.current.cheatActivateCurseOnTable(id)}
          onClearActiveCurses={() => void serviceRef.current.cheatClearActiveCursesOnTable()}
          {...(room.status === 'playing' || room.status === 'powering' || room.status === 'results'
            ? {
                deckCount: room.deck.length,
                handCards: me.hand,
                onTrimDeck: (n: number) => serviceRef.current.cheatTrimDeck(n),
                onDiscardHandCard: (cid: string) => serviceRef.current.cheatDiscardFromHand(cid),
              }
            : {})}
        />
      )}

      {room.status === 'drafting' && room.draftSets && (
        <DraftingPhase 
          draftSets={room.draftSets} 
          currentSetIdx={room.draftTurn} 
          onSelect={handleDraftSelect}
          myPowerCards={me.powerCards}
          rasterHud={displayCardArt?.mode === 'raster'}
        />
      )}

      {(showDesperationWheel || me.desperationSpinning || me.desperationResult) && !room.winner && (
        <DesperationWheel 
          onSpin={handleSpinDesperation}
          onClose={() => setShowDesperationWheel(false)}
          onResolve={handleResolveDesperation}
          isSpinning={me.desperationSpinning}
          result={me.desperationResult}
          offset={me.desperationOffset}
          tierRows={desperationTierRowsForDisplay(room.settings)}
          allTierLabels={room.settings.tiers}
          desperationTier={me.desperationTier}
        />
      )}

      {room.settings.enableDesperation &&
        (room.status === 'playing' || room.status === 'powering' || room.status === 'results') && (
          <div className="mb-2 flex w-full justify-center px-1">
            {room.settings.hostRole === 'Preydator' && opponent ? (
              <div
                style={displayCardArt?.mode === 'raster' ? ornatePurplePanelRasterStyle() : undefined}
                className={`flex w-full max-w-[min(100%,34rem)] items-stretch justify-center gap-2 px-2 py-1.5 ${
                  displayCardArt?.mode === 'raster'
                    ? ''
                    : 'rounded-xl border border-purple-800/55 bg-purple-950/55 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]'
                }`}
              >
                {[me, opponent].map((p) => (
                  <div key={`tier-top-${p.uid}`} className="min-w-0 flex-1 rounded-lg border border-purple-700/40 bg-purple-900/35 px-2 py-1 text-center">
                    <span className="block truncate text-[9px] font-black uppercase tracking-wide text-purple-200/95">
                      {p.name}: {desperationLadderLabel(room.settings.tiers, p.desperationTier) ?? 'Off ladder'}
                    </span>
                  </div>
                ))}
              </div>
            ) : desperationSpinAllowed(room, myUid, me) ? (
              <div
                style={displayCardArt?.mode === 'raster' ? ornatePurplePanelRasterStyle() : undefined}
                className={`mx-auto flex w-full max-w-md min-h-[2.3rem] flex-col items-center justify-center px-4 py-1.5 text-center ${
                  displayCardArt?.mode === 'raster'
                    ? ''
                    : 'rounded-xl border border-purple-800/55 bg-purple-950/55 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]'
                }`}
              >
                <span className="max-w-full text-[10px] font-black uppercase leading-snug tracking-widest text-purple-200/95">
                  {me.name}: {desperationLadderLabel(room.settings.tiers, me.desperationTier) ?? 'Off ladder'}
                </span>
              </div>
            ) : null}
          </div>
        )}

      {/* Opponent desperation strip: top HUD center (napkin div7). */}
      {/* HUD: room / role · phase strip (center) · dev & rules */}
      <div className="mb-3 grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1 [@media(max-height:1100px)]:mb-1">
        <div className="min-w-0 justify-self-start">
          <div className="flex items-center gap-2">
            <span className="truncate text-[8px] font-bold uppercase text-emerald-500">{roomId}</span>
            <button
              type="button"
               onClick={() => {
                 navigator.clipboard.writeText(roomId);
                 setShowCopySuccess(true);
                 setTimeout(() => setShowCopySuccess(false), 2000);
               }}
              className="shrink-0 text-emerald-700 hover:text-yellow-400"
            >
              {showCopySuccess ? <Check className="h-2 w-2" /> : <Copy className="h-2 w-2" />}
            </button>
          </div>
          <span className="text-[10px] font-black italic uppercase leading-none sm:text-xs">{me.role}</span>
        </div>
        <div className="min-w-0 max-w-[min(22rem,calc(100vw-11rem))] justify-self-center text-center px-1">
          {hudPhaseLine && (
            <span className="block truncate text-[9px] font-black uppercase tracking-wider text-yellow-400/95 sm:text-[10px]">
              {hudPhaseLine}
            </span>
          )}
          {(room.status === 'playing' || room.status === 'powering') &&
            room.famineActive &&
            !hudPhaseLine && (
              <span className="block truncate text-[8px] font-black uppercase tracking-wider text-amber-200/85">
                Famine — bones replace draws
              </span>
            )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 justify-self-end sm:gap-4">
          <PlayerSettingsMenu />
          <button 
            type="button"
            onClick={() => setIsDevMenuOpen(true)}
            className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-800 bg-emerald-900/40 p-1.5 text-[9px] font-black uppercase text-emerald-600 transition-all hover:border-yellow-500 hover:bg-yellow-400 hover:text-emerald-950 sm:p-2 sm:text-[10px]"
          >
            <Sparkles className="h-3 w-3 group-hover:rotate-12" /> Dev
          </button>
          <button 
            type="button"
            onClick={() => setShowRules(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-yellow-400 transition-all hover:bg-yellow-400 hover:text-emerald-950 sm:px-4 sm:py-2 sm:text-[10px]"
          >
            <Info className="h-4 w-4 shrink-0" /> Rules
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {opponent?.confirmed && <Check className="h-3 w-3 shrink-0 animate-bounce text-yellow-400" />}
            <span className="truncate text-[10px] font-bold uppercase text-emerald-500">{opponent?.name || '...'}</span>
          </div>
        </div>
      </div>

      {(room.status === 'playing' || room.status === 'powering') && isWheelSpinning && (
        <div className="pointer-events-none w-full shrink-0 border-b border-amber-800/40 bg-emerald-950/90 py-2 text-center shadow-[inset_0_-1px_0_rgba(251,191,36,0.12)]">
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300 sm:text-[11px]">
            Drawing this round&apos;s table suit…
          </span>
        </div>
      )}

      {seenIntel && (
        <InsightModal 
          intel={seenIntel} 
          onClose={() => setSeenIntel(null)} 
        />
      )}

      {/* Opponent strip when not at the active table grid (draft / brief transitions) */}
      {opponent && !(room.status === 'playing' || room.status === 'powering') && (
        <div
          className={`relative mb-3 flex w-full flex-col px-1 [@media(max-height:1100px)]:mb-1 ${
            room.settings.enableDesperation || opponentWheelDecisionSpinning ? 'min-h-[11.5rem]' : ''
          } ${opponentWheelDecisionSpinning ? 'min-h-[17rem] sm:min-h-[18.5rem]' : ''}`}
        >
          <div className="mb-1 flex w-full items-center justify-between gap-2 [@media(max-height:1100px)]:mb-0">
            <span className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Cards: {opponent.hand.length}
            </span>
          </div>
          <div className="flex w-full items-start justify-between gap-2">
            <HoldDelayTooltip caption={HUD_HOLD_OPPONENT_HAND_CAPTION} className="flex min-w-0 flex-1 flex-col">
              <div className="mx-auto flex h-[13rem] w-max max-w-full flex-nowrap items-end justify-center overflow-x-visible -space-x-9 px-2 opacity-80 scale-90 sm:h-[13.5rem] sm:-space-x-14 sm:scale-100 [@media(max-height:1100px)]:h-[10.5rem] [@media(max-height:1100px)]:sm:h-[11rem] [@media(max-height:1100px)]:scale-[0.82] [@media(max-height:1100px)]:sm:scale-90">
                {Array.from({ length: opponent.hand.length }).map((_, i) => (
                  <CardVisual key={`opp-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
                ))}
              </div>
              <OpposingHandOverlayStack
                opponent={opponent}
                roomSettings={room.settings}
                roomSnapshot={room}
                roomStatus={room.status}
                powerShowdown={powerShowdown}
                opponentPendingDecision={opponentPendingDecision}
                opponentWheelDecisionSpinning={opponentWheelDecisionSpinning}
              />
            </HoldDelayTooltip>
            <HoldDelayTooltip
              caption={HUD_HOLD_OPPONENT_POWERS_CAPTION}
              className="flex max-w-full shrink-0 flex-row flex-wrap items-end justify-end gap-x-4 gap-y-2 overflow-visible py-1 pr-1 opacity-80 sm:flex-nowrap sm:gap-x-6"
            >
              {opponent.powerCards.map((pid, i) => (
                <div key={`opp-p-${pid}-${i}`} className="flex shrink-0 flex-none justify-center">
                  <PowerCardVisual cardId={pid} revealed={false} small staticBackdrop />
                </div>
              ))}
            </HoldDelayTooltip>
          </div>
        </div>
      )}

      {/* Table grid: opp row · deck column share one rail — no overlapping absolutes */}
      <div className="relative z-[20] isolate flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-x-visible overflow-y-auto overscroll-y-contain sm:gap-3">
          {myWheelDecisionSpinning && (
            <div className="pointer-events-none absolute inset-0 z-[130] flex flex-col items-center justify-center gap-3 bg-black/45 px-2 backdrop-blur-[2px]">
              <span className="text-center text-[9px] font-black uppercase tracking-widest text-amber-300">
                Wheel spinning for {me.name}
              </span>
              <div className="w-[min(14rem,80vw)] max-w-full shrink-0">
                <FortuneWheelVisual
                  spinning
                  offset={myPendingDecision?.wheelOffset ?? 0}
                  sizeClass="w-full"
                />
          </div>
            </div>
          )}

            {(room.status === 'playing' || room.status === 'powering') && opponent ? (
            <div className="grid min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(0,15.6rem)_minmax(0,1fr)_minmax(7.8rem,11.4rem)] grid-rows-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 px-1 transition-all duration-500 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(9rem,13.5rem)] sm:gap-x-3 md:gap-y-1.5 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(10rem,15rem)]">
              {/* Row 1 napkin sketch: spacer | opp hand | opp powers — deck stacks row2 col3 */}
              <div className="hidden min-h-[0.125rem] sm:col-start-1 sm:row-start-1 sm:block" aria-hidden />
              <div
                className={`relative col-span-full flex min-h-0 min-w-0 flex-col items-center justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-full sm:max-w-[min(100%,min(94vw,44rem))] md:max-w-[min(100%,min(92vw,52rem))] xl:max-w-[min(100%,min(92vw,64rem))] [@media(max-height:1100px)]:scale-[0.9] [@media(max-height:1100px)]:origin-top ${
                  opponentWheelDecisionSpinning ? 'min-h-[10rem] sm:min-h-[12rem]' : 'min-h-[11rem] sm:min-h-[12rem]'
                } [@media(max-height:1100px)]:min-h-[9.25rem] [@media(max-height:1100px)]:sm:min-h-[10.25rem]`}
              >
                {room.settings.enablePokerChips && tableShopBrowsers.includes(opponent.uid) ? (
                  <div className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center rounded-2xl bg-black/55 px-3 backdrop-blur-[2px]">
                    <span className="max-w-[16rem] text-center text-[11px] font-black uppercase leading-snug tracking-widest text-amber-200 shadow-black/60 drop-shadow-md">
                      Opponent is browsing the shop
                    </span>
                  </div>
                ) : null}
                <HoldDelayTooltip caption={HUD_HOLD_OPPONENT_HAND_CAPTION} className="relative flex min-h-0 w-full min-w-0 flex-col items-center">
                <div className="mb-1 text-center [@media(max-height:1100px)]:mb-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Cards: {opponent.hand.length}
                  </span>
                       </div>
                <div className="flex h-[13rem] w-full min-w-0 items-end justify-center gap-1.5 px-2 opacity-[0.82] sm:h-[13.5rem] sm:gap-2 sm:px-4 sm:opacity-95 [@media(max-height:1100px)]:h-[10.75rem] [@media(max-height:1100px)]:sm:h-[11.25rem]">
                  <div className="mx-auto flex w-max max-w-full min-w-0 flex-nowrap items-center justify-center -space-x-8 sm:-space-x-12">
                    {Array.from({ length: opponent.hand.length }).map((_, i) => (
                      <CardVisual key={`og-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
                ))}
              </div>
              </div>
                <OpposingHandOverlayStack
                  opponent={opponent}
                  roomSettings={room.settings}
                  roomSnapshot={room}
                  roomStatus={room.status}
                  powerShowdown={powerShowdown}
                  opponentPendingDecision={opponentPendingDecision}
                  opponentWheelDecisionSpinning={opponentWheelDecisionSpinning}
                />
                </HoldDelayTooltip>
                {opponent.powerCards.length > 0 ? (
                  <HoldDelayTooltip
                    caption={HUD_HOLD_OPPONENT_POWERS_CAPTION}
                    className="pointer-events-auto absolute right-0 top-3 z-[37] hidden flex-row gap-2 sm:flex sm:items-start sm:pr-1"
                  >
                    {opponent.powerCards.map((pid, i) => (
                      <div key={`ogr-float-${pid}-${i}`} className="flex shrink-0 flex-none justify-center">
                        <PowerCardVisual cardId={pid} revealed={false} small staticBackdrop />
                      </div>
                    ))}
                  </HoldDelayTooltip>
                ) : null}
            </div>
              <HoldDelayTooltip
                caption={HUD_HOLD_OPPONENT_POWERS_CAPTION}
                className="col-span-full flex min-h-[3.5rem] flex-row flex-wrap justify-center gap-x-4 gap-y-2 self-start overflow-visible py-2 pt-3 opacity-95 sm:hidden"
              >
                {opponent.powerCards.map((pid, i) => (
                  <div key={`ogr-${pid}-${i}`} className="flex shrink-0 flex-none justify-center">
                    <PowerCardVisual cardId={pid} revealed={false} small staticBackdrop />
                  </div>
                ))}
              </HoldDelayTooltip>

              <aside className="relative z-[6] col-span-full flex min-h-min w-full min-w-0 flex-col items-center gap-2 overflow-visible pb-2 pt-1 sm:col-span-1 sm:col-start-1 sm:row-start-2 sm:w-full sm:max-w-[15rem] sm:justify-self-start sm:self-stretch sm:pb-3">
                <div className="flex w-full shrink-0 flex-col items-stretch overflow-visible px-0.5 py-2">
                  <CurseZonePanel
                    settings={room.settings}
                    activeCurses={room.activeCurses}
                    prideCeilingCard={room.prideCeilingCard}
                    wrathMinionCard={room.wrathMinionCard}
                  />
                 </div>
              </aside>

              <div className="relative z-0 col-span-full flex min-h-0 min-w-0 flex-col items-center justify-self-center rounded-3xl px-1 pb-2 pt-1 sm:col-span-1 sm:col-start-2 sm:row-start-2 sm:w-full sm:max-w-[min(100%,min(94vw,44rem))] md:max-w-[min(100%,min(92vw,52rem))] xl:max-w-[min(100%,min(92vw,64rem))] sm:px-3">
                <div className="relative z-10 mt-[5%] flex w-full min-w-0 flex-row flex-wrap items-start justify-center gap-x-3 gap-y-2 sm:gap-x-5">
                  {room.status === 'playing' && opponent && !sacrificialBowlExpandedUi ? (
                    <HoldDelayTooltip
                      caption={sacrificialBowlHoldCaption(room)}
                      className="pointer-events-auto shrink-0 self-center sm:self-start isolation-auto !overflow-visible !p-0"
                      style={
                        displayCardArt?.mode === 'raster'
                          ? ornateGreenSacrificialBowlHudWrapStyle()
                          : { overflow: 'visible', padding: 0, isolation: 'auto' }
                      }
                    >
                      <div
                        onDragOver={me.confirmed ? undefined : handleSacrificialBowlDragOver}
                        onDrop={me.confirmed ? undefined : handleSacrificialBowlDrop}
                        className="flex flex-col items-center"
                      >
                        <SacrificialBowl
                          ref={sacrificialBowlCompactDropRef}
                          rasterMode={displayCardArt?.mode === 'raster'}
                          expanded={false}
                          catchGlow={me.confirmed ? false : sacrificialBowlCatchHover}
                          burnsRemaining={me.sacrificialBowlBurnsRemaining ?? 2}
                          lustFire={lustTripleWheel}
                        />
                      </div>
                    </HoldDelayTooltip>
                  ) : null}
                  <div className="relative flex min-w-0 flex-1 flex-col items-center">
               {!(
                 room.status === 'powering' &&
                 me.currentMove &&
                 opponent?.currentMove
               ) && (
                 <span className="mb-2 max-w-[min(100%,22rem)] px-2 text-center text-[10px] font-black uppercase leading-tight tracking-[0.24em] text-yellow-400/95 sm:mb-3 sm:text-[11px] sm:tracking-[0.26em]">
                   {room.status === 'powering'
                     ? powerShowdown
                       ? 'Cards locked — choose power effects next'
                       : 'Resolving power cards…'
                     : isWheelSpinning
                       ? 'DRAWING THIS ROUND’S TABLE SUIT…'
                       : 'TABLE SUIT FOR THIS ROUND'}
               </span>
               )}
               
               <AnimatePresence mode="wait">
                 {isWheelSpinning ? (
                   <motion.div
                     key="wheel"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 1.2 }}
                   >
                     <HoldDelayTooltip caption={HUD_HOLD_TARGET_SUIT_CAPTION} className="flex justify-center">
                       <TargetSuitWheel
                         suit={room.status === 'results' ? (room.lastOutcome?.targetSuit || room.targetSuit) : room.targetSuit}
                         isSpinning={isWheelSpinning}
                         offset={room.wheelOffset}
                         availableSuits={room.availableSuits}
                         lustTripleHearts={lustTripleWheel}
                         greedHalveBasicSuits={greedHalveWheel}
                         greedJointDiamondCoinGlyphs={greedHalveWheel}
                         artworkTable={artworkFelt}
                       />
                     </HoldDelayTooltip>
                   </motion.div>
                 ) : (
                   <motion.div
                     key="target-card"
                     initial={{ opacity: 0, rotateY: 90 }}
                     animate={{ opacity: 1, rotateY: 0 }}
                     className="flex flex-col items-center gap-3"
                   >
                     <HoldDelayTooltip caption={HUD_HOLD_TARGET_SUIT_CAPTION} className="flex flex-col items-center gap-3">
                     <div
                       className="flex flex-col items-center gap-3"
                       onDragOver={handleTablePlayTargetDragOver}
                       onDrop={handleTablePlayTargetDrop}
                     >
                     {(() => {
                       const ts = (room.status === 'results'
                         ? room.lastOutcome?.targetSuit || room.targetSuit
                         : room.targetSuit) as Suit | null;
                       const greedActive =
                         room.settings.enableCurseCards && greedCurseActive(room.activeCurses ?? []);
                       const joint = jointTableTrumpPair(ts, { greedActive });
                       return (
                         <>
                           {joint ? (
                             <DualTableTrumpCard suits={joint} />
                           ) : ts ? (
                             displayCardArt?.mode === 'raster' ? (
                               <div
                                 className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center overflow-hidden rounded-2xl border-4 border-amber-700/85 shadow-[0_0_40px_rgba(251,191,36,0.22)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                               >
                                 <img
                                   src={cardArtAssetUrl('GoldCard.png')}
                                   alt=""
                                   draggable={false}
                                   className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
                                 />
                                 <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px] opacity-[0.12]" />
                                 <div className="relative z-10 flex h-full w-full items-center justify-center p-[10%]">
                                   <SuitRasterOrGlyph
                                     suit={ts}
                                     className="max-h-[min(78%,10.5rem)] max-w-[min(78%,7.5rem)] object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)] sm:max-h-[min(78%,12.5rem)] sm:max-w-[min(78%,8.5rem)]"
                                   />
                                 </div>
                               </div>
                             ) : (
                               <div
                                 className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center rounded-2xl border-4 border-yellow-200 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.28)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                               >
                                 <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px] opacity-10" />
                                 </div>
                                 <div
                                   className={`relative z-10 ${SUIT_COLORS[ts] ?? 'text-white'} drop-shadow-[0_6px_22px_rgba(0,0,0,0.35)]`}
                                 >
                                   <SuitGlyph
                                     suit={ts}
                                     className="h-[4.75rem] w-[4.75rem] sm:h-[7.25rem] sm:w-[7.25rem]"
                                   />
                                 </div>
                               </div>
                             )
                           ) : (
                             <div
                               className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center rounded-2xl border-4 border-yellow-200 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.28)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                             >
                               <span className="relative z-10 text-5xl font-black text-yellow-950">?</span>
                             </div>
                           )}
                           <span className="pointer-events-none text-center text-[11px] font-black uppercase tracking-[0.12em] sm:text-xs opacity-[0.82]">
                             {joint ? (
                               <DualTrumpTableLabel
                                 suits={joint}
                                 className="uppercase tracking-[0.12em]"
                                 dividerClassName={displayCardArt?.mode === 'raster' ? 'text-slate-300' : 'text-slate-400'}
                                 suitNamesOnGreenFelt={displayCardArt?.mode === 'raster'}
                               />
                             ) : ts ? (
                               <span
                                 className={
                                   displayCardArt?.mode === 'raster' ? tableTrumpSuitNameClass(ts) : SUIT_COLORS[ts] ?? ''
                                 }
                               >
                                 {ts}
                     </span>
                             ) : null}
                           </span>
                         </>
                       );
                     })()}
                     </div>
                     </HoldDelayTooltip>
                   </motion.div>
                 )}
               </AnimatePresence>
               {room.tyrantCrownPending != null && room.settings.enableCurseCards && (
                 <TyrantCrownTablePiece crownTotal={room.tyrantCrownPending.crownTotal} />
               )}
                  </div>
                </div>
              </div>

              <aside className="relative z-0 hidden min-h-0 w-full min-w-0 flex-col items-center justify-between gap-2 pt-1 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:flex sm:max-w-[min(9rem,calc((100vw-2rem)*0.22))] sm:pt-2">
                <HoldDelayTooltip caption={HUD_HOLD_DECK_CAPTION} className="relative shrink-0">
                <div className="relative group shrink-0">
                  <div className="relative h-[8.4rem] w-[5.88rem] sm:h-[9.6rem] sm:w-[7.32rem]">
                    {deckBackRasterUrl
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="absolute inset-0 overflow-hidden rounded-lg shadow-2xl ring-1 ring-black/25"
                            style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}
                          >
                            <img
                              src={deckBackRasterUrl}
                              alt=""
                              draggable={false}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))
                      : Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="absolute inset-0 rounded-lg border-2 border-purple-600/50 bg-purple-950 shadow-2xl"
                            style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}
                          >
                            <div className="flex h-full w-full flex-col items-center justify-center p-3 opacity-20">
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                                <WolfIcon />
                                <Rabbit className="h-8 w-8 text-purple-400" />
                              </div>
                            </div>
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] bg-[length:10px_10px] opacity-10" />
                          </div>
                        ))}
                  </div>
                  <div className="mt-4 flex flex-col items-center">
                    <div className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">
                      {room.deck.length}
                    </div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-emerald-800">REMAINING</div>
                  </div>
                </div>
                </HoldDelayTooltip>
              </aside>
            </div>
          ) : null}
      </div>

      <AnimatePresence>
        {room.status === 'powering' && (
          <PowerResolutionOverlay
            room={room}
            myUid={myUid}
            lustHeartRules={lustHeartUi}
            powerShowdown={powerShowdown}
            greedJointTrumpUi={greedJointTrumpUi}
            opponentPendingDecision={opponentPendingDecision}
          />
        )}
      </AnimatePresence>

      {room.status === 'results' && room.lastOutcome && (
        <motion.div 
          key="results-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/98 z-[300] flex flex-col items-center justify-start overflow-hidden"
        >
          {panicClashOpen && room.lastOutcome?.panicFx && (
            <PanicClashResolution room={room} onComplete={dismissPanicClash} />
          )}
          <AnimatePresence mode="wait">
            {showResolutionSequence ? (
              <motion.div
                key="sequence"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.8 }}
                className="w-full h-full"
              >
                <ResolutionSequence
                  key={`rs-${room.currentTurn}-${resolutionReplayNonce}`}
                  room={room}
                  myUid={myUid}
                  replayNonce={resolutionReplayNonce}
                  onResolutionDiceRoll={setHudDiceRoll}
                  onComplete={() => setShowResolutionSequence(false)}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="static-results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 sm:gap-6 py-12 px-4 w-full h-full justify-center max-w-4xl mx-auto overflow-y-auto relative"
              >
                {room.lastOutcome.devilCurseSpin && (
                  <DevilCurseSpinOverlay
                    offset={room.lastOutcome.devilCurseSpin.offset}
                    curseId={room.lastOutcome.devilCurseSpin.curseId}
                  />
                )}
                {/* Captured Assets Section */}
                {room.lastOutcome.gains && (
                  <>
                    <AcquiredAssets 
                      gains={room.lastOutcome.gains[room.hostUid] || []}
                      side="left"
                      label={room.players[room.hostUid].name}
                      acquisitionPace={famineBannerPhase === 'bone_deal' ? 'deliberate' : 'normal'}
                    />
                    <AcquiredAssets
                      gains={
                        room.lastOutcome.gains[Object.keys(room.players).find((id) => id !== room.hostUid)!] || []
                      }
                      side="right" 
                      label={room.players[Object.keys(room.players).find((id) => id !== room.hostUid)!].name}
                      acquisitionPace={famineBannerPhase === 'bone_deal' ? 'deliberate' : 'normal'}
                    />
                  </>
                )}

                <div className="flex flex-col items-center mb-2">
                  <span className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-1">Round Result</span>
                  <h2 className={`text-4xl sm:text-7xl font-black uppercase italic tracking-tighter text-center leading-none ${
                    room.lastOutcome.winnerUid === 'draw' ? 'text-purple-500' : 
                    (room.players[room.lastOutcome.winnerUid].role === 'Preydator' ? 'text-purple-500' :
                     (room.players[room.lastOutcome.winnerUid].role === 'Predator' ? 'text-red-500' : 'text-blue-400'))
                  }`}>
                    {room.lastOutcome.winnerUid === 'draw' ? 'STALEMATE' : `${room.players[room.lastOutcome.winnerUid].name} WINS`}
                  </h2>
                </div>

                <div className="flex items-center justify-center gap-6 sm:gap-16 w-full py-4">
                  {[room.hostUid, Object.keys(room.players).find(id => id !== room.hostUid)!].map((uid, seatIdx) => (
                    <div key={uid} className="flex flex-col items-center gap-3 relative scale-100 sm:scale-110 origin-top">
                      <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-slate-900 border border-slate-700 mb-1 ${room.players[uid].role === 'Predator' ? 'text-red-400' : (room.players[uid].role === 'Preydator' ? 'text-purple-400' : 'text-blue-400')}`}>
                        {room.players[uid].name}
                      </div>
                      {room.lastOutcome?.wrathFx && room.lastOutcome.wrathFx.targetUid === uid && (
                        <motion.div
                          className="pointer-events-none absolute top-10 left-1/2 z-40 flex w-[10rem] -translate-x-1/2 justify-center sm:w-[11rem]"
                          initial={{ y: -6, opacity: 1 }}
                          animate={{ y: [0, -10, 0], opacity: 1 }}
                          transition={{
                            y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
                          }}
                        >
                          <div className="origin-top scale-[0.62] drop-shadow-[0_0_28px_rgba(220,38,38,0.5)] sm:scale-[0.68]">
                            <CardVisual
                              card={room.lastOutcome.wrathFx.minionCard}
                              revealed
                              noAnimate
                              presentation="none"
                              small
                            />
                          </div>
                        </motion.div>
                      )}
                      <div className="relative inline-block">
                        <div className="relative z-10">
                          <CardVisual
                            card={
                              (room.lastOutcome.panicFx &&
                              room.lastOutcome.initialCardsPlayed &&
                              panicOutcomeDiceRollId &&
                              panicOutcomeCardsRevealedDiceId !== panicOutcomeDiceRollId
                                ? room.lastOutcome.initialCardsPlayed
                                : room.lastOutcome.cardsPlayed)[uid]!
                            }
                            revealed
                            presentation="none"
                            noAnimate
                            clashGhost={Boolean(room.lastOutcome.clashDestroyedByPenalty?.[uid])}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                   <div className="h-px w-full bg-linear-to-r from-transparent via-slate-800 to-transparent" />
                   
                   <p className="text-white text-sm sm:text-lg font-black italic text-center tracking-tight leading-snug">
                     {room.lastOutcome.message}
                   </p>

                   {/* Event Log Display */}
                   <div className="w-full flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5 max-h-[150px] overflow-y-auto custom-scrollbar">
                     {room.lastOutcome.events.map((evt: ResolutionEvent, i: number) => (
                       <div key={i} className="flex gap-2 text-[9px] uppercase tracking-wider font-bold">
                         <span className="text-slate-600 font-mono">{(i+1).toString().padStart(2, '0')}</span>
                         <span className={resolutionLogLineClass(evt)}>
                           {formatRoundResultEventMessage(evt)}
                         </span>
                       </div>
                     ))}
                   </div>
                   
                   <div className="mt-2 flex flex-nowrap items-center justify-center gap-3 sm:gap-5">
                     <button 
                      onClick={handleNextRound}
                      disabled={loading || me.readyForNextRound}
                      className="group relative bg-yellow-400 text-black px-12 sm:px-20 py-4 sm:py-5 rounded-full font-black uppercase text-sm sm:text-base shadow-[0_0_50px_rgba(250,204,21,0.2)] hover:shadow-[0_0_80px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                     >
                       <span className="relative z-10">{me.readyForNextRound ? 'WAITING FOR OTHER...' : 'READY FOR NEXT ROUND'}</span>
                       <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity rounded-full" />
                     </button>
                     {(panicDiceResultsVisible || panicDiceResultsUsedVisible) && (
                      <div className="relative flex shrink-0 flex-col items-center">
                         {panicDiceResultsInteractive ? (
                           <button
                             type="button"
                             onClick={() => setPanicDiceConfirmOpen(true)}
                             title="Use panic dice once per game after the round is resolved."
                             className="group outline-none transition-transform hover:scale-[1.05] active:scale-95"
                           >
                             <img
                               src={cardArtAssetUrl('PanicDice.png')}
                               alt=""
                               draggable={false}
                                className="relative h-[4.4rem] w-auto max-w-[5.8rem] sm:h-[5rem] sm:max-w-[6.5rem] object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)] transition-[filter] group-hover:brightness-110 group-hover:drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                             />
                             <span className="pointer-events-none block text-center text-[7px] font-black uppercase tracking-widest text-amber-400/95">
                               Use dice
                             </span>
                           </button>
                         ) : (
                           <>
                             <div
                               role="presentation"
                               className="cursor-not-allowed outline-none select-none"
                               onMouseEnter={() => setPanicDiceResultsHover(true)}
                               onMouseLeave={() => setPanicDiceResultsHover(false)}
                               aria-label={PANIC_DICE_USED_HOVER}
                             >
                               <img
                                 src={cardArtAssetUrl('PanicDice.png')}
                                 alt=""
                                 draggable={false}
                                className="pointer-events-none relative h-[4.4rem] w-auto max-w-[5.8rem] sm:h-[5rem] sm:max-w-[6.5rem] object-contain opacity-[0.5] saturate-0 grayscale contrast-95 brightness-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                               />
                             </div>
                             <span className="pointer-events-none mt-0.5 block text-center text-[7px] font-black uppercase tracking-widest text-slate-500">
                               Dice used
                             </span>
                             {panicDiceResultsHover ? (
                               <div
                                 style={displayCardArt?.mode === 'raster' ? ornateGreenTooltipRasterStyle() : undefined}
                                 className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[340] max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 ${
                                   displayCardArt?.mode === 'raster'
                                     ? HUD_HOLD_TOOLTIP_RASTER_PANEL_CLASS
                                     : HUD_INSTANT_TOOLTIP_PANEL_CLASS
                                 }`}
                               >
                                 {PANIC_DICE_USED_HOVER}
                               </div>
                             ) : null}
                           </>
                         )}
                       </div>
                     )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Bottom strip: hand & powers · desperation capsule last (napkin div9 under cards) */}
      <div className="relative z-10 mt-auto shrink-0 overflow-x-visible overflow-y-visible px-4 pb-4">
        <div className="mb-2 flex items-end justify-between">
           <div className="flex flex-col">
              <span className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">Cards: {me.hand.length}</span>
           </div>
           
           <div className="flex items-center gap-3">
             {me.hand.length === 1 &&
               desperationSpinAllowed(room, myUid, me) &&
               !me.confirmed &&
               me.desperationTier < room.settings.tiers.length && (
                <motion.div 
                  initial={{ scale: 0, y: 50, x: '-50%' }}
                  animate={{ scale: 1, y: 0, x: '-50%' }}
                  className="absolute left-1/2 bottom-64 z-[50]"
                >
                  <button 
                    onClick={handleOpenDesperationWheel}
                    className="bg-purple-900 border-2 border-purple-500 text-white px-10 py-6 rounded-3xl text-sm font-black uppercase flex flex-col items-center gap-3 hover:bg-purple-600 transition-all shadow-[0_0_60px_rgba(168,85,247,0.5)] hover:scale-110 active:scale-95 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent group-hover:from-purple-500/40 transition-all" />
                    <Skull className="w-8 h-8 relative z-10 animate-pulse" /> 
                    <span className="relative z-10">Last-chance desperation spin</span>
                    <span className="text-[10px] opacity-60 relative z-10">
                      {desperationLadderLabel(
                        room.settings.tiers,
                        me.desperationTier < 0 ? 1 : me.desperationTier + 1,
                      ) ?? 'Next rung'}
                    </span>
                  </button>
                </motion.div>
             )}
             {me.confirmed && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Locked in — waiting</span>}
           </div>
        </div>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-4 overflow-x-visible overflow-y-visible px-0 pb-1 sm:px-1">
          <div
            ref={handHudLayoutRef}
            className={`mx-auto box-border w-full min-w-0 max-w-[min(100vw-1.25rem,120rem)] overflow-x-visible overflow-y-visible px-0 sm:px-1 ${
              handHudNeedsStack
                ? 'flex flex-col items-center gap-y-10'
                : 'grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-6 sm:gap-x-10 md:gap-x-14 lg:gap-x-16'
            }`}
          >
            {/* Powers — left of hand · extra left inset so overlaps / shadows aren’t clipped */}
            <div
              className={`relative z-[14] flex min-h-0 min-w-0 flex-col justify-end overflow-visible pb-2 pl-3 pt-4 sm:pl-6 ${
                handHudNeedsStack
                  ? 'order-1 w-full max-w-full items-center pb-4 pl-4 pt-8 sm:pl-6'
                  : 'col-span-1 col-start-1 row-start-1 items-end justify-end justify-self-stretch'
              }`}
            >
              {(room.status === 'playing' || room.status === 'powering') && me.powerCards.length > 0 ? (
                <div
                  className={`flex min-w-0 max-w-none shrink-0 flex-col overflow-visible ${
                    handHudNeedsStack ? 'w-full max-w-full items-center' : 'w-full items-end'
                  }`}
                >
                  <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90 sm:text-right">
                    Your powers
                  </span>
                  <div className="-space-x-4 flex w-max max-w-none min-w-0 flex-nowrap items-end justify-center overflow-visible px-2 pb-2 pt-1 sm:-space-x-6 sm:justify-end sm:pr-2 sm:pl-1">
                    {me.powerCards.map((pId, i) => (
                      <div key={`bottom-pow-${pId}-${i}`} className="relative shrink-0" style={{ zIndex: 8 + i }}>
                        <div
                          className={`rounded-xl transition-[filter,box-shadow] ${
                            activePowerCardId === pId
                              ? 'shadow-[0_0_30px_rgba(250,204,21,0.42)] drop-shadow-[0_0_14px_rgba(250,204,21,0.5)] saturate-110'
                              : ''
                          }`}
                        >
                          <PowerCardVisual
                            cardId={pId}
                            matchHandCard
                            selected={activePowerCardId === pId}
                            onClick={() => !me.confirmed && handleTogglePowerCard(pId)}
                            disabled={me.confirmed || (curseSelectionLocked && isCurseCardId(pId))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          {/* Hand — centred in the viewport row */}
          <div
            className={`relative mx-auto flex min-h-[13rem] min-w-0 max-w-none flex-col justify-end overflow-visible sm:min-h-[12rem] ${
              room.status === 'playing' && selectedCardIndex !== null && !me.confirmed ? 'z-[24]' : 'z-[12]'
            } ${handHudNeedsStack ? 'order-2 w-full max-w-full' : 'col-start-2 row-start-1 justify-self-center'}`}
          >
            <div
              ref={handRowRef}
              className={`select-none flex min-h-[12rem] w-full items-end justify-center overflow-visible -space-x-6 flex-nowrap px-1 transition-[filter,opacity] duration-300 sm:min-h-[11.5rem] sm:-space-x-9 ${
                me.confirmed ? 'saturate-[0.68] brightness-95 opacity-[0.92]' : ''
              }`}
              style={{ transform: 'translateY(-8px)' }}
            >
              {(suppressHandCardsUi
                ? []
                : handDealVisibleCount === null
                  ? me.hand
                  : me.hand.slice(0, handDealVisibleCount)
              ).map((card, i) => {
                const initialDealAnimating = handDealVisibleCount !== null && !suppressHandCardsUi;
                const visibleHandLen =
                  suppressHandCardsUi || handDealVisibleCount === null
                    ? me.hand.length
                    : Math.max(1, handDealVisibleCount);
                const selected = selectedCardIndex === i;
                const fan = playerHandFanMotion(i, visibleHandLen, fanSqueeze);
                const dragGapActive =
                  handDragFromIndex !== null &&
                  handDragHoverIndex !== null &&
                  handDragFromIndex !== handDragHoverIndex;
                const gapPush = dragGapActive ? 30 : 0;
                let gapShift = 0;
                if (
                  dragGapActive &&
                  handDragFromIndex !== null &&
                  handDragHoverIndex !== null &&
                  me.hand.length > 1
                ) {
                  const { left, right } = handReorderGapNeighborIndices(
                    handDragFromIndex,
                    handDragHoverIndex,
                    me.hand.length,
                  );
                  const fromIdx = handDragFromIndex;
                  if (left !== null && left !== fromIdx && i === left) gapShift -= gapPush;
                  if (right !== null && right !== fromIdx && i === right) gapShift += gapPush;
                }
                const prideMuted = prideBlocksCard(room, myUid, card);
                const envyMuted = envySealBlocksHandIndex(room, myUid, me.hand, i);
                const envyCovetedHere = Boolean(
                  room.settings.enableCurseCards &&
                    envyCurseActive(room.activeCurses ?? []) &&
                    room.envyCovet?.uid === myUid &&
                    room.envyCovet.handIndex === i &&
                    room.envyCovet.cardId === card,
                );
                const detailTooltip = prideMuted
                  ? PRIDE_WOUND_TOOLTIP
                  : envyMuted
                    ? ENVY_SEALED_TOOLTIP
                    : envyCovetedHere
                      ? ENVY_COVET_CARD_TOOLTIP
                      : card === GROVEL_CARD_ID
                        ? GROVEL_FEED_TOOLTIP
                        : undefined;
                const combinedMuted = prideMuted || envyMuted;
                /** Stable identity per multiset slot so reorder doesn’t remap React keys → no deal entrance replay. */
                const occurrenceKey = handSlotOccurrenceRank(me.hand, i);
                const isShopPack = isShopPackPlaceholder(card);
                return (
                  <motion.div
                    key={`${card}#${occurrenceKey}`}
                    style={{ transformOrigin: 'bottom center' }}
                    animate={
                      selected
                        ? { y: -30 + fan.y, rotate: fan.rotate, x: fan.x + gapShift, zIndex: 55 }
                        : { y: fan.y, rotate: fan.rotate, x: fan.x + gapShift, zIndex: fan.baseZ }
                    }
                    transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
                    layout={false}
                    className={`relative ${!me.confirmed && !isShopPack && !initialDealAnimating ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    draggable={!me.confirmed && !isShopPack && !initialDealAnimating}
                    onDragStart={(e) => {
                      if (me.confirmed || isShopPack || initialDealAnimating) return;
                      setHandDragFromIndex(i);
                      setHandDragHoverIndex(i);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(i));
                    }}
                    onDragOver={(e) => {
                      if (me.confirmed || isShopPack || initialDealAnimating) return;
                      e.preventDefault();
                      setHandDragHoverIndex(i);
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (me.confirmed || isShopPack || initialDealAnimating) return;
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      setHandDragFromIndex(null);
                      setHandDragHoverIndex(null);
                      if (!Number.isFinite(from)) return;
                      void reorderMyHandSlots(from, i);
                    }}
                    onDragEnd={() => {
                      setHandDragFromIndex(null);
                      setHandDragHoverIndex(null);
                    }}
                  >
                    {envyCovetedHere && (
                      <motion.div
                        className="pointer-events-none absolute -top-[3.8rem] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center"
                        title={ENVY_COVET_CARD_TOOLTIP}
                        initial={{ y: 0 }}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="origin-center scale-[0.52] drop-shadow-[0_0_14px_rgba(16,185,129,0.5)] sm:scale-[0.56]">
                          <PowerCardVisual cardId={CURSE_GREEN_EYED_MONSTER} small revealed curseRackPeek />
                        </div>
                      </motion.div>
                    )}
                    {selected && !me.confirmed && (
                      <span className="absolute -top-10 left-1/2 z-40 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.65)]">
                        choosing
                      </span>
                    )}
                    {selected && me.confirmed && (
                      <span className="absolute -top-10 left-1/2 z-40 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.55)]">
                        committed
                      </span>
                    )}
                    <CardVisual
                      card={card}
                      selected={selected}
                      disabled={me.confirmed}
                      muted={combinedMuted}
                      envyCovetedGlow={Boolean(envyCovetedHere && !envyMuted)}
                      detailTooltip={detailTooltip}
                      lustHeartRulesActive={lustHeartUi}
                      onClick={() => !me.confirmed && !combinedMuted && !isShopPack && !initialDealAnimating && setSelectedCardIndex(i)}
                      role={me.role}
                      presentation={initialDealAnimating ? 'deckPull' : 'none'}
                      delay={0}
                      motionLayout={false}
                      handUniformRasterScale={handUniformRasterScale}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
          {/* Panic dice — right of hand */}
          {!handHudNeedsStack ? (
            <div className="relative z-[13] col-start-3 row-start-1 flex min-h-0 min-w-0 flex-col items-start justify-end justify-self-stretch overflow-visible pb-2 pr-3 pt-4 pl-1 sm:pr-6 sm:pl-2 md:items-end">
              {panicDiceStripVisible ? (
                <>
                  <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90 sm:w-auto sm:text-left md:text-right">
                    Panic Dice
                  </span>
                  <div className="relative flex w-full max-w-none min-w-0 flex-col items-center overflow-visible sm:items-start md:items-end">
                    {panicDiceStripInteractive ? (
                      <button
                        type="button"
                        onMouseEnter={() => setPanicDiceStripHover(true)}
                        onMouseLeave={() => setPanicDiceStripHover(false)}
                        onFocus={() => setPanicDiceStripHover(true)}
                        onBlur={() => setPanicDiceStripHover(false)}
                        onClick={() => setPanicDiceStripExplainOpen(true)}
                        className="group relative cursor-help outline-none transition-transform hover:scale-[1.03] active:scale-95 [&:focus-visible]:ring-2 [&:focus-visible]:ring-amber-400/80"
                        aria-label="Panic dice — not usable until round results"
                      >
                        <img
                          src={cardArtAssetUrl('PanicDice.png')}
                          alt=""
                          draggable={false}
                          className="relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] opacity-85 object-contain saturate-[0.92] contrast-[1.03] grayscale-[0.12] transition-[filter,opacity] group-hover:opacity-95 group-hover:grayscale-[0.05] drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)] sm:h-32"
                        />
                      </button>
                    ) : (
                      <div
                        role="presentation"
                        className="cursor-not-allowed select-none outline-none"
                        aria-label={PANIC_DICE_USED_HOVER}
                        onMouseEnter={() => setPanicDiceStripHover(true)}
                        onMouseLeave={() => setPanicDiceStripHover(false)}
                      >
                        <img
                          src={cardArtAssetUrl('PanicDice.png')}
                          alt=""
                          draggable={false}
                          className="pointer-events-none relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] object-contain opacity-[0.5] saturate-0 grayscale contrast-95 brightness-110 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] sm:h-32"
                        />
                      </div>
                    )}
                    {panicDiceStripHover ? (
                      <div
                        style={displayCardArt?.mode === 'raster' ? ornateGreenTooltipRasterStyle() : undefined}
                        className={`pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[60] max-w-[min(20rem,calc(100vw-3rem))] -translate-x-1/2 sm:left-0 sm:max-w-[min(22rem,calc(100vw-11rem))] sm:translate-x-0 ${
                          displayCardArt?.mode === 'raster'
                            ? HUD_HOLD_TOOLTIP_RASTER_PANEL_CLASS
                            : HUD_INSTANT_TOOLTIP_PANEL_CLASS
                        }`}
                      >
                        {panicStripHoverText}
                      </div>
                    ) : null}
                  </div>
                  <span className="pointer-events-none mt-1 w-full text-center text-[7px] font-black uppercase tracking-widest text-slate-500 sm:text-left md:text-right">
                    {panicStripFootnote}
                  </span>
                </>
              ) : null}
            </div>
          ) : panicDiceStripVisible ? (
            <div className="relative z-[13] order-3 flex w-full max-w-md flex-col items-center justify-end pb-4 pt-6">
              <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90">
                Panic Dice
              </span>
              <div className="relative flex flex-col items-center">
                {panicDiceStripInteractive ? (
                  <button
                    type="button"
                    onMouseEnter={() => setPanicDiceStripHover(true)}
                    onMouseLeave={() => setPanicDiceStripHover(false)}
                    onFocus={() => setPanicDiceStripHover(true)}
                    onBlur={() => setPanicDiceStripHover(false)}
                    onClick={() => setPanicDiceStripExplainOpen(true)}
                    className="group relative cursor-help outline-none transition-transform hover:scale-[1.03] active:scale-95 [&:focus-visible]:ring-2 [&:focus-visible]:ring-amber-400/80"
                    aria-label="Panic dice — not usable until round results"
                  >
                    <img
                      src={cardArtAssetUrl('PanicDice.png')}
                      alt=""
                      draggable={false}
                      className="relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] opacity-85 object-contain saturate-[0.92] contrast-[1.03] grayscale-[0.12] transition-[filter,opacity] group-hover:opacity-95 group-hover:grayscale-[0.05] drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)] sm:h-32"
                    />
                  </button>
                ) : (
                  <div
                    role="presentation"
                    className="cursor-not-allowed select-none outline-none"
                    aria-label={PANIC_DICE_USED_HOVER}
                    onMouseEnter={() => setPanicDiceStripHover(true)}
                    onMouseLeave={() => setPanicDiceStripHover(false)}
                  >
                    <img
                      src={cardArtAssetUrl('PanicDice.png')}
                      alt=""
                      draggable={false}
                      className="pointer-events-none relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] object-contain opacity-[0.5] saturate-0 grayscale contrast-95 brightness-110 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] sm:h-32"
                    />
                  </div>
                )}
                {panicDiceStripHover ? (
                  <div
                    style={displayCardArt?.mode === 'raster' ? ornateGreenTooltipRasterStyle() : undefined}
                    className={`pointer-events-none absolute bottom-full left-1/2 z-[60] mb-3 max-w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 ${
                      displayCardArt?.mode === 'raster'
                        ? HUD_HOLD_TOOLTIP_RASTER_PANEL_CLASS
                        : HUD_INSTANT_TOOLTIP_PANEL_CLASS
                    }`}
                  >
                    {panicStripHoverText}
                  </div>
                ) : null}
              </div>
              <span className="pointer-events-none mt-1 text-center text-[7px] font-black uppercase tracking-widest text-slate-500">
                {panicStripFootnote}
              </span>
            </div>
          ) : null}
        </div>
        </div>

      </div>

      {/* Win Modal Mini */}
      {room.status === 'finished' && (
        <div className="absolute inset-0 z-50 bg-emerald-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
           <AnimatePresence>
             {room.winner === myUid ? (
               <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                  <Trophy className="w-16 h-16 text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)]" />
                  <span className="text-5xl font-black text-yellow-400 mb-2 italic">WIN</span>
               </motion.div>
             ) : (
               <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                  <UtensilsCrossed className="w-16 h-16 text-red-500 mb-4 opacity-50" />
                  <span className="text-5xl font-black text-red-500 mb-2 italic">LOSE</span>
               </motion.div>
             )}
           </AnimatePresence>
           
           <span className="text-lg font-black uppercase text-white tracking-[0.2em] px-8 max-w-sm">
             {room.winner === myUid ? (
               me.role === 'Predator' ? 'YOU DEVOURED YOUR PREY' : 
               me.role === 'Prey' ? 'YOU ESCAPED THE PREDATOR' :
               me.role === 'Preydator' ? `YOU OUTLASTED ${opponent?.name || 'OPPONENT'}` :
               'OBJECTIVE ACHIEVED'
             ) : (
               me.role === 'Predator' ? 'YOUR PREY ESCAPED' : 
               me.role === 'Prey' ? 'YOU WERE DEVOURED' :
               me.role === 'Preydator' ? `${opponent?.name || 'PREYDATOR'} DEVOURED YOU` :
               'HAND OVER'
             )}
           </span>

           {(me.desperationTier > 0 || (opponent && opponent.desperationTier > 0)) && (
             <div className="mt-4 flex flex-col items-center gap-2">
                {me.desperationTier > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Your desperation tier</span>
                    <span className="text-xs text-white font-black uppercase text-center">
                       {desperationLadderLabel(room.settings.tiers, me.desperationTier) ?? ''} 
                       {me.desperationResult && <span className="text-purple-400 ml-2">[{me.desperationResult}]</span>}
                    </span>
                  </div>
                )}
                {opponent && opponent.desperationTier > 0 && (
                  <div className="flex flex-col items-center opacity-60">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Opponent&apos;s desperation tier</span>
                    <span className="text-xs text-purple-300 font-bold uppercase text-center">
                       {desperationLadderLabel(room.settings.tiers, opponent.desperationTier) ?? ''}
                       {opponent.desperationResult && <span className="text-purple-500 ml-2">[{opponent.desperationResult}]</span>}
                    </span>
                  </div>
                )}
             </div>
           )}
           <button
             type="button"
             onClick={() => {
               wipeDualReconnectSnapshots();
               setRoomId(null);
             }}
             className="mt-8 text-[12px] text-emerald-500 hover:text-white uppercase font-black tracking-[0.3em] border border-emerald-800 px-8 py-3 rounded-full hover:bg-emerald-900 transition-all"
           >
             Back to menu
           </button>
        </div>
      )}

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && <RulesSheet key="rules-modal" settings={room.settings} onClose={() => setShowRules(false)} />}
      </AnimatePresence>
    </div>
    </div>
    </DisplayCardArtModeOverride>
    </CardArtSessionBridge>
  );
};

