import {
  BOARD_SIZE,
  forEachLegalMove,
  getFrontierPoints,
  getLegalMoveCount,
  getPieceBounds,
  getRemainingSquares,
  PIECE_MAP
} from "./blokus.js";

const DIAGONAL = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 }
];

const ORTHOGONAL = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

function distanceToCenter(point) {
  const center = (BOARD_SIZE - 1) / 2;
  return Math.abs(point.x - center) + Math.abs(point.y - center);
}

function countNewCorners(game, playerId, absoluteCells) {
  const occupied = new Set(absoluteCells.map((point) => point.y * game.boardSize + point.x));
  const corners = new Set();

  for (const point of absoluteCells) {
    for (const delta of DIAGONAL) {
      const x = point.x + delta.x;
      const y = point.y + delta.y;
      if (x < 0 || y < 0 || x >= game.boardSize || y >= game.boardSize) continue;
      const key = y * game.boardSize + x;
      if (game.board[y][x] || occupied.has(key)) continue;
      const ownEdgeBlocked = ORTHOGONAL.some((edge) => {
        const nx = x + edge.x;
        const ny = y + edge.y;
        if (nx < 0 || ny < 0 || nx >= game.boardSize || ny >= game.boardSize) return false;
        const neighbor = game.board[ny][nx];
        return neighbor?.playerId === playerId || occupied.has(ny * game.boardSize + nx);
      });
      if (!ownEdgeBlocked) {
        corners.add(key);
      }
    }
  }

  return corners.size;
}

function countOpponentEdgePressure(game, playerId, absoluteCells) {
  let pressure = 0;

  for (const point of absoluteCells) {
    for (const delta of ORTHOGONAL) {
      const x = point.x + delta.x;
      const y = point.y + delta.y;
      if (x < 0 || y < 0 || x >= game.boardSize || y >= game.boardSize) continue;
      const neighbor = game.board[y][x];
      if (neighbor && neighbor.playerId !== playerId) {
        pressure += 1;
      }
    }
  }

  return pressure;
}

function moveSpread(move) {
  const bounds = move.bounds ?? getPieceBounds(move.cells);
  return bounds.width + bounds.height;
}

function scoreMove(game, player, move, difficulty = "medium") {
  const piece = PIECE_MAP.get(move.pieceId);
  const sizeWeight = difficulty === "easy" ? 72 : difficulty === "hard" ? 140 : 105;
  const cornerWeight = difficulty === "hard" ? 16 : 9;
  const centerWeight = difficulty === "hard" ? 4 : 2;
  const pressureWeight = difficulty === "hard" ? 8 : difficulty === "medium" ? 4 : 0;
  const randomWeight = difficulty === "easy" ? 54 : difficulty === "medium" ? 20 : 7;
  let totalX = 0;
  let totalY = 0;
  for (const point of move.absoluteCells) {
    totalX += point.x;
    totalY += point.y;
  }
  const averagePoint = {
    x: totalX / move.absoluteCells.length,
    y: totalY / move.absoluteCells.length
  };

  return (
    piece.size * sizeWeight +
    countNewCorners(game, player.id, move.absoluteCells) * cornerWeight +
    (BOARD_SIZE - distanceToCenter(averagePoint)) * centerWeight +
    countOpponentEdgePressure(game, player.id, move.absoluteCells) * pressureWeight +
    moveSpread(move) * 3 +
    Math.random() * randomWeight
  );
}

export function chooseCpuMove(game, playerId) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;

  let bestMove = null;
  let bestScore = -Infinity;

  forEachLegalMove(game, playerId, (move) => {
    const score = scoreMove(game, player, move, player.difficulty);
    if (score > bestScore) {
      bestMove = move;
      bestScore = score;
    }
    return false;
  });

  return bestMove;
}

export function summarizeCpuPosition(game, playerId, legalMoveCount = null) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;

  return {
    frontiers: getFrontierPoints(game, playerId).length,
    legalMoves: legalMoveCount ?? getLegalMoveCount(game, playerId),
    remainingSquares: getRemainingSquares(player)
  };
}
