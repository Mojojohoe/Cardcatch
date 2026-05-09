/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Coins, Moon } from 'lucide-react';
import {
  parseCard,
  playingCardUpgradeSteps,
  lustHeartUpgradeSteps,
  describeWrathMinionTitle,
  displaySuitCardValue,
  type DiceTestRollPayload,
} from '../services/gameService';
import { RoomData, ResolutionEventType } from '../types';
import { diceTestCoinFlipPayload, diceTestRollPayloadFromValues } from '../utils/diceTestRollPayload';
import {
  CardVisual,
  cursePowerIconClass,
  PowerCardVisual,
  SUIT_COLORS,
} from '../components/GameVisuals';
import { SuitGlyph } from '../components/SuitGlyphs';
import { ConfigurableWheel, resolveWheelSegments, slothDreamWheelDefinition } from '../wheels';
import { resolutionLogLineClass } from '../utils/resolutionLogColors';
import {
  RESOLUTION_UPGRADE_INTRO_MS,
  RESOLUTION_UPGRADE_PAUSE_MS,
  RESOLUTION_UPGRADE_WIGGLE_MS,
} from './resolutionTiming';
import {
  deriveResolutionFx,
  resolutionColumnMotion,
  ResolutionTearOverlay,
  type ResolutionFx,
} from './resolutionFx';
import { usePlayerDisplayPreferences } from '../playerDisplayPreferences';
import { playSfx } from '../audio/sfx';
import { jointTableTrumpPair } from '../suitPresentation';
import {
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_ENVY,
  CURSE_PRIDE,
  CURSE_SLOTH,
  CURSE_WRATH,
  CURSES,
  CURSE_IDS,
  greedCurseActive,
  gluttonyCurseActive,
  lustCurseActive,
} from '../curses';

const SLOTH_DREAM_WHEEL_SEGMENTS = resolveWheelSegments(slothDreamWheelDefinition);

const ENVY_RESOLUTION_MONSTER_TOOLTIP = 'The Green-Eyed Monster must be stopped!';

export const ResolutionSequence: React.FC<{
  room: RoomData;
  myUid: string;
  onComplete: () => void;
  /** Fullscreen dice replay for host-authored `resolutionDice` (synced values). */
  onResolutionDiceRoll?: (payload: DiceTestRollPayload) => void;
  /** Bumps when recap replays so dice `rollId`s stay unique across runs. */
  replayNonce: number;
}> = ({ room, myUid: _myUid, onComplete, onResolutionDiceRoll, replayNonce }) => {
  const { sfxVolume } = usePlayerDisplayPreferences();
  const outcome = room.lastOutcome!;
  const [eventIndex, setEventIndex] = useState(-1);
  const [currentCards, setCurrentCards] = useState(() => ({ ...(outcome as any).initialCardsPlayed || outcome.cardsPlayed }));
  const [currentTarget, setCurrentTarget] = useState(room.targetSuit);
  const [summoned, setSummoned] = useState<Record<string, string>>({});
  const [devilStolen, setDevilStolen] = useState<Record<string, number>>({});
  const [visibleEvents, setVisibleEvents] = useState<
    {
      id: number;
      message: string;
      eventType?: ResolutionEventType;
      logClass?: string;
    }
  >([]);
  const [isDone, setIsDone] = useState(false);
  const [towerScorch, setTowerScorch] = useState<Record<string, boolean>>({});
  const [resolutionFx, setResolutionFx] = useState<ResolutionFx>(null);
  const [lustHeartBurst, setLustHeartBurst] = useState(false);
  /** Per-seat resolution morph on the played card (`transform` = identity flip only). */
  const [resolutionCardMorph, setResolutionCardMorph] = useState<Record<string, 'transform_out' | 'transform_in'>>({});
  const [resolutionCardMorphTick, setResolutionCardMorphTick] = useState<Record<string, number>>({});
  /** Bumped after each empower step so `CardVisual` replays a short wiggle without dropping artwork mode. */
  const [resolutionEmpowerWiggleTick, setResolutionEmpowerWiggleTick] = useState<Record<string, number>>({});
  const [resolutionEmpowerCaption, setResolutionEmpowerCaption] = useState<{ uid: string; text: string } | null>(null);
  const [resolutionPowerOverlay, setResolutionPowerOverlay] = useState<{ uid?: string; powerCardId: number } | null>(null);

  const lustHeartParticles = useMemo(() => {
    if (!outcome.lustRoundFx?.contributions.length) return [] as { uid: string; k: string }[];
    const out: { uid: string; k: string }[] = [];
    let g = 0;
    for (const c of outcome.lustRoundFx.contributions) {
      const pts = Math.max(0, Math.floor(c.lustPointsAdded));
      for (let h = 0; h < pts; h++) {
        out.push({ uid: c.uid, k: `lust-${g++}-${h}` });
      }
    }
    return out;
  }, [outcome.lustRoundFx]);
  const [postClashGhost, setPostClashGhost] = useState<Record<string, boolean>>({});
  const [envyShownHp, setEnvyShownHp] = useState<number | null>(
    outcome.envyRoundFx ? outcome.envyRoundFx.monsterHpStart : null,
  );
  const [slothDreamWheel, setSlothDreamWheel] = useState<{ offset: number; spinning: boolean } | null>(null);
  const [wrathAnim, setWrathAnim] = useState<
    null | { stage: 'center' | 'fly' | 'cutting'; cutIndex: number }
  >(null);
  const [wrathRevealDone, setWrathRevealDone] = useState(false);

  useEffect(() => {
    if (!isDone) return;
    setTowerScorch((prev) => {
      const next = { ...prev };
      Object.keys(room.players).forEach((uid) => {
        if (outcome.powerCardTowerBlocked?.[uid]) next[uid] = true;
      });
      return next;
    });
  }, [isDone, outcome.powerCardTowerBlocked, room.players]);

  useEffect(() => {
    let active = true;
    const processNext = async () => {
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;

      const hostUid = room.hostUid;
      const guestUid = Object.keys(room.players).find(id => id !== hostUid)!;

      const wf = outcome.wrathFx;
      if (wf && !wf.sparedJoker && wf.magnitude > 0 && wf.minionCard && wf.targetUid) {
        setWrathRevealDone(false);
        setWrathAnim({ stage: 'center', cutIndex: 0 });
        await new Promise((r) => setTimeout(r, 700));
        if (!active) return;
        setWrathAnim({ stage: 'fly', cutIndex: 0 });
        await new Promise((r) => setTimeout(r, 650));
        if (!active) return;
        setWrathAnim({ stage: 'cutting', cutIndex: 0 });
        for (let i = 1; i <= wf.magnitude; i++) {
          setWrathAnim({ stage: 'cutting', cutIndex: i });
          setResolutionFx({ kind: 'wrath_cut', victimUid: wf.targetUid });
          await new Promise((r) => setTimeout(r, 500));
          if (!active) return;
          setResolutionFx(null);
        }
        setWrathAnim(null);
        setWrathRevealDone(true);
      } else if (wf?.targetUid) {
        setWrathRevealDone(true);
      }
      
      const events = outcome.events || [];
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const fx = deriveResolutionFx(event, hostUid, guestUid);
        setResolutionFx(fx);
        if (fx?.kind === 'clash_shatter') {
          playSfx('/assets/sounds/Card-Tear.mp3', sfxVolume);
        }
        if (fx?.kind === 'death_slash' || fx?.kind === 'wrath_cut') {
          playSfx('/assets/sounds/Card-Slice.mp3', sfxVolume);
        }
        if (event.type === 'TRANSFORM') {
          playSfx('/assets/sounds/Card-Transform.mp3', sfxVolume);
        }
        if (event.type === 'COIN_FLIP' && (event.message ?? '').includes('unwraps Cash Chips')) {
          playSfx('/assets/sounds/Card-Buy.mp3', sfxVolume);
        }
        setEventIndex(i);
        const omitFromAnimatedResolutionLog =
          event.type === 'POWER_TRIGGER' &&
          (event.tokenOverkillDetail != null || /\(\s*overkill\s*\)/i.test(event.message ?? ''));
        if (!omitFromAnimatedResolutionLog) {
          setVisibleEvents((prev) => [
            ...prev,
            {
              id: Date.now() + i,
              message: event.message ?? '',
              eventType: event.type,
              logClass: resolutionLogLineClass(event),
            },
          ]);
        }

        if (event.resolutionDice?.length && onResolutionDiceRoll) {
          const dice = event.resolutionDice;
          const sides = event.coinFlipSides;
          const coinVal = dice[0];
          const isCoinBeat =
            sides &&
            dice.length === 1 &&
            (coinVal === 0 || coinVal === 1) &&
            room.players[sides.headsUid] &&
            room.players[sides.tailsUid];

          if (isCoinBeat) {
            onResolutionDiceRoll(
              diceTestCoinFlipPayload({
                coinValue: coinVal as 0 | 1,
                headsPlayerName: room.players[sides!.headsUid].name,
                tailsPlayerName: room.players[sides!.tailsUid].name,
                rollId: `reso-${room.currentTurn}-${i}-${replayNonce}`,
                uid: room.hostUid,
                presentation: 'resolutionPage',
              }),
            );
          } else {
            onResolutionDiceRoll(
              diceTestRollPayloadFromValues({
                dice,
                rollId: `reso-${room.currentTurn}-${i}-${replayNonce}`,
                uid: room.hostUid,
                presentation: 'resolutionPage',
              }),
            );
          }
        }
        if (event.type === 'POWER_TRIGGER' && typeof event.powerCardId === 'number') {
          setResolutionPowerOverlay({ uid: event.uid, powerCardId: event.powerCardId });
        } else {
          setResolutionPowerOverlay(null);
        }

        switch (event.type) {
          case 'CARD_SWAP':
            if (event.uid && event.cardId) {
               setCurrentCards(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            } else if (!event.uid) {
               const hu = hostUid;
               const gu = guestUid;
               setCurrentCards((prev) => {
                 if (prev[hu] === undefined || prev[gu] === undefined) return prev;
                 return { ...prev, [hu]: prev[gu], [gu]: prev[hu] };
               });
            }
            break;
          case 'TARGET_CHANGE':
            if (event.suit) setCurrentTarget(event.suit);
            break;
          case 'CARD_EMPOWER':
            if (event.uid && event.cardId && event.fromCardId) {
              const f = parseCard(event.fromCardId);
              const t = parseCard(event.cardId);
              const heartsLustLadder = f.suit === 'Hearts' && t.suit === 'Hearts';
              const steps = (
                heartsLustLadder
                  ? lustHeartUpgradeSteps(event.fromCardId, event.cardId)
                  : playingCardUpgradeSteps(event.fromCardId, event.cardId)
              ).filter(Boolean);
              if (steps.length > 1) {
                setResolutionEmpowerCaption({
                  uid: event.uid!,
                  text:
                    event.message?.trim() ||
                    (heartsLustLadder ? 'Lust empowers this heart.' : 'Empowering.'),
                });
                await new Promise((r) => setTimeout(r, RESOLUTION_UPGRADE_INTRO_MS));
                if (!active) return;
                const uidK = event.uid!;
                try {
                  for (let s = 0; s < steps.length; s++) {
                    const stepCard = steps[s];
                    setCurrentCards((prev) => ({ ...prev, [uidK]: stepCard }));
                    await new Promise((r) => setTimeout(r, RESOLUTION_UPGRADE_PAUSE_MS));
                    if (!active) return;
                    setResolutionEmpowerWiggleTick((prev) => ({
                      ...prev,
                      [uidK]: (prev[uidK] ?? 0) + 1,
                    }));
                    await new Promise((r) => setTimeout(r, RESOLUTION_UPGRADE_WIGGLE_MS));
                    if (!active) return;
                  }
                } finally {
                  setResolutionEmpowerCaption(null);
                  setResolutionEmpowerWiggleTick((prev) => {
                    const next = { ...prev };
                    delete next[uidK];
                    return next;
                  });
                }
              } else {
                setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
              }
            } else if (event.uid && event.cardId) {
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'SUMMON_CARD':
            if (event.uid && event.cardId) {
               setSummoned(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'POWER_TRIGGER':
            if (event.powerCardId === CURSE_LUST && event.lustFeedBegins) {
              await new Promise((r) => setTimeout(r, 480));
              if (!active) return;
              setLustHeartBurst(true);
            }
            if (event.powerCardId === CURSE_LUST && (event.lustFeedPts ?? 0) > 0 && event.uid) {
              if (event.lustSurgeHeart) {
                const u = event.uid!;
                const lustSurgeDwellMs = RESOLUTION_UPGRADE_WIGGLE_MS + 240;
                setResolutionEmpowerWiggleTick((prev) => ({ ...prev, [u]: (prev[u] ?? 0) + 1 }));
                await new Promise((r) => setTimeout(r, lustSurgeDwellMs));
                if (!active) return;
                setResolutionEmpowerWiggleTick((prev) => {
                  const next = { ...prev };
                  delete next[u];
                  return next;
                });
              }
            }
            if (event.uid) {
               // Devil specific UI feedback
               if (event.powerCardId === 15) {
                 const oUid = Object.keys(room.players).find(id => id !== event.uid)!;
                 const oPower = outcome.powerCardIdsPlayed[oUid];
                 if (oPower !== null && oPower !== 15 && oPower !== 16) {
                    setDevilStolen(prev => ({ ...prev, [event.uid!]: oPower }));
                 }
               }
            }
            break;
          case 'POWER_DESTROYED':
            if (event.uid) {
              setTowerScorch((prev) => ({ ...prev, [event.uid!]: true }));
            }
            break;
          case 'COIN_FLIP':
          case 'INTEL_REVEAL':
            break;
          case 'CLASH_DESTROYED':
            if (event.uid) setPostClashGhost((p) => ({ ...p, [event.uid]: true }));
            break;
          case 'TRANSFORM':
            if (event.uid && event.cardId && event.fromCardId && event.fromCardId !== event.cardId) {
              setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'transform_out' }));
              setResolutionCardMorphTick((m) => ({ ...m, [event.uid!]: (m[event.uid!] ?? 0) + 1 }));
              /** Phase A: warm-up pulse then rotate to side-on edge (`rotateY=-90`). */
              await new Promise((r) => setTimeout(r, 560));
        if (!active) return;
              /** Midpoint handoff: card is edge-on, so swap to destination face now. */
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
              /** Phase B: new face starts edge-on (`rotateY=90`) and unfolds to front. */
              setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'transform_in' }));
              await new Promise((r) => setTimeout(r, 560));
              if (!active) return;
              setResolutionCardMorph((m) => {
                const next = { ...m };
                delete next[event.uid!];
                return next;
              });
              setResolutionCardMorphTick((m) => {
                const next = { ...m };
                delete next[event.uid!];
                return next;
              });
            } else if (event.uid && event.cardId) {
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'ENVY_COVET':
            if (
              outcome.envyRoundFx &&
              typeof outcome.envyRoundFx.monsterHpAfterFeed === 'number' &&
              (event.envyDamage ?? 0) > 0
            ) {
              setEnvyShownHp(outcome.envyRoundFx.monsterHpAfterFeed);
            }
            break;
          case 'ENVY_STRIKE':
            if (typeof event.envyHpAfter === 'number') setEnvyShownHp(event.envyHpAfter);
            break;
          case 'SLOTH_DREAM':
            break;
          case 'GLUTTONY_DIGEST':
            break;
        }

        if (event.type === 'GLUTTONY_DIGEST' && event.uid && event.cardId && event.gluttonyBoneId) {
          await new Promise((r) => setTimeout(r, 760));
          if (!active) return;
          setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.gluttonyBoneId! }));
          await new Promise((r) => setTimeout(r, 320));
          if (!active) return;
          setResolutionFx(null);
        }

        let pauseMs =
          event.type === 'COIN_FLIP'
            ? event.resolutionDice?.length
              ? 5200
              : 5800
            : event.type === 'POWER_DESTROYED'
              ? 1500
              : event.type === 'CARD_EMPOWER' || event.type === 'TARGET_CHANGE'
                ? 1180
                : event.type === 'GLUTTONY_DIGEST'
                  ? 3200
                  : event.type === 'POWER_TRIGGER'
                    ? event.powerCardId === 10 && event.uid
                      ? 4500
                      : event.powerCardId === CURSE_LUST && (event.lustFeedPts ?? 0) > 0
                        ? 1320
                        : event.powerCardId === CURSE_GREED && (event.greedTaxPts ?? 0) > 0
                          ? 1150
                          : 1050
                  : event.type === 'ENVY_COVET' || event.type === 'ENVY_STRIKE' || event.type === 'ENVY_DEFEATED' || event.type === 'ENVY_DEPARTS'
                  ? 1280
                  : event.type === 'SLOTH_DREAM'
                    ? typeof event.slothDreamSpinOffset === 'number'
                      ? Math.round(slothDreamWheelDefinition.spinDurationSeconds * 1000 + 750)
                      : 1200
                    : 1150;
        if (fx?.kind === 'death_slash' || fx?.kind === 'wrath_cut')
          pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'envy_lunge') pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'clash_shatter') pauseMs = Math.max(pauseMs, 1640);
        if (fx?.kind === 'gluttony_bite') pauseMs = Math.max(pauseMs, 3400);
        if (fx?.kind === 'greed_coin_drain') pauseMs = Math.max(pauseMs, 1280);
        if (fx?.kind === 'judgement_flash' || fx?.kind === 'temperance_balance') pauseMs = Math.max(pauseMs, 1240);
        if (fx?.kind === 'fool_swap') pauseMs = Math.max(pauseMs, 1180);
        if (
          event.type === 'SLOTH_DREAM' &&
          typeof event.slothDreamSpinOffset === 'number' &&
          outcome.slothDreamFx
        ) {
          setSlothDreamWheel({ offset: event.slothDreamSpinOffset, spinning: true });
        }
        await new Promise(r => setTimeout(r, pauseMs));
        if (!active) return;
        if (
          event.type === 'SLOTH_DREAM' &&
          typeof event.slothDreamSpinOffset === 'number' &&
          outcome.slothDreamFx
        ) {
          setSlothDreamWheel({ offset: event.slothDreamSpinOffset, spinning: false });
          await new Promise((r) => setTimeout(r, 520));
          if (!active) return;
          setSlothDreamWheel(null);
        }
        setResolutionFx(null);
        if (event.type !== 'POWER_TRIGGER') setResolutionPowerOverlay(null);
      }
      
      setCurrentCards(prev => {
        const next = { ...outcome.cardsPlayed };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
      
      setEventIndex(events.length);
      setIsDone(true);
      // Increased delay to 3.5s to let the final state sink in
      await new Promise(r => setTimeout(r, 3500));
      if (!active) return;
      onComplete();
    };
    processNext();
    return () => {
      active = false;
      setResolutionFx(null);
      setSlothDreamWheel(null);
      setResolutionEmpowerCaption(null);
      setWrathAnim(null);
      setWrathRevealDone(false);
      setResolutionPowerOverlay(null);
    };
  }, [outcome.events, outcome.cardsPlayed, outcome.slothDreamFx, outcome.wrathFx, room.hostUid, room.players]);

  const hostUid = room.hostUid;
  const guestUid = Object.keys(room.players).find(id => id !== hostUid)!;

  const lustHeartResolution =
    room.settings.enableCurseCards &&
    (lustCurseActive(room.activeCurses ?? []) ||
      outcome.powerCardIdsPlayed[hostUid] === CURSE_LUST ||
      outcome.powerCardIdsPlayed[guestUid] === CURSE_LUST);

  const gluttonyShownInResolution =
    room.settings.enableCurseCards &&
    (gluttonyCurseActive(room.activeCurses ?? []) ||
      outcome.events?.some((e) => e.type === 'GLUTTONY_DIGEST'));

  const greedActiveResolution =
    room.settings.enableCurseCards && greedCurseActive(room.activeCurses ?? []);

  const jointTrump = jointTableTrumpPair(currentTarget, { greedActive: greedActiveResolution });

  const activeCursesSorted =
    room.settings.enableCurseCards && (room.activeCurses?.length ?? 0) > 0
      ? [...(room.activeCurses ?? [])].sort(
          (a, b) => CURSE_IDS.indexOf(a.id as (typeof CURSE_IDS)[number]) - CURSE_IDS.indexOf(b.id as (typeof CURSE_IDS)[number]),
        )
      : [];

  const lustHeartFlyCentered = activeCursesSorted.length > 1 && lustHeartResolution;

  const wfRes = outcome.wrathFx;
  const wrathTripleColumn = Boolean(wfRes && !wfRes.sparedJoker && wfRes.magnitude > 0);
  const wrathNeedsIntro = wrathTripleColumn;

  const showWrathAgentAbovePlayer = (uid: string) => {
    if (!wfRes || wfRes.targetUid !== uid || !wfRes.minionCard) return false;
    if (!wrathNeedsIntro) return true;
    if (wrathRevealDone) return true;
    if (wrathAnim && (wrathAnim.stage === 'fly' || wrathAnim.stage === 'cutting')) return true;
    return false;
  };

  return (
    <div className="relative flex max-h-screen w-full flex-col items-center overflow-hidden rounded-2xl border border-slate-800/50 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(251,191,36,0.14),transparent_58%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)] px-4 py-2 shadow-[inset_0_0_100px_rgba(15,23,42,0.55)] sm:px-6 sm:py-3 justify-start pt-1">
      <AnimatePresence>
        {slothDreamWheel && (
          <motion.div
            key="sloth-dream-wheel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-x-4 top-[16%] z-[95] mx-auto flex max-w-md flex-col items-center gap-2 sm:inset-x-8"
          >
            <span className="text-center text-[11px] font-black uppercase italic tracking-[0.2em] text-indigo-200/95">
              Sloth is dreaming ofâ€¦
            </span>
            <ConfigurableWheel
              definition={slothDreamWheelDefinition}
              segments={SLOTH_DREAM_WHEEL_SEGMENTS}
              offset={slothDreamWheel.offset}
              spinning={slothDreamWheel.spinning}
              sizeClass="w-[14.5rem] h-[14.5rem] sm:w-64 sm:h-64"
              decorativeRings
            />
          </motion.div>
        )}
      </AnimatePresence>
      {lustHeartBurst && lustHeartParticles.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[85] overflow-hidden">
          {lustHeartParticles.map((part, i) => (
            <motion.div
              key={part.k}
              initial={{
                opacity: 0,
                scale: 0.22,
                left: part.uid === hostUid ? '36%' : '64%',
                top: '54%',
              }}
              animate={{
                opacity: [0, 1, 0.9, 0],
                scale: [0.22, 0.94, 0.72],
                left: lustHeartFlyCentered
                  ? '50%'
                  : lustHeartResolution
                    ? '12%'
                    : part.uid === hostUid
                      ? '36%'
                      : '64%',
                top: lustHeartFlyCentered ? '22%' : lustHeartResolution ? '21%' : '48%',
              }}
              transition={{
                duration: lustHeartResolution ? 1.28 : 0.85,
                delay: i * 0.042,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 sm:h-8 sm:w-8"
            >
              <Heart className="h-full w-full fill-red-600 text-red-300 drop-shadow-[0_0_14px_rgba(239,68,68,0.95)]" />
            </motion.div>
          ))}
        </div>
      )}
      {resolutionFx?.kind === 'greed_coin_drain' && (
        <div className="pointer-events-none absolute inset-0 z-[86] overflow-hidden">
          {Array.from({ length: Math.min(5, Math.max(1, Math.floor(resolutionFx.pts))) }).map((_, i) => (
            <motion.div
              key={`greed-coin-${resolutionFx.uid}-${i}`}
              initial={{
                opacity: 0,
                scale: 0.2,
                left: resolutionFx.uid === hostUid ? '36%' : '64%',
                top: '54%',
              }}
              animate={{
                opacity: [0, 1, 0.88, 0],
                scale: [0.2, 0.92, 0.68],
                left: '50%',
                top: activeCursesSorted.length > 0 ? '20%' : '16%',
              }}
              transition={{
                duration: 1.12,
                delay: i * 0.055,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 sm:h-8 sm:w-8"
            >
              <Coins
                className="h-full w-full text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,72,0.95)]"
                strokeWidth={1.75}
              />
            </motion.div>
          ))}
        </div>
      )}
      {resolutionPowerOverlay && (
        <motion.div
          key={`power-overlay-${resolutionPowerOverlay.powerCardId}-${resolutionPowerOverlay.uid ?? 'table'}`}
          className="pointer-events-none absolute inset-0 z-[82] flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-2xl border border-violet-500/35 bg-black/45 p-2 shadow-[0_16px_44px_rgba(0,0,0,0.6)]">
            <PowerCardVisual cardId={resolutionPowerOverlay.powerCardId} matchHandCard revealed />
          </div>
        </motion.div>
      )}
      <AnimatePresence>
        {resolutionFx?.kind === 'judgement_flash' && (
          <motion.div
            key="judgement-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.72, 0.28, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.88 }}
            className="pointer-events-none absolute inset-0 z-[70] bg-fuchsia-600/35 mix-blend-screen"
          />
        )}
        {resolutionFx?.kind === 'temperance_balance' && (
          <motion.div
            key="temperance-balance"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.22, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.92 }}
            className="pointer-events-none absolute inset-0 z-[70] bg-[radial-gradient(ellipse_55%_45%_at_50%_50%,rgba(34,211,238,0.28),transparent_72%)]"
          />
        )}
      </AnimatePresence>

      <div className="relative mb-2 flex w-full max-w-[52rem] flex-none flex-col px-2">
        <AnimatePresence>
          {resolutionFx?.kind === 'lovers_hearts' && (
            <>
              <motion.div
                key="lover-h1"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0.85], y: [8, -10, -4], scale: [0.5, 1.1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75 }}
                className="pointer-events-none absolute -left-6 top-1/2 z-10 -translate-y-1/2"
              >
                <Heart className="h-5 w-5 fill-pink-500/35 text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]" />
              </motion.div>
              <motion.div
                key="lover-h2"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0.85], y: [8, -14, -6], scale: [0.5, 1.05, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, delay: 0.06 }}
                className="pointer-events-none absolute -right-6 top-1/2 z-10 -translate-y-1/2"
              >
                <Heart className="h-5 w-5 fill-pink-500/35 text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <div className="flex w-full flex-col items-center gap-3">
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
            className="flex w-full flex-col items-center"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">Table suit</span>
              {jointTrump ? (
                <>
                  {jointTrump.map((suit, ji) => (
                    <React.Fragment key={`${currentTarget ?? 'none'}-jt-${ji}-${suit}`}>
                      {ji === 1 && (
                        <span className="mx-1 text-[9px] font-black uppercase tracking-widest text-slate-500 sm:text-[10px]">
                          or
                        </span>
                      )}
                      <motion.div
                        key={`${currentTarget}-${suit}`}
                        initial={{ scale: 0.75, opacity: 0.4, filter: 'drop-shadow(0 0 0 rgba(251,191,36,0))' }}
                        animate={{
                          scale: 1.06,
                          opacity: 1,
                          filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.45))',
                        }}
                        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                        className={`flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border-2 border-slate-600 bg-slate-900 shadow-2xl sm:h-16 sm:w-16 ${SUIT_COLORS[suit]}`}
                      >
                        <SuitGlyph
                          suit={suit}
                          className="h-[2.35rem] w-[2.35rem] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11"
                        />
                      </motion.div>
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <motion.div
                  key={currentTarget || 'none'}
                  initial={{ scale: 0.75, opacity: 0.4, filter: 'drop-shadow(0 0 0 rgba(251,191,36,0))' }}
                  animate={{ scale: 1.06, opacity: 1, filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.45))' }}
                  transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                  className={`flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border-2 border-slate-600 bg-slate-900 shadow-2xl sm:h-16 sm:w-16 ${SUIT_COLORS[currentTarget || 'Hearts']}`}
                >
                  <SuitGlyph
                    suit={currentTarget || 'Hearts'}
                    className="h-[2.35rem] w-[2.35rem] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11"
                  />
                </motion.div>
              )}
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">this round</span>
          </div>
        </motion.div>

          {activeCursesSorted.length > 0 && (
            <div className="flex max-w-[52rem] flex-wrap justify-center gap-x-4 gap-y-4 px-1 sm:gap-x-5">
              {activeCursesSorted.map((entry) => (
                <div key={entry.id} className="flex max-w-[6.75rem] flex-col items-center gap-1">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider ${cursePowerIconClass(entry.id)}`}
                  >
                    {CURSES[entry.id]?.sin ?? 'Curse'}
                  </span>
                  <PowerCardVisual cardId={entry.id} small revealed curseRackPeek />
                  {entry.id === CURSE_LUST && outcome.lustRoundFx && (
                    <span className="text-center text-[9px] font-black tabular-nums text-rose-200/95">
                      {outcome.lustRoundFx.previousMeter}
                      <span className="text-rose-500/80"> â†’ </span>
                      {outcome.lustRoundFx.sated ? 0 : outcome.lustRoundFx.nextMeter}
                    </span>
                  )}
                  {entry.id === CURSE_GLUTTONY && gluttonyShownInResolution && (
                    <span className="text-center text-[8px] font-bold uppercase leading-snug text-amber-200/85">
                      Hearts digest to bones after scoring.
                    </span>
                  )}
                  {entry.id === CURSE_GREED && outcome.greedPersistence && (
                    <span className="text-center text-[9px] font-black tabular-nums text-amber-100/95">
                      +{outcome.greedPersistence.taxThisRound} tithe Â· crown {outcome.greedPersistence.nextCrown}/17
                    </span>
                  )}
                  {entry.id === CURSE_ENVY &&
                    outcome.envyRoundFx &&
                    typeof envyShownHp === 'number' && (
                      <span className="text-center text-[9px] font-black tabular-nums text-emerald-200/95">
                        Monster {envyShownHp} HP
                      </span>
                    )}
                  {entry.id === CURSE_WRATH && outcome.wrathFx && (
                    <span className="text-center text-[8px] font-bold uppercase leading-snug text-red-300/90">
                      {describeWrathMinionTitle(outcome.wrathFx.minionCard)} Â· âˆ’{outcome.wrathFx.magnitude}
                      {outcome.wrathFx.sparedJoker ? ' Â· spared' : ''}
                    </span>
                  )}
                  {entry.id === CURSE_PRIDE && room.prideCeilingCard && (
                    <span className="break-words text-center text-[8px] font-bold uppercase leading-snug text-violet-200/85">
                      {(() => {
                        const pc = parseCard(room.prideCeilingCard);
                        const v = pc.suit === 'Crowns' ? displaySuitCardValue(pc.suit, pc.value) : pc.value;
                        return `Ceiling beats ${v} (${pc.suit}).`;
                      })()}
                    </span>
                  )}
                  {entry.id === CURSE_SLOTH && outcome.slothDreamFx && (
                    <span className="text-center text-[8px] font-bold uppercase leading-snug text-indigo-200/85">
                      Dream transforms apply after the wheel.
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {outcome.envyRoundFx && envyShownHp !== null && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          title={ENVY_RESOLUTION_MONSTER_TOOLTIP}
          className="mb-4 flex flex-col items-center gap-2"
        >
          <div className="origin-center drop-shadow-[0_12px_36px_rgba(16,185,129,0.4)]">
            <PowerCardVisual cardId={CURSE_ENVY} small revealed curseRackPeek />
          </div>
          <span className="font-mono text-lg font-black tabular-nums text-emerald-200 sm:text-2xl">
            {envyShownHp}{' '}
            <span className="text-xs font-black uppercase tracking-wider text-emerald-500">HP</span>
          </span>
        </motion.div>
      )}

      <div
        className={`flex-none flex w-full max-w-5xl items-center justify-center ${
          wrathTripleColumn ? 'items-end gap-1 sm:gap-4' : 'gap-4 sm:gap-12'
        }`}
      >
        {[hostUid, guestUid].map((uid, idx) => (
          <React.Fragment key={uid}>
          <div className="flex flex-col items-center gap-3 relative scale-100 sm:scale-110 origin-top">
            <motion.div 
              initial={{ x: idx === 0 ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className={`px-2 py-0.5 rounded border border-slate-800 bg-slate-950/80 backdrop-blur-sm ${room.players[uid].role === 'Predator' ? 'text-red-500 border-red-900/30' : (room.players[uid].role === 'Preydator' ? 'text-purple-500 border-purple-900/30' : 'text-blue-400 border-blue-900/30')}`}
            >
               <span className="text-[8px] font-black uppercase tracking-widest leading-none block">{room.players[uid].name}</span>
            </motion.div>

            {showWrathAgentAbovePlayer(uid) && wfRes?.minionCard && (
              <motion.div
                className="pointer-events-none absolute -top-6 left-1/2 z-40 flex w-[10rem] -translate-x-1/2 justify-center sm:w-[11rem]"
                initial={
                  wrathAnim?.stage === 'fly'
                    ? { y: 26, opacity: 0.75 }
                    : { y: -10, opacity: 1 }
                }
                animate={
                  wrathAnim?.stage === 'fly'
                    ? { y: 0, opacity: 1 }
                    : { y: [0, -12, 0], opacity: 1 }
                }
                transition={
                  wrathAnim?.stage === 'fly'
                    ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
                    : {
                        y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
                      }
                }
              >
                <div className="origin-top scale-[0.8] drop-shadow-[0_0_28px_rgba(220,38,38,0.5)] sm:scale-[0.86]">
                  <CardVisual card={wfRes.minionCard} revealed noAnimate presentation="none" small />
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {resolutionEmpowerCaption?.uid === uid && (
                <motion.div
                  key={`empower-${resolutionEmpowerCaption.text}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none z-[25] mb-1.5 max-w-[min(17rem,92vw)] px-2 text-center text-[10px] font-black uppercase italic leading-snug tracking-wide text-rose-200/95 drop-shadow-[0_0_12px_rgba(251,113,133,0.35)] sm:text-[11px]"
                >
                  {resolutionEmpowerCaption.text}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <div className="flex items-end gap-2">
                {idx === 0 && summoned[uid] && (
                  <div className="origin-center scale-[0.96] sm:scale-[0.99]">
                    <CardVisual
                      card={summoned[uid]}
                      revealed
                      presentation="deckPull"
                      deckPullSide="left"
                      delay={0.12}
                      lustHeartRulesActive={lustHeartResolution}
                    />
                  </div>
                )}
                <motion.div 
                  className="relative z-10 rounded-xl shadow-[0_0_32px_rgba(250,204,21,0.18)] overflow-visible"
                  animate={resolutionColumnMotion(resolutionFx, uid)}
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CardVisual
                    card={currentCards[uid]}
                    revealed
                    presentation="none"
                    lustHeartRulesActive={lustHeartResolution}
                    clashGhost={Boolean(postClashGhost[uid])}
                    resolutionMorph={resolutionCardMorph[uid] ?? null}
                    resolutionMorphTick={resolutionCardMorphTick[uid] ?? 0}
                    resolutionWiggleTick={resolutionEmpowerWiggleTick[uid] ?? 0}
                  />
                  <AnimatePresence>
                    {resolutionFx?.kind === 'clash_shatter' && resolutionFx.uid === uid && (
                      <ResolutionTearOverlay>
                        <CardVisual
                          card={resolutionFx.cardId}
                          revealed
                          noAnimate
                          presentation="none"
                        />
                      </ResolutionTearOverlay>
                    )}
                    {(resolutionFx?.kind === 'death_slash' || resolutionFx?.kind === 'wrath_cut') &&
                      resolutionFx.victimUid === uid && (
                      <motion.div
                        key={resolutionFx?.kind === 'wrath_cut' ? 'wrath-cut' : 'death-slash'}
                        className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-xl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="absolute left-[-28%] top-1/2 h-[7px] w-[155%] origin-center -translate-y-1/2 rotate-[-36deg] bg-linear-to-r from-transparent via-white to-red-600 shadow-[0_0_32px_rgba(239,68,68,1)]"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        />
                        <motion.div
                          className="pointer-events-none absolute inset-0 z-[29] flex rounded-xl overflow-hidden"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          <motion.div
                            className="w-1/2 h-full bg-black/50 backdrop-blur-[0.5px]"
                            initial={{ x: 0 }}
                            animate={{ x: '-32%' }}
                            transition={{ delay: 0.15, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                          />
                          <motion.div
                            className="w-1/2 h-full bg-black/50 backdrop-blur-[0.5px]"
                            initial={{ x: 0 }}
                            animate={{ x: '32%' }}
                            transition={{ delay: 0.15, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </motion.div>
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'moon_glow' && resolutionFx.uid === uid && (
                      <motion.div
                        key="moon-glow"
                        className="pointer-events-none absolute inset-0 z-[24] flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.72 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        <Moon className="h-[3rem] w-[3rem] text-indigo-100 drop-shadow-[0_0_18px_rgba(199,210,254,0.88)] sm:h-[3.35rem] sm:w-[3.35rem]" strokeWidth={1.6} />
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'frog_curse' && resolutionFx.uid === uid && (
                      <motion.div
                        key="frog-curse"
                        className="pointer-events-none absolute inset-0 z-[22] rounded-xl ring-[3px] ring-lime-400/80 shadow-[0_0_36px_rgba(163,230,53,0.55)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0.75] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.55 }}
                      />
                    )}
                    {resolutionFx?.kind === 'gluttony_bite' && resolutionFx.uid === uid && (
                      <motion.div
                        key="gluttony-bite"
                        className="pointer-events-none absolute inset-0 z-[31] flex items-center justify-center overflow-visible rounded-xl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="absolute inset-[-4px] rounded-[13px]"
                          initial={{
                            clipPath: 'ellipse(138% 120% at 112% -12%)',
                            boxShadow: 'inset 0 0 0 0 rgba(15,23,42,0)',
                          }}
                          animate={{
                            clipPath: [
                              'ellipse(138% 120% at 112% -12%)',
                              'ellipse(55% 48% at 108% -4%)',
                              'ellipse(28% 24% at 96% 6%)',
                            ],
                            boxShadow: [
                              'inset 0 0 0 0 rgba(15,23,42,0)',
                              'inset 0 -12px 28px rgba(15,23,42,0.88)',
                              'inset 0 -26px 40px rgba(15,23,42,1)',
                            ],
                          }}
                          transition={{ duration: 0.74, ease: [0.5, 0, 0.5, 1] }}
                          style={{
                            background:
                              'radial-gradient(110% 80% at 95% -5%,rgba(254,243,199,0.12),transparent 58%),rgba(15,23,42,0.72)',
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                </div>
                {idx === 1 && summoned[uid] && (
                  <div className="origin-center scale-[0.96] sm:scale-[0.99]">
                    <CardVisual
                      card={summoned[uid]}
                      revealed
                      presentation="deckPull"
                      deckPullSide="right"
                      delay={0.16}
                      lustHeartRulesActive={lustHeartResolution}
                    />
                  </div>
                )}
              </div>
            </div>
            {idx === 0 && wrathTripleColumn && (
              <div
                className="flex w-[5.5rem] shrink-0 flex-col items-center justify-end self-end pb-4 min-h-[9.5rem] sm:min-h-[10.5rem] sm:w-[6.5rem] sm:pb-6"
                aria-hidden={!wrathAnim}
              >
                {wrathAnim?.stage === 'center' && wfRes?.minionCard && (
                    <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="origin-top scale-[0.8] drop-shadow-[0_0_24px_rgba(220,38,38,0.45)] sm:scale-[0.86]"
                  >
                    <CardVisual card={wfRes.minionCard} revealed noAnimate presentation="none" small />
                    </motion.div>
                  )}
            </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-10 flex w-full max-w-xl flex-none flex-col items-center sm:mt-14">
        <div className="relative flex min-h-[52px] w-full flex-col items-center justify-center overflow-visible">
          <AnimatePresence mode="popLayout">
            {visibleEvents
              .slice(-2)
              .filter((e) => e.message.trim().length > 0)
              .map((evt, i) => (
              <motion.div 
                key={evt.id} 
                initial={{ opacity: 0, y: 26, scale: 0.9, filter: 'blur(8px)' }}
                animate={{
                  opacity: i === 1 ? 1 : 0.38,
                  y: i === 1 ? 0 : -16,
                  scale: i === 1 ? 1.04 : 0.92,
                  filter: 'blur(0px)'
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                exit={{ opacity: 0, y: -30 }}
                className={`whitespace-pre-line text-center font-black uppercase tracking-widest italic text-[10px] sm:text-sm ${evt.logClass ?? 'text-slate-400'} ${i === 1 ? 'opacity-100' : 'opacity-[0.42]'}`}
              >
                {evt.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex flex-col items-center justify-center min-h-[60px]">
          <AnimatePresence>
            {isDone && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0, filter: "blur(8px)" }} 
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }} 
                className="flex flex-col items-center"
              >
                <span className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter italic drop-shadow-2xl ${
                  outcome.winnerUid === 'draw' ? 'text-purple-500' : 
                  (room.players[outcome.winnerUid].role === 'Preydator' ? 'text-purple-500' :
                   (room.players[outcome.winnerUid].role === 'Predator' ? 'text-red-500' : 'text-blue-400'))
                }`}>
                  {outcome.winnerUid === 'draw' ? 'STALEMATE' : `${room.players[outcome.winnerUid].name} WINS`}
                </span>
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{outcome.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
