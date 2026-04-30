import { MAJOR_ARCANA, PlayerData, ResolutionEvent, RoomData, SUITS, Suit, VALUES } from '../types';

export const getCardValue = (cardStr: string): number => {
  if (cardStr.startsWith('Joker')) return 20;
  const value = cardStr.split('-')[1];
  if (value === 'A') return 14;
  if (value === 'K') return 13;
  if (value === 'Q') return 12;
  if (value === 'J') return 11;
  return parseInt(value, 10);
};

export const parseCard = (cardStr: string): { suit: string; value: string; isJoker: boolean } => {
  if (cardStr.startsWith('Joker')) {
    return { suit: 'Joker', value: 'Joker', isJoker: true };
  }
  const [suit, value] = cardStr.split('-');
  return { suit, value, isJoker: false };
};

type Outcome = NonNullable<RoomData['lastOutcome']>;

export const calculateOutcome = (
  roomData: RoomData,
  players: Record<string, PlayerData>,
  hostUid: string
): Outcome => {
  const uids = Object.keys(players);
  const p1Uid = hostUid;
  const p2Uid = uids.find((id) => id !== p1Uid)!;

  let targetSuit = roomData.targetSuit!;
  const initialCardsPlayed = { [p1Uid]: players[p1Uid].currentMove!, [p2Uid]: players[p2Uid].currentMove! };
  let c1 = players[p1Uid].currentMove!;
  let c2 = players[p2Uid].currentMove!;
  let power1 = players[p1Uid].currentPowerCard;
  let power2 = players[p2Uid].currentPowerCard;

  let winnerUid: string | 'draw' = 'draw';
  let coinFlip: string | undefined;
  const events: ResolutionEvent[] = [];
  const summonedCards: Record<string, string> = {};
  const gains: Record<string, { type: 'card' | 'power' | 'draw'; id: string | number }[]> = {
    [p1Uid]: [],
    [p2Uid]: []
  };

  if ((power1 === 15 || power1 === 16) && (power2 === 15 || power2 === 16)) {
    const p1WinsFlip = Math.random() > 0.5;
    coinFlip = p1WinsFlip ? 'Host' : 'Opponent';
    events.push({
      type: 'COIN_FLIP',
      message: `${coinFlip === 'Host' ? players[p1Uid].name : players[p2Uid].name} wins priority flip!`
    });
  }

  const resolvePowerPre = (pUid: string, oUid: string, p: number | null, oPower: number | null) => {
    if (p === 1) {
      const oHand = players[oUid].hand;
      const jokerStr = oHand.find((c) => c.startsWith('Joker'));
      if (jokerStr) {
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 1, message: `${players[pUid].name}'s Magician steals a Joker from ${players[oUid].name}!` });
        gains[pUid].push({ type: 'card', id: jokerStr });
      }
    }
    if (p === 15) {
      if (oPower !== null && oPower !== 16 && oPower !== 15) {
        const powerName = MAJOR_ARCANA[oPower].name;
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 15, message: `${players[pUid].name}'s Devil intercepts and consumes ${players[oUid].name}'s ${powerName}!` });
        gains[pUid].push({ type: 'power', id: oPower });
        if (pUid === p1Uid) power2 = null;
        else power1 = null;
      } else if (oPower === 16 || oPower === 15) {
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 15, message: `${players[pUid].name}'s Devil tried to catch ${players[oUid].name}'s power but was blocked!` });
      }
    }
    if (p === 16) {
      if (oPower !== null && oPower !== 15 && oPower !== 16) {
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 16, message: `${players[pUid].name}'s Tower blocks ${players[oUid].name}'s power!` });
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

  const applyBefore = (pUid: string, p: number | null) => {
    const pc1 = parseCard(c1);
    const pc2 = parseCard(c2);
    if (p === 17) {
      events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 17, message: `${players[pUid].name}'s Star transforms the field!` });
      targetSuit = 'Stars';
      events.push({ type: 'TARGET_CHANGE', suit: 'Stars', message: 'Target suit is now Stars!' });
    }
    if (p === 0) {
      events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 0, message: `${players[pUid].name}'s Fool swaps the cards!` });
      const temp = c1; c1 = c2; c2 = temp;
      events.push({ type: 'CARD_SWAP', message: 'Cards have been swapped!' });
    }
    if (p === 6) {
      events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 6, message: `${players[pUid].name}'s Lovers change target suit to Hearts!` });
      targetSuit = 'Hearts';
      events.push({ type: 'TARGET_CHANGE', suit: 'Hearts', message: 'Target suit is now Hearts!' });
    }
    if (p === 4) {
      events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 4, message: `${players[pUid].name}'s Emperor empowers the card!` });
      if (pUid === p1Uid) c1 = `${targetSuit}-${VALUES[Math.min(VALUES.indexOf(pc1.value as never) + 2, VALUES.length - 1)]}`;
      else c2 = `${targetSuit}-${VALUES[Math.min(VALUES.indexOf(pc2.value as never) + 2, VALUES.length - 1)]}`;
    }
    if (p === 8) {
      events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 8, message: `${players[pUid].name}'s Strength boosts the card!` });
      if (pUid === p1Uid) {
        const pc = parseCard(c1);
        c1 = pc.isJoker ? c1 : `${pc.suit}-${VALUES[Math.min(VALUES.indexOf(pc.value as never) + 4, VALUES.length - 1)]}`;
      } else {
        const pc = parseCard(c2);
        c2 = pc.isJoker ? c2 : `${pc.suit}-${VALUES[Math.min(VALUES.indexOf(pc.value as never) + 4, VALUES.length - 1)]}`;
      }
    }
    if (p === 11) {
      events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 11, message: `${players[pUid].name}'s Justice summons an ally!` });
      const summoned = `${targetSuit}-${VALUES[Math.floor(Math.random() * VALUES.length)]}`;
      summonedCards[pUid] = summoned;
      events.push({ type: 'SUMMON_CARD', uid: pUid, cardId: summoned, message: `Justice summoned ${summoned.replace('-', ' of ')}!` });
    }
  };

  applyBefore(p1Uid, power1);
  applyBefore(p2Uid, power2);

  if (targetSuit === 'Stars') {
    const pc1 = parseCard(c1);
    const pc2 = parseCard(c2);
    if (!pc1.isJoker && pc1.suit !== 'Stars') c1 = `Stars-${pc1.value}`;
    if (!pc2.isJoker && pc2.suit !== 'Stars') c2 = `Stars-${pc2.value}`;
  }

  const evalClash = (cr1: string, cr2: string) => {
    const pr1 = parseCard(cr1);
    const pr2 = parseCard(cr2);
    if (pr1.isJoker && pr2.isJoker) return 'draw';
    const p1Target = pr1.suit === targetSuit || pr1.isJoker || (targetSuit === 'Stars' && !pr1.isJoker);
    const p2Target = pr2.suit === targetSuit || pr2.isJoker || (targetSuit === 'Stars' && !pr2.isJoker);
    if (p1Target && !p2Target) return 'p1';
    if (!p1Target && p2Target) return 'p2';
    const v1 = getCardValue(cr1);
    const v2 = getCardValue(cr2);
    if (v1 > v2) return 'p1';
    if (v2 > v1) return 'p2';
    return 'draw';
  };

  if (power1 === 14 || power2 === 14) {
    winnerUid = 'draw';
    events.push({ type: 'POWER_TRIGGER', message: 'Temperance forced transparency and balance.' });
  } else {
    const res = evalClash(c1, c2);
    winnerUid = res === 'p1' ? p1Uid : (res === 'p2' ? p2Uid : 'draw');
    if (power1 === 20 || power2 === 20) {
      if (!(power1 === 20 && power2 === 20)) {
        if (winnerUid === p1Uid) winnerUid = p2Uid;
        else if (winnerUid === p2Uid) winnerUid = p1Uid;
      }
    }
    if (power1 === 12) winnerUid = p2Uid;
    if (power2 === 12) winnerUid = p1Uid;
  }

  let finalMessage = '';
  if (winnerUid === 'draw') {
    finalMessage = power1 === 14 || power2 === 14 ? 'Temperance has balanced the scale of fate.' : 'A perfect deadlock. Zero sum.';
  } else {
    finalMessage = `${players[winnerUid].name} wins the round!`;
  }

  if (winnerUid !== 'draw') gains[winnerUid].push({ type: 'draw', id: 'standard' });
  if (power1 === 12) gains[p1Uid].push({ type: 'draw', id: 3 });
  if (power2 === 12) gains[p2Uid].push({ type: 'draw', id: 3 });

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
};

export const applyRoundResults = (
  roomData: RoomData,
  players: Record<string, PlayerData>,
  hostUid: string,
  shuffle: <T>(array: T[]) => T[]
): RoomData => {
  const outcome = roomData.lastOutcome!;
  const uids = Object.keys(players);
  const updatedPlayers = { ...players };
  const p1Uid = hostUid;
  const p2Uid = uids.find((id) => id !== p1Uid)!;
  const newDeck = [...roomData.deck];
  const powerDeck = [...roomData.powerDeck];

  uids.forEach((uid) => {
    const p = updatedPlayers[uid];
    const initialCard = outcome.initialCardsPlayed?.[uid] || outcome.cardsPlayed[uid];
    const cardIdx = p.hand.indexOf(initialCard);
    if (cardIdx !== -1) p.hand.splice(cardIdx, 1);
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

  const winnerUid = outcome.winnerUid;
  if (winnerUid !== 'draw' && newDeck.length > 0) updatedPlayers[winnerUid].hand.push(newDeck.splice(0, 1)[0]);

  const availableSuits = [...(roomData.availableSuits || SUITS)];
  const targetSuit = availableSuits[Math.floor(Math.random() * availableSuits.length)] as Suit;

  const handExhausted = updatedPlayers[p1Uid].hand.length === 0 || updatedPlayers[p2Uid].hand.length === 0;
  const deckExhausted = newDeck.length === 0;
  const status = handExhausted || deckExhausted ? 'finished' : 'playing';
  let winner = roomData.winner;

  if (status === 'finished' && !winner) {
    if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length === 0) winner = null;
    else if (updatedPlayers[p1Uid].hand.length === 0) winner = p2Uid;
    else if (updatedPlayers[p2Uid].hand.length === 0) winner = p1Uid;
    else if (deckExhausted) {
      const p1Role = updatedPlayers[p1Uid].role;
      const p2Role = updatedPlayers[p2Uid].role;
      const p1IsPreySide = p1Role === 'Prey' || p1Role === 'Preydator';
      const p2IsPreySide = p2Role === 'Prey' || p2Role === 'Preydator';
      if (p1IsPreySide && !p2IsPreySide) winner = p1Uid;
      else if (p2IsPreySide && !p1IsPreySide) winner = p2Uid;
      else winner = updatedPlayers[p1Uid].hand.length >= updatedPlayers[p2Uid].hand.length ? p1Uid : p2Uid;
    }
  }

  return {
    ...roomData,
    players: updatedPlayers,
    status,
    winner,
    currentTurn: roomData.currentTurn + 1,
    targetSuit,
    availableSuits,
    wheelOffset: Math.random(),
    deck: shuffle(newDeck),
    powerDeck,
    updatedAt: Date.now()
  };
};
