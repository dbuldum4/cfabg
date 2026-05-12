import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  getLegalMoves,
  passPlayer,
  placeMove,
  validateMove
} from "../src/game/blokus.js";

test("first move must cover assigned corner", () => {
  const game = createGame({
    playerCount: 2,
    players: [{ type: "human" }, { type: "cpu" }]
  });

  const awayFromCorner = validateMove(game, "blue", "mono", { x: 3, y: 3 });
  assert.equal(awayFromCorner.legal, false);
  assert.match(awayFromCorner.reason, /First move/);

  const onCorner = validateMove(game, "blue", "mono", { x: 0, y: 0 });
  assert.equal(onCorner.legal, true);
});

test("same-color pieces can touch corners but not edges", () => {
  const game = createGame({
    playerCount: 2,
    players: [{ type: "human" }, { type: "cpu" }]
  });

  const first = placeMove(game, "blue", {
    pieceId: "mono",
    origin: { x: 0, y: 0 },
    transform: { rotation: 0 }
  }).game;

  const edgeTouch = validateMove(first, "blue", "domino", { x: 0, y: 1 }, { rotation: 90 });
  assert.equal(edgeTouch.legal, false);
  assert.match(edgeTouch.reason, /edges/);

  const cornerTouch = validateMove(first, "blue", "domino", { x: 1, y: 1 });
  assert.equal(cornerTouch.legal, true);
});

test("opponent pieces may touch edges", () => {
  const game = createGame({
    playerCount: 2,
    players: [{ type: "human" }, { type: "human" }]
  });

  let next = placeMove(game, "blue", {
    pieceId: "mono",
    origin: { x: 0, y: 0 },
    transform: { rotation: 0 }
  }).game;

  next = placeMove(next, "red", {
    pieceId: "pent-i",
    origin: { x: 19, y: 15 },
    transform: { rotation: 0 }
  }).game;

  const legal = validateMove(next, "blue", "domino", { x: 1, y: 1 }, { rotation: 90 });
  assert.equal(legal.legal, true);
});

test("legal move generator returns opening moves for every starting player", () => {
  const game = createGame({
    playerCount: 4,
    players: [{ type: "human" }, { type: "human" }, { type: "human" }, { type: "human" }]
  });

  for (const player of game.players) {
    assert.ok(getLegalMoves(game, player.id).length > 0, `${player.id} should have legal opening moves`);
  }
});

test("cannot pass while legal moves are available", () => {
  const game = createGame({
    playerCount: 2,
    players: [{ type: "human" }, { type: "cpu" }]
  });

  const result = passPlayer(game, "blue");
  assert.equal(result.error, "You still have legal moves.");
});
