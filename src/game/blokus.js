export const BOARD_SIZE = 20;

export const PLAYER_LIBRARY = [
  {
    id: "blue",
    name: "Blue",
    shortName: "Blue",
    corner: { x: 0, y: 0 },
    colors: {
      base: "#1478ff",
      deep: "#064bc9",
      light: "#7ed3ff",
      shadow: "rgba(4, 67, 185, 0.58)"
    }
  },
  {
    id: "green",
    name: "Green",
    shortName: "Green",
    corner: { x: 0, y: BOARD_SIZE - 1 },
    colors: {
      base: "#33c21f",
      deep: "#16880e",
      light: "#a4ff66",
      shadow: "rgba(16, 120, 14, 0.58)"
    }
  },
  {
    id: "orange",
    name: "Orange",
    shortName: "Orange",
    corner: { x: BOARD_SIZE - 1, y: 0 },
    colors: {
      base: "#ff9d00",
      deep: "#c46600",
      light: "#ffd66a",
      shadow: "rgba(197, 98, 0, 0.58)"
    }
  },
  {
    id: "red",
    name: "Red",
    shortName: "Red",
    corner: { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
    colors: {
      base: "#ff352c",
      deep: "#b90f0a",
      light: "#ff9c8b",
      shadow: "rgba(185, 15, 10, 0.58)"
    }
  }
];

export const TWO_PLAYER_LIBRARY = [
  PLAYER_LIBRARY[0],
  PLAYER_LIBRARY[3]
];

export const PIECES = [
  { id: "mono", label: "I1", cells: [[0, 0]] },
  { id: "domino", label: "I2", cells: [[0, 0], [0, 1]] },
  { id: "tri-i", label: "I3", cells: [[0, 0], [0, 1], [0, 2]] },
  { id: "tri-v", label: "V3", cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "tet-i", label: "I4", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: "tet-o", label: "O4", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "tet-t", label: "T4", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "tet-l", label: "L4", cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: "tet-s", label: "S4", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: "pent-f", label: "F", cells: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]] },
  { id: "pent-i", label: "I5", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: "pent-l", label: "L5", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
  { id: "pent-n", label: "N", cells: [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]] },
  { id: "pent-p", label: "P", cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { id: "pent-t", label: "T5", cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: "pent-u", label: "U", cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { id: "pent-v", label: "V5", cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { id: "pent-w", label: "W", cells: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
  { id: "pent-x", label: "X", cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: "pent-y", label: "Y", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]] },
  { id: "pent-z", label: "Z", cells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] }
].map((piece) => ({
  ...piece,
  size: piece.cells.length
}));

export const PIECE_MAP = new Map(PIECES.map((piece) => [piece.id, piece]));

const ORTHOGONAL = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

const DIAGONAL = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 }
];

export function getPlayersForCount(playerCount) {
  if (playerCount === 2) {
    return TWO_PLAYER_LIBRARY.map(clonePlayer);
  }

  return PLAYER_LIBRARY.slice(0, playerCount).map(clonePlayer);
}

function clonePlayer(player) {
  return {
    ...player,
    corner: { ...player.corner },
    colors: { ...player.colors }
  };
}

export function createEmptyBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

export function createPlayerState(player, config = {}) {
  return {
    ...player,
    type: config.type ?? "cpu",
    difficulty: config.difficulty ?? "medium",
    remaining: PIECES.map((piece) => piece.id),
    placedCells: 0,
    passed: false,
    moveCount: 0,
    lastPieceId: null
  };
}

export function createGame(config = {}) {
  const playerCount = config.playerCount ?? 4;
  const players = getPlayersForCount(playerCount).map((player, index) => {
    const playerConfig = config.players?.[index] ?? {};
    return createPlayerState(player, playerConfig);
  });

  return {
    board: createEmptyBoard(config.boardSize ?? BOARD_SIZE),
    boardSize: config.boardSize ?? BOARD_SIZE,
    players,
    currentPlayerIndex: 0,
    startedAt: Date.now(),
    status: "playing",
    winnerIds: [],
    log: ["New local game started."]
  };
}

export function cloneGame(game) {
  return {
    ...game,
    board: game.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    players: game.players.map((player) => ({
      ...player,
      corner: { ...player.corner },
      colors: { ...player.colors },
      remaining: [...player.remaining],
      lastPieceId: player.lastPieceId ?? null
    })),
    winnerIds: [...game.winnerIds],
    log: [...game.log]
  };
}

export function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
}

export function rotateCells(cells) {
  return normalizeCells(cells.map(([x, y]) => [y, -x]));
}

export function flipCells(cells) {
  return normalizeCells(cells.map(([x, y]) => [-x, y]));
}

export function transformCells(pieceOrCells, transform = {}) {
  let cells = Array.isArray(pieceOrCells) ? pieceOrCells : pieceOrCells.cells;
  const rotations = ((transform.rotation ?? 0) / 90) % 4;

  cells = normalizeCells(cells);
  if (transform.flipX) {
    cells = flipCells(cells);
  }
  if (transform.flipY) {
    cells = normalizeCells(cells.map(([x, y]) => [x, -y]));
  }
  for (let index = 0; index < rotations; index += 1) {
    cells = rotateCells(cells);
  }

  return normalizeCells(cells);
}

export function getOrientations(piece) {
  const seen = new Map();
  const flips = [
    { flipX: false, flipY: false },
    { flipX: true, flipY: false },
    { flipX: false, flipY: true },
    { flipX: true, flipY: true }
  ];

  for (const flip of flips) {
    for (const rotation of [0, 90, 180, 270]) {
      const cells = transformCells(piece, { ...flip, rotation });
      const key = cells.map(([x, y]) => `${x},${y}`).join("|");
      if (!seen.has(key)) {
        seen.set(key, { cells, transform: { ...flip, rotation } });
      }
    }
  }

  return [...seen.values()];
}

export function getPieceBounds(cells) {
  return {
    width: Math.max(...cells.map(([x]) => x)) + 1,
    height: Math.max(...cells.map(([, y]) => y)) + 1
  };
}

export function getAbsoluteCells(cells, origin) {
  return cells.map(([x, y]) => ({ x: origin.x + x, y: origin.y + y }));
}

export function isInside(boardSize, point) {
  return point.x >= 0 && point.y >= 0 && point.x < boardSize && point.y < boardSize;
}

export function getCell(board, point) {
  return board[point.y]?.[point.x] ?? null;
}

export function playerHasPlaced(board, playerId) {
  return board.some((row) => row.some((cell) => cell?.playerId === playerId));
}

export function validateMove(game, playerId, pieceId, origin, transform = {}) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  const piece = PIECE_MAP.get(pieceId);

  if (!player) {
    return { legal: false, reason: "Player not found." };
  }
  if (game.status !== "playing") {
    return { legal: false, reason: "The game is over." };
  }
  if (!piece || !player.remaining.includes(pieceId)) {
    return { legal: false, reason: "That piece is no longer available." };
  }

  const cells = transformCells(piece, transform);
  const absoluteCells = getAbsoluteCells(cells, origin);

  let touchesOwnCorner = false;
  let touchesOwnEdge = false;
  let coversStartingCorner = false;

  for (const point of absoluteCells) {
    if (!isInside(game.boardSize, point)) {
      return { legal: false, reason: "Piece is outside the board." };
    }
    if (getCell(game.board, point)) {
      return { legal: false, reason: "Piece overlaps another piece." };
    }
    if (point.x === player.corner.x && point.y === player.corner.y) {
      coversStartingCorner = true;
    }

    for (const delta of ORTHOGONAL) {
      const neighbor = getCell(game.board, { x: point.x + delta.x, y: point.y + delta.y });
      if (neighbor?.playerId === playerId) {
        touchesOwnEdge = true;
      }
    }

    for (const delta of DIAGONAL) {
      const neighbor = getCell(game.board, { x: point.x + delta.x, y: point.y + delta.y });
      if (neighbor?.playerId === playerId) {
        touchesOwnCorner = true;
      }
    }
  }

  if (touchesOwnEdge) {
    return { legal: false, reason: "Pieces of the same color cannot touch edges." };
  }

  if (!playerHasPlaced(game.board, playerId)) {
    if (!coversStartingCorner) {
      return { legal: false, reason: "First move must cover the glowing starting corner." };
    }
  } else if (!touchesOwnCorner) {
    return { legal: false, reason: "Move must touch one of your pieces diagonally." };
  }

  return { legal: true, cells, absoluteCells };
}

export function placeMove(game, playerId, move) {
  const validation = validateMove(game, playerId, move.pieceId, move.origin, move.transform);
  if (!validation.legal) {
    return { game, error: validation.reason };
  }

  const next = cloneGame(game);
  const playerIndex = next.players.findIndex((player) => player.id === playerId);
  const player = next.players[playerIndex];
  const piece = PIECE_MAP.get(move.pieceId);

  for (const point of validation.absoluteCells) {
    next.board[point.y][point.x] = {
      playerId,
      pieceId: move.pieceId
    };
  }

  player.remaining = player.remaining.filter((piece) => piece !== move.pieceId);
  player.placedCells += piece.size;
  player.passed = false;
  player.moveCount += 1;
  player.lastPieceId = move.pieceId;
  next.log = [
    `${player.shortName} placed ${piece.label} for ${piece.size} squares.`,
    ...next.log
  ].slice(0, 8);

  advanceTurn(next);
  updateGameStatus(next);

  return { game: next, move: validation };
}

export function passPlayer(game, playerId, forced = false) {
  const next = cloneGame(game);
  const playerIndex = next.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) {
    return { game, error: "Player not found." };
  }

  const player = next.players[playerIndex];
  if (!forced && hasAnyLegalMove(next, player.id)) {
    return { game, error: "You still have legal moves." };
  }

  player.passed = true;
  next.log = [
    `${player.shortName} ${forced ? "has no legal move" : "passed"}.`,
    ...next.log
  ].slice(0, 8);

  advanceTurn(next);
  updateGameStatus(next);

  return { game: next };
}

export function advanceTurn(game) {
  const total = game.players.length;
  for (let offset = 1; offset <= total; offset += 1) {
    const index = (game.currentPlayerIndex + offset) % total;
    const player = game.players[index];
    if (!player.passed && player.remaining.length > 0) {
      game.currentPlayerIndex = index;
      return;
    }
  }
}

export function updateGameStatus(game) {
  const activePlayers = game.players.filter((player) => !player.passed && player.remaining.length > 0);

  if (activePlayers.length === 0 || game.players.every((player) => player.passed || !hasAnyLegalMove(game, player.id))) {
    game.status = "finished";
    const bestScore = Math.max(...game.players.map((player) => getFinalScore(player).score));
    game.winnerIds = game.players
      .filter((player) => getFinalScore(player).score === bestScore)
      .map((player) => player.id);
    game.log = [`Game over. ${game.winnerIds.length > 1 ? "Tie game" : `${game.winnerIds[0]} wins`}.`, ...game.log].slice(0, 8);
  }
}

export function getFrontierPoints(game, playerId) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  const frontiers = new Map();

  if (!playerHasPlaced(game.board, playerId)) {
    return [player.corner];
  }

  for (let y = 0; y < game.boardSize; y += 1) {
    for (let x = 0; x < game.boardSize; x += 1) {
      const cell = game.board[y][x];
      if (cell?.playerId !== playerId) continue;

      for (const delta of DIAGONAL) {
        const point = { x: x + delta.x, y: y + delta.y };
        if (!isInside(game.boardSize, point) || getCell(game.board, point)) continue;
        const ownEdgeNeighbor = ORTHOGONAL.some((edge) => {
          const neighbor = getCell(game.board, { x: point.x + edge.x, y: point.y + edge.y });
          return neighbor?.playerId === playerId;
        });
        if (!ownEdgeNeighbor) {
          frontiers.set(`${point.x},${point.y}`, point);
        }
      }
    }
  }

  return [...frontiers.values()];
}

export function getLegalMoves(game, playerId, options = {}) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player || player.passed) return [];

  const frontiers = getFrontierPoints(game, playerId);
  const moves = [];
  const pieceIds = options.pieceId ? [options.pieceId] : player.remaining;

  for (const pieceId of pieceIds) {
    const piece = PIECE_MAP.get(pieceId);
    if (!piece || !player.remaining.includes(pieceId)) continue;

    for (const orientation of getOrientations(piece)) {
      for (const target of frontiers) {
        for (const [cellX, cellY] of orientation.cells) {
          const origin = { x: target.x - cellX, y: target.y - cellY };
          const validation = validateMove(game, playerId, pieceId, origin, orientation.transform);
          if (validation.legal) {
            moves.push({
              pieceId,
              origin,
              transform: orientation.transform,
              cells: orientation.cells,
              absoluteCells: validation.absoluteCells
            });
          }
        }
      }
    }
  }

  return moves;
}

export function hasAnyLegalMove(game, playerId) {
  return getLegalMoves(game, playerId).length > 0;
}

export function getPlacedCellsForPlayer(board, playerId) {
  return board.reduce(
    (total, row) => total + row.filter((cell) => cell?.playerId === playerId).length,
    0
  );
}

export function getRemainingSquares(player) {
  return player.remaining.reduce((total, pieceId) => total + (PIECE_MAP.get(pieceId)?.size ?? 0), 0);
}

export function getFinalScore(player) {
  const remaining = getRemainingSquares(player);
  let score = player.placedCells;
  let bonus = 0;

  if (remaining === 0) {
    bonus += 15;
    if (player.lastPieceId === "mono") {
      bonus += 5;
    }
  }

  score += bonus;

  return {
    score,
    placed: player.placedCells,
    remaining,
    bonus
  };
}

export function serializeGame(game) {
  return JSON.stringify(game);
}

export function hydrateGame(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return {
    ...parsed,
    board: parsed.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    players: parsed.players.map((player) => ({
      ...player,
      colors: { ...player.colors },
      corner: { ...player.corner },
      remaining: [...player.remaining],
      lastPieceId: player.lastPieceId ?? null
    })),
    log: [...(parsed.log ?? [])],
    winnerIds: [...(parsed.winnerIds ?? [])]
  };
}
