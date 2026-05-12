import {
  BOARD_SIZE,
  getFrontierPoints,
  getLegalMoves,
  getPieceBounds,
  getRemainingSquares,
  PIECE_MAP
} from "./blokus.js";

function distanceToCenter(point) {
  const center = (BOARD_SIZE - 1) / 2;
  return Math.abs(point.x - center) + Math.abs(point.y - center);
}

function countNewCorners(game, playerId, absoluteCells) {
  const occupied = new Set(absoluteCells.map((point) => `${point.x},${point.y}`));
  const diagonal = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ];
  const orthogonal = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];
  const corners = new Set();

  for (const point of absoluteCells) {
    for (const delta of diagonal) {
      const x = point.x + delta.x;
      const y = point.y + delta.y;
      if (x < 0 || y < 0 || x >= game.boardSize || y >= game.boardSize) continue;
      if (game.board[y][x] || occupied.has(`${x},${y}`)) continue;
      const ownEdgeBlocked = orthogonal.some((edge) => {
        const nx = x + edge.x;
        const ny = y + edge.y;
        if (nx < 0 || ny < 0 || nx >= game.boardSize || ny >= game.boardSize) return false;
        const neighbor = game.board[ny][nx];
        return neighbor?.playerId === playerId || occupied.has(`${nx},${ny}`);
      });
      if (!ownEdgeBlocked) {
        corners.add(`${x},${y}`);
      }
    }
  }

  return corners.size;
}

function countOpponentEdgePressure(game, playerId, absoluteCells) {
  const orthogonal = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];
  let pressure = 0;

  for (const point of absoluteCells) {
    for (const delta of orthogonal) {
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
  const bounds = getPieceBounds(move.cells);
  return bounds.width + bounds.height;
}

function scoreMove(game, player, move, difficulty = "medium") {
  const piece = PIECE_MAP.get(move.pieceId);
  const sizeWeight = difficulty === "easy" ? 72 : difficulty === "hard" ? 140 : 105;
  const cornerWeight = difficulty === "hard" ? 16 : 9;
  const centerWeight = difficulty === "hard" ? 4 : 2;
  const pressureWeight = difficulty === "hard" ? 8 : difficulty === "medium" ? 4 : 0;
  const randomWeight = difficulty === "easy" ? 54 : difficulty === "medium" ? 20 : 7;
  const averagePoint = move.absoluteCells.reduce(
    (acc, point) => ({ x: acc.x + point.x / move.absoluteCells.length, y: acc.y + point.y / move.absoluteCells.length }),
    { x: 0, y: 0 }
  );

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

  const moves = getLegalMoves(game, playerId);
  if (moves.length === 0) return null;

  moves.sort((left, right) => scoreMove(game, player, right, player.difficulty) - scoreMove(game, player, left, player.difficulty));
  return moves[0];
}

export function summarizeCpuPosition(game, playerId) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;

  return {
    frontiers: getFrontierPoints(game, playerId).length,
    legalMoves: getLegalMoves(game, playerId).length,
    remainingSquares: getRemainingSquares(player)
  };
}
