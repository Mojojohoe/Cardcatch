import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GameService,
  evaluateTrickClash,
  explainPlainClash,
  getCardValue,
  getWrathMagnitude,
  handHasLegalPridePlay,
  handHasLegalEnvyPlay,
  isCardBlockedByPride,
  parseCard,
  pickEnvyCovetedForRound,
  pickSlothDreamResult,
} from './gameService';
import { createFixturePlayers, createFixtureRoom } from './gameService.fixtures';

test('parseCard and getCardValue preserve card parsing semantics', () => {
  const joker = parseCard('Joker-1');
  const ace = parseCard('Hearts-A');
  assert.equal(joker.isJoker, true);
  assert.equal(ace.suit, 'Hearts');
  assert.equal(getCardValue('Joker-1'), 20);
  assert.equal(getCardValue('Hearts-A'), 14);
  assert.equal(getCardValue('Crowns-E'), 17);
  assert.equal(getCardValue('Diamonds-A', false, true), 13);
  assert.equal(getCardValue('Coins-10', false, true), 8);
  assert.equal(getCardValue('Grovels-1'), 0);
});

test('Greed: Coins match Diamonds trump; tax lowers clash values', () => {
  assert.equal(evaluateTrickClash('Coins-10', 'Diamonds-K', 'Diamonds', false, true, true), 'p2');
  assert.equal(evaluateTrickClash('Coins-5', 'Hearts-A', 'Diamonds', false, true, true), 'p1');
});

test('Envy: picks highest table-suit candidate; sealed copies skipped', () => {
  const players = createFixturePlayers();
  players.host.hand = ['Hearts-10', 'Diamonds-8'];
  players.guest.hand = ['Hearts-J', 'Spades-4'];
  let pick = pickEnvyCovetedForRound(players, 'host', 'guest', 'Hearts', {}, false, false, false);
  assert.equal(pick?.uid, 'guest');
  assert.equal(pick?.cardId, 'Hearts-J');
  pick = pickEnvyCovetedForRound(players, 'host', 'guest', 'Hearts', { guest: ['Hearts-J'] }, false, false, false);
  assert.equal(pick?.uid, 'host');
  assert.equal(pick?.cardId, 'Hearts-10');
});

test('Envy: hand has no legal play when every slot is sealed (Grovel exempt path is separate)', () => {
  const hand = ['Hearts-10', 'Diamonds-8'];
  assert.equal(handHasLegalEnvyPlay(hand, 'host', {}), true);
  assert.equal(handHasLegalEnvyPlay(hand, 'host', { host: ['Hearts-10', 'Diamonds-8'] }), false);
});

test('Pride barrier blocks target suit at or above ceiling; Grovel exempt', () => {
  const ceiling = 'Hearts-9';
  assert.equal(isCardBlockedByPride('Hearts-J', ceiling, false, false), true);
  assert.equal(isCardBlockedByPride('Hearts-9', ceiling, false, false), true);
  assert.equal(isCardBlockedByPride('Hearts-8', ceiling, false, false), false);
  assert.equal(isCardBlockedByPride('Grovels-1', ceiling, false, false), false);
  assert.equal(isCardBlockedByPride('Diamonds-A', ceiling, false, false), false);
  assert.equal(handHasLegalPridePlay(['Hearts-J', 'Diamonds-2'], ceiling, false, false), true);
  assert.equal(handHasLegalPridePlay(['Hearts-J', 'Hearts-Q'], ceiling, false, false), false);
});

test('Wrath clash penalties reduce marked side rank; Jokers ignore penalties', () => {
  assert.equal(getWrathMagnitude('Swords-T'), 1);
  assert.equal(getWrathMagnitude('Swords-W'), 5);
  assert.equal(
    evaluateTrickClash('Hearts-10', 'Hearts-J', 'Hearts', false, false, false, 3, 0),
    'p2',
  );
  assert.equal(
    evaluateTrickClash('Hearts-10', 'Hearts-J', 'Hearts', false, false, false, 0, 3),
    'p1',
  );
  assert.equal(evaluateTrickClash('Joker-1', 'Stars-A', 'Stars', false, false, false, 5, 0), 'p1');
});

test('Sloth dream wheel maps weight-space offsets to five equal buckets', () => {
  assert.equal(pickSlothDreamResult(0), 'NOTHING');
  assert.equal(pickSlothDreamResult(0.19), 'NOTHING');
  assert.equal(pickSlothDreamResult(0.2), 'STARS');
  assert.equal(pickSlothDreamResult(0.399), 'STARS');
  assert.equal(pickSlothDreamResult(0.4), 'MOONS');
  assert.equal(pickSlothDreamResult(0.599), 'MOONS');
  assert.equal(pickSlothDreamResult(0.6), 'STARS_AND_MOONS');
  assert.equal(pickSlothDreamResult(0.799), 'STARS_AND_MOONS');
  assert.equal(pickSlothDreamResult(0.8), 'SUN');
  assert.equal(pickSlothDreamResult(0.999), 'SUN');
});

test('explainPlainClash states joker beats on-suit play', () => {
  const msg = explainPlainClash('Joker-1', 'Hearts-7', 'Hearts');
  assert.match(msg, /joker/i);
  assert.match(msg, /Hearts/);
});

test('Joker vs non-Joker on Stars always favors Joker', () => {
  assert.equal(evaluateTrickClash('Joker-1', 'Stars-9', 'Stars'), 'p1');
  assert.equal(evaluateTrickClash('Hearts-A', 'Joker-1', 'Stars'), 'p2');
});

test('Moons table joker beats Moons play only', () => {
  assert.equal(evaluateTrickClash('Joker-1', 'Moons-4', 'Moons'), 'p1');
  assert.equal(evaluateTrickClash('Joker-1', 'Hearts-A', 'Moons'), 'p2');
});

test('Frogs never match Hearts target — Joker loses to Frog', () => {
  assert.equal(evaluateTrickClash('Joker-1', 'Frogs-1', 'Hearts'), 'p2');
});

test('calculateOutcome deterministic baseline without powers', () => {
  const service = new GameService() as any;
  service.myUid = 'host';

  const room = createFixtureRoom();
  const players = createFixturePlayers();
  players.host.currentMove = 'Hearts-7';
  players.guest.currentMove = 'Clubs-A';
  players.host.currentPowerCard = null;
  players.guest.currentPowerCard = null;

  const outcome = service.calculateOutcome(room, players);
  assert.equal(outcome.winnerUid, 'host');
  assert.equal(outcome.cardsPlayed.host, 'Hearts-7');
  assert.equal(outcome.cardsPlayed.guest, 'Clubs-A');
});

test('host rejects invalid played card not in hand', () => {
  const service = new GameService() as any;
  service.myUid = 'host';
  service.isHost = true;

  const room = createFixtureRoom();
  service.state = room;
  service.onStateChange = () => {};
  service.broadcastState = () => {};

  service.processMove('guest', 'Diamonds-K');
  assert.equal(service.state.players.guest.currentMove, null);
  assert.equal(service.state.players.guest.confirmed, false);
});

test('host rejects selecting power not owned by player', () => {
  const service = new GameService() as any;
  service.myUid = 'host';
  service.isHost = true;

  const room = createFixtureRoom();
  service.state = room;
  service.onStateChange = () => {};
  service.broadcastState = () => {};

  service.handlePlayPowerCard('guest', 99);
  assert.equal(service.state.players.guest.currentPowerCard, null);
});

test('host accepts valid draft selection from current set only', () => {
  const service = new GameService() as any;
  service.myUid = 'host';
  service.isHost = true;

  const room = createFixtureRoom();
  room.status = 'drafting';
  room.draftSets = [[1, 2, 3]];
  room.draftTurn = 0;
  room.players.host.powerCards = [];
  room.players.guest.powerCards = [];
  service.state = room;
  service.onStateChange = () => {};
  service.broadcastState = () => {};

  service.handleSelectDraft('guest', 9, 0);
  assert.deepEqual(service.state.players.guest.powerCards, []);

  service.handleSelectDraft('guest', 2, 0);
  assert.equal(service.state.players.guest.powerCards.includes(2), true);
});

test('applyRoundResults does not duplicate Chariot saved card', () => {
  const service = new GameService() as any;
  service.myUid = 'host';

  const room = createFixtureRoom();
  room.status = 'results';
  room.deck = [];
  room.players.host.hand = ['Frogs-1', 'Spades-K'];
  room.players.guest.hand = ['Hearts-5', 'Clubs-A'];
  room.players.host.powerCards = [7];
  room.players.guest.powerCards = [1];
  room.lastOutcome = {
    targetSuit: 'Hearts',
    winnerUid: 'guest',
    message: 'Guest wins.',
    cardsPlayed: { host: 'Frogs-1', guest: 'Hearts-5' },
    initialCardsPlayed: { host: 'Frogs-1', guest: 'Hearts-5' },
    powerCardsPlayed: { host: 'The Chariot', guest: 'The Magician' },
    powerCardIdsPlayed: { host: 7, guest: 1 },
    powerCardTowerBlocked: { host: false, guest: false },
    coinFlip: 'Host',
    events: [],
    gains: {
      host: [{ type: 'card', id: 'Frogs-2' }],
      guest: [{ type: 'draw', id: 'standard' }],
    },
  } as any;

  const next = service.applyRoundResults(room, room.players);
  const frogs2 = next.players.host.hand.filter((c: string) => c === 'Frogs-2');
  assert.equal(frogs2.length, 1);
});

test('Magician frogify on Frog card increments Frog value by 1', () => {
  const service = new GameService() as any;
  service.myUid = 'host';

  const room = createFixtureRoom();
  room.targetSuit = 'Hearts';
  room.pendingPowerDecisions = {
    host: { powerCardId: 1, selectedOption: 'FROGIFY' } as any,
    guest: null,
  };

  const players = createFixturePlayers();
  players.host.currentMove = 'Hearts-7';
  players.guest.currentMove = 'Frogs-4';
  players.host.currentPowerCard = 1;
  players.guest.currentPowerCard = null;

  const outcome = service.calculateOutcome(room, players);
  assert.equal(outcome.cardsPlayed.guest, 'Frogs-5');
});
