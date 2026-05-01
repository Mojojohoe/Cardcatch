import assert from 'node:assert/strict';
import test from 'node:test';
import { GameService, evaluateTrickClash, explainPlainClash, getCardValue, parseCard } from './gameService';
import { createFixturePlayers, createFixtureRoom } from './gameService.fixtures';

test('parseCard and getCardValue preserve card parsing semantics', () => {
  const joker = parseCard('Joker-1');
  const ace = parseCard('Hearts-A');
  assert.equal(joker.isJoker, true);
  assert.equal(ace.suit, 'Hearts');
  assert.equal(getCardValue('Joker-1'), 20);
  assert.equal(getCardValue('Hearts-A'), 14);
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
