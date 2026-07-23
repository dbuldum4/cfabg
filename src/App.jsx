import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createGame,
  getFinalScore,
  getLegalMoveCount,
  getPieceBounds,
  getPlayersForCount,
  getRemainingSquares,
  hydrateGame,
  passPlayer,
  PIECE_MAP,
  PIECES,
  placeMove,
  serializeGame,
  transformCells,
  validateMove
} from "./game/blokus.js";
import { chooseCpuMove, summarizeCpuPosition } from "./game/cpu.js";

const STORAGE_KEY = "cool-frutiger-aero-block-game-save";
const MODE_STORAGE_KEY = "cool-frutiger-aero-block-game-darker-mode";
const BOARD_LABELS = "ABCDEFGHIJKLMNOPQRST".split("");
const DEFAULT_SETUP = {
  playerCount: 4,
  players: [
    { type: "human", difficulty: "medium" },
    { type: "cpu", difficulty: "medium" },
    { type: "cpu", difficulty: "medium" },
    { type: "cpu", difficulty: "medium" }
  ]
};
const DEFAULT_TRANSFORM = { rotation: 0, flipX: false, flipY: false };

function createPieceTransforms() {
  return {};
}

function getPieceTransform(pieceTransforms, playerId, pieceId) {
  return pieceTransforms[playerId]?.[pieceId] ?? DEFAULT_TRANSFORM;
}

function setPieceTransform(pieceTransforms, playerId, pieceId, transform) {
  return {
    ...pieceTransforms,
    [playerId]: {
      ...(pieceTransforms[playerId] ?? {}),
      [pieceId]: { ...transform }
    }
  };
}

function makeGame(setup) {
  return createGame({
    playerCount: setup.playerCount,
    players: setup.players
  });
}

function getVisiblePreviewCells(game, cells, origin) {
  const visibleCells = [];

  for (const [x, y] of cells) {
    const point = { x: origin.x + x, y: origin.y + y };
    if (point.x >= 0 && point.y >= 0 && point.x < game.boardSize && point.y < game.boardSize) {
      visibleCells.push(point);
    }
  }

  return visibleCells;
}

function sameCell(a, b) {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y;
}

function useEventCallback(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args) => callbackRef.current(...args), []);
}

function App() {
  const [screen, setScreen] = useState("setup");
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [game, setGame] = useState(() => makeGame(DEFAULT_SETUP));
  const [history, setHistory] = useState([]);
  const [selectedPieceId, setSelectedPieceId] = useState("mono");
  const [pieceTransforms, setPieceTransforms] = useState(() => createPieceTransforms());
  const [dragPieceId, setDragPieceId] = useState(null);
  const [pointerDrag, setPointerDrag] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [hintMove, setHintMove] = useState(null);
  const [notice, setNotice] = useState("Blue starts from the glowing corner.");
  const [cpuThinking, setCpuThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasSave, setHasSave] = useState(() => Boolean(localStorage.getItem(STORAGE_KEY)));
  const [darkerMode, setDarkerMode] = useState(() => localStorage.getItem(MODE_STORAGE_KEY) === "true");
  const boardGridRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const dragAnimationFrameRef = useRef(null);
  const dragPreviewPointRef = useRef(null);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const selectedPiece = selectedPieceId ? PIECE_MAP.get(selectedPieceId) : null;
  const pointerDragPieceId = pointerDrag?.pieceId;
  const previewPieceId = pointerDragPieceId ?? selectedPieceId;
  const previewPiece = previewPieceId ? PIECE_MAP.get(previewPieceId) : null;
  const setupPlayers = useMemo(() => getPlayersForCount(setup.playerCount), [setup.playerCount]);
  const selectedTransform = selectedPieceId
    ? getPieceTransform(pieceTransforms, currentPlayer?.id, selectedPieceId)
    : DEFAULT_TRANSFORM;
  const previewTransform = previewPieceId
    ? getPieceTransform(pieceTransforms, currentPlayer?.id, previewPieceId)
    : DEFAULT_TRANSFORM;
  const previewCells = useMemo(
    () => (previewPiece ? transformCells(previewPiece, previewTransform) : []),
    [previewPiece, previewTransform]
  );
  const updateHoverCell = useCallback((cell) => {
    setHoverCell((previous) => (sameCell(previous, cell) ? previous : cell));
  }, []);
  const clearHoverCell = useCallback(() => updateHoverCell(null), [updateHoverCell]);
  const selectPiece = useCallback((pieceId) => {
    setSelectedPieceId(pieceId);
    setHintMove(null);
  }, []);
  const rotatePieceEvent = useEventCallback(rotatePiece);
  const flipHorizontalEvent = useEventCallback(flipHorizontal);
  const flipVerticalEvent = useEventCallback(flipVertical);
  const undoMoveEvent = useEventCallback(undoMove);
  const placeAtEvent = useEventCallback(placeAt);
  const dropPieceEvent = useEventCallback(handlePieceDrop);
  const dragStartEvent = useEventCallback(handlePieceDragStart);
  const dragEndEvent = useEventCallback(handlePieceDragEnd);
  const pointerDownEvent = useEventCallback(handlePiecePointerDown);

  const legalMoveCount = useMemo(() => {
    if (!currentPlayer || game.status !== "playing") return 0;
    if (typeof game.legalMoveCount === "number") return game.legalMoveCount;
    return getLegalMoveCount(game, currentPlayer.id);
  }, [game, currentPlayer]);
  const hoverMove = useMemo(() => {
    if (!hoverCell || !previewPiece || !currentPlayer || currentPlayer.type !== "human") return null;
    const validation = validateMove(game, currentPlayer.id, previewPiece.id, hoverCell, previewTransform);
    return {
      ...validation,
      absoluteCells: getVisiblePreviewCells(game, previewCells, hoverCell),
      origin: hoverCell,
      pieceId: previewPiece.id,
      transform: previewTransform
    };
  }, [currentPlayer, game, hoverCell, previewCells, previewPiece, previewTransform]);

  const ghostCells = hoverMove?.absoluteCells ?? hintMove?.absoluteCells ?? [];
  const ghostLegal = hoverMove ? hoverMove.legal : Boolean(hintMove);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - game.startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [game.startedAt]);

  useEffect(() => {
    document.documentElement.dataset.visualMode = darkerMode ? "deep" : "aero";
    localStorage.setItem(MODE_STORAGE_KEY, darkerMode ? "true" : "false");
  }, [darkerMode]);

  useEffect(() => {
    if (!currentPlayer) return;
    if (game.status !== "playing") return;
    if (!currentPlayer.remaining.includes(selectedPieceId)) {
      setSelectedPieceId(currentPlayer.remaining[0] ?? null);
      setHintMove(null);
    }
  }, [currentPlayer, game.status, selectedPieceId]);

  useEffect(() => {
    if (screen !== "play" || !currentPlayer || game.status !== "playing" || currentPlayer.type !== "cpu") {
      setCpuThinking(false);
      return;
    }

    setCpuThinking(true);
    const timeout = window.setTimeout(() => {
      const move = chooseCpuMove(game, currentPlayer.id);
      setHistory((previous) => [game, ...previous].slice(0, 80));
      if (move) {
        const result = placeMove(game, currentPlayer.id, move);
        const nextPlayer = result.game.players[result.game.currentPlayerIndex];
        const moveLabel = PIECE_MAP.get(move.pieceId).label;
        setGame(result.game);
        setNotice(
          result.game.status === "finished"
            ? winnerText(result.game)
            : nextPlayer?.type === "human"
              ? `${nextPlayer.shortName}, your move. ${currentPlayer.shortName} placed ${moveLabel}.`
              : `${currentPlayer.shortName} placed ${moveLabel}.`
        );
      } else {
        const result = passPlayer(game, currentPlayer.id, true);
        const nextPlayer = result.game.players[result.game.currentPlayerIndex];
        setGame(result.game);
        setNotice(
          result.game.status === "finished"
            ? winnerText(result.game)
            : nextPlayer?.type === "human"
              ? `${nextPlayer.shortName}, your move. ${currentPlayer.shortName} was blocked.`
              : `${currentPlayer.shortName} is blocked and passed.`
        );
      }
      setHintMove(null);
      setCpuThinking(false);
    }, 420);

    return () => window.clearTimeout(timeout);
  }, [currentPlayer, game, screen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (currentPlayer?.type !== "human" || game.status !== "playing") return;

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        rotatePieceEvent();
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        flipHorizontalEvent();
      }
      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        flipVerticalEvent();
      }
      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        undoMoveEvent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPlayer?.type, game.status, flipHorizontalEvent, flipVerticalEvent, rotatePieceEvent, undoMoveEvent]);

  useEffect(() => {
    if (!pointerDragPieceId) return undefined;
    const pieceId = pointerDragPieceId;
    let boardMetrics = null;

    const refreshBoardMetrics = () => {
      const board = boardGridRef.current;
      if (!board) {
        boardMetrics = null;
        return;
      }

      const rect = board.getBoundingClientRect();
      boardMetrics = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        cellWidth: rect.width / game.boardSize,
        cellHeight: rect.height / game.boardSize
      };
    };

    const getBoardCellFromPoint = (clientX, clientY) => {
      if (!boardMetrics) refreshBoardMetrics();
      if (!boardMetrics) return null;
      if (clientX < boardMetrics.left || clientX > boardMetrics.right || clientY < boardMetrics.top || clientY > boardMetrics.bottom) {
        return null;
      }

      return {
        x: Math.min(game.boardSize - 1, Math.max(0, Math.floor((clientX - boardMetrics.left) / boardMetrics.cellWidth))),
        y: Math.min(game.boardSize - 1, Math.max(0, Math.floor((clientY - boardMetrics.top) / boardMetrics.cellHeight)))
      };
    };

    const scheduleDragPreviewPosition = (x, y) => {
      dragPreviewPointRef.current = { x, y };
      if (dragAnimationFrameRef.current !== null) return;

      dragAnimationFrameRef.current = window.requestAnimationFrame(() => {
        dragAnimationFrameRef.current = null;
        const preview = dragPreviewRef.current;
        const point = dragPreviewPointRef.current;
        if (!preview || !point) return;
        preview.style.setProperty("--preview-x", `${point.x}px`);
        preview.style.setProperty("--preview-y", `${point.y}px`);
      });
    };

    const handlePointerMove = (event) => {
      const cell = getBoardCellFromPoint(event.clientX, event.clientY);
      scheduleDragPreviewPosition(event.clientX, event.clientY);
      setPointerDrag((previous) =>
        previous && previous.overBoard !== Boolean(cell)
          ? { ...previous, x: event.clientX, y: event.clientY, overBoard: Boolean(cell) }
          : previous
      );
      updateHoverCell(cell);
    };

    const handlePointerUp = (event) => {
      const cell = getBoardCellFromPoint(event.clientX, event.clientY);
      if (cell) {
        dropPieceEvent(cell, pieceId);
      }
      setPointerDrag(null);
      setDragPieceId(null);
      dragPreviewPointRef.current = null;
    };

    refreshBoardMetrics();
    window.addEventListener("resize", refreshBoardMetrics);
    window.addEventListener("scroll", refreshBoardMetrics, { capture: true, passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerUp, { once: true });

    return () => {
      if (dragAnimationFrameRef.current) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      window.removeEventListener("resize", refreshBoardMetrics);
      window.removeEventListener("scroll", refreshBoardMetrics, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dropPieceEvent, game.boardSize, pointerDragPieceId, updateHoverCell]);

  function updateSetupPlayer(index, patch) {
    setSetup((previous) => ({
      ...previous,
      players: previous.players.map((player, playerIndex) =>
        playerIndex === index ? { ...player, ...patch } : player
      )
    }));
  }

  function updatePlayerCount(playerCount) {
    setSetup((previous) => ({
      ...previous,
      playerCount,
      players: Array.from({ length: playerCount }, (_, index) =>
        previous.players[index] ?? DEFAULT_SETUP.players[index] ?? { type: "cpu", difficulty: "medium" }
      )
    }));
  }

  function startNewGame() {
    const next = makeGame(setup);
    setGame(next);
    setHistory([]);
    setSelectedPieceId(next.players[0].remaining[0]);
    setPieceTransforms(createPieceTransforms());
    setDragPieceId(null);
    setPointerDrag(null);
    setHoverCell(null);
    setHintMove(null);
    setNotice(`${next.players[0].shortName} starts from the glowing corner.`);
    setElapsed(0);
    setScreen("play");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
  }

  function openSetupScreen() {
    setScreen("setup");
    setCpuThinking(false);
    setDragPieceId(null);
    setPointerDrag(null);
    setHoverCell(null);
    setHintMove(null);
    setNotice("Choose the local players, then start a new match.");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
  }

  function saveGame() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        setup,
        game: serializeGame(game)
      })
    );
    setHasSave(true);
    setNotice("Saved locally in this browser.");
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const nextGame = hydrateGame(parsed.game);
      setSetup(parsed.setup ?? setup);
      setGame({ ...nextGame, startedAt: Date.now() });
      setHistory([]);
      setSelectedPieceId(nextGame.players[nextGame.currentPlayerIndex]?.remaining[0] ?? null);
      setPieceTransforms(createPieceTransforms());
      setDragPieceId(null);
      setPointerDrag(null);
      setHintMove(null);
      setNotice("Loaded local save.");
      setScreen("play");
      setElapsed(0);
    } catch {
      setNotice("Saved game could not be loaded.");
    }
  }

  function rotatePiece(pieceId = selectedPieceId) {
    if (!pieceId || !currentPlayer) return;
    setSelectedPieceId(pieceId);
    setPieceTransforms((previous) => {
      const current = getPieceTransform(previous, currentPlayer.id, pieceId);
      return setPieceTransform(previous, currentPlayer.id, pieceId, {
        ...current,
        rotation: (current.rotation + 90) % 360
      });
    });
    setHintMove(null);
  }

  function flipHorizontal() {
    if (!selectedPieceId || !currentPlayer) return;
    setPieceTransforms((previous) => {
      const current = getPieceTransform(previous, currentPlayer.id, selectedPieceId);
      return setPieceTransform(previous, currentPlayer.id, selectedPieceId, {
        ...current,
        flipX: !current.flipX
      });
    });
    setHintMove(null);
  }

  function flipVertical() {
    if (!selectedPieceId || !currentPlayer) return;
    setPieceTransforms((previous) => {
      const current = getPieceTransform(previous, currentPlayer.id, selectedPieceId);
      return setPieceTransform(previous, currentPlayer.id, selectedPieceId, {
        ...current,
        flipY: !current.flipY
      });
    });
    setHintMove(null);
  }

  function placeAt(cell, pieceId = selectedPieceId) {
    const piece = pieceId ? PIECE_MAP.get(pieceId) : null;
    if (game.status !== "playing" || currentPlayer.type !== "human" || !piece) return;
    const pieceTransform = getPieceTransform(pieceTransforms, currentPlayer.id, pieceId);

    const result = placeMove(game, currentPlayer.id, {
      pieceId: piece.id,
      origin: cell,
      transform: pieceTransform
    });

    if (result.error) {
      setNotice(result.error);
      return;
    }

    setHistory((previous) => [game, ...previous].slice(0, 80));
    setGame(result.game);
    setNotice(`${currentPlayer.shortName} placed ${piece.label}.`);
    setHoverCell(null);
    setHintMove(null);
    setDragPieceId(null);
  }

  function passCurrentPlayer() {
    if (game.status !== "playing" || currentPlayer.type !== "human") return;
    const result = passPlayer(game, currentPlayer.id);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setHistory((previous) => [game, ...previous].slice(0, 80));
    setGame(result.game);
    setHintMove(null);
    setNotice(`${currentPlayer.shortName} passed.`);
  }

  function requestHint() {
    if (game.status !== "playing" || currentPlayer.type !== "human") return;
    const move = chooseCpuMove(game, currentPlayer.id);
    if (!move) {
      setHintMove(null);
      setNotice("No legal move is available.");
      return;
    }
    setSelectedPieceId(move.pieceId);
    setPieceTransforms((previous) =>
      setPieceTransform(previous, currentPlayer.id, move.pieceId, move.transform)
    );
    setHintMove(move);
    setNotice(`Hint: ${PIECE_MAP.get(move.pieceId).label} can fit on the glowing preview.`);
  }

  function playHint() {
    if (!hintMove || game.status !== "playing" || currentPlayer.type !== "human") return;
    const result = placeMove(game, currentPlayer.id, hintMove);
    if (result.error) {
      setNotice(result.error);
      setHintMove(null);
      return;
    }
    setHistory((previous) => [game, ...previous].slice(0, 80));
    setGame(result.game);
    setNotice(`${currentPlayer.shortName} played the hinted ${PIECE_MAP.get(hintMove.pieceId).label}.`);
    setHintMove(null);
  }

  function undoMove() {
    if (history.length === 0) return;
    const [previous, ...rest] = history;
    setGame(previous);
    setHistory(rest);
    setHintMove(null);
    setHoverCell(null);
    setNotice("Undid the last move.");
  }

  function handlePieceDragStart(event, pieceId) {
    if (game.status !== "playing" || currentPlayer?.type !== "human") return;
    if (!currentPlayer.remaining.includes(pieceId)) return;

    setSelectedPieceId(pieceId);
    setDragPieceId(pieceId);
    setHintMove(null);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-cool-frutiger-aero-block-game-piece", pieceId);
    event.dataTransfer.setData("text/plain", pieceId);
  }

  function handlePiecePointerDown(event, pieceId) {
    if (event.button !== 0) return;
    if (game.status !== "playing" || currentPlayer?.type !== "human") return;
    if (!currentPlayer.remaining.includes(pieceId)) return;

    event.preventDefault();
    setSelectedPieceId(pieceId);
    setDragPieceId(pieceId);
    setHintMove(null);
    dragPreviewPointRef.current = { x: event.clientX, y: event.clientY };
    setPointerDrag({
      pieceId,
      x: event.clientX,
      y: event.clientY,
      overBoard: false
    });
  }

  function handlePieceDragEnd() {
    setDragPieceId(null);
    setPointerDrag(null);
  }

  function handlePieceDrop(cell, pieceId) {
    const droppedPieceId = pieceId || selectedPieceId;
    if (!droppedPieceId) return;
    setSelectedPieceId(droppedPieceId);
    placeAt(cell, droppedPieceId);
  }

  const currentSummary = useMemo(
    () => (currentPlayer ? summarizeCpuPosition(game, currentPlayer.id, legalMoveCount) : null),
    [currentPlayer, game, legalMoveCount]
  );
  const finalScores = useMemo(
    () => game.players.map((player) => ({ player, ...getFinalScore(player) })),
    [game.players]
  );

  return (
    <main className={`aqua-app ${darkerMode ? "darker-mode" : ""}`}>
      <BackgroundDecor />

      <header className="top-bar glass-panel">
        <div className="brand-lockup">
          <div className="brand-gem" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>Cool Frutiger Aero Block Game</h1>
            <p>{game.status === "finished" ? "Final scores" : "Local strategy"}</p>
          </div>
        </div>

        <div className="top-actions" aria-label="Game actions">
          <button
            className="aqua-button compact mode-toggle"
            aria-pressed={darkerMode}
            onClick={() => setDarkerMode((enabled) => !enabled)}
          >
            <Icon name={darkerMode ? "sun" : "moon"} />
            {darkerMode ? "Bright" : "Darker"}
          </button>
          <button className="aqua-button compact" onClick={saveGame} disabled={screen !== "play"}>
            <Icon name="save" />
            Save
          </button>
          <button className="aqua-button compact" onClick={loadGame} disabled={!hasSave}>
            <Icon name="folder" />
            Load
          </button>
          <button className="aqua-button danger compact" data-testid="new-game-button" onClick={openSetupScreen}>
            <Icon name="spark" />
            New
          </button>
        </div>
      </header>

      {screen === "setup" ? (
        <section className="setup-screen">
          <div className="setup-card glass-panel">
            <PanelHeader title="Game Setup" />
            <div className="setup-title-row">
              <div>
                <h2>Local Match</h2>
                <p>Choose 2-4 seats, then mix humans and CPUs however you want.</p>
              </div>
              <div className="setup-badge">20 x 20</div>
            </div>

            <div className="field-group">
              <span className="field-label">Players</span>
              <div className="segmented" role="group" aria-label="Player count">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    className={setup.playerCount === count ? "active" : ""}
                    onClick={() => updatePlayerCount(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-players setup-players-grid">
              {setupPlayers.map((player, index) => (
                <SetupPlayerRow
                  key={`${player.id}-${index}`}
                  index={index}
                  player={player}
                  setup={setup.players[index]}
                  onChange={(patch) => updateSetupPlayer(index, patch)}
                />
              ))}
            </div>

            <div className="setup-actions">
              <button className="aqua-button start-button" data-testid="start-game-button" onClick={startNewGame}>
                <Icon name="play" />
                Start Game
              </button>
              <div className="setup-meta">
                <div>
                  <span>Board</span>
                  <strong>20 x 20</strong>
                </div>
                <div>
                  <span>Pieces</span>
                  <strong>21 each</strong>
                </div>
                <div>
                  <span>Play</span>
                  <strong>Local only</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="game-layout play-layout">
          <PiecePanel
            currentPlayer={currentPlayer}
            selectedPieceId={selectedPieceId}
            pieceTransforms={pieceTransforms}
            dragPieceId={dragPieceId}
            gameStatus={game.status}
            onSelect={selectPiece}
            onRotate={rotatePieceEvent}
            onDragStart={dragStartEvent}
            onDragEnd={dragEndEvent}
            onPointerDown={pointerDownEvent}
          />

          <section className="board-zone glass-panel">
            <BoardHeader
              currentPlayer={currentPlayer}
              legalMoveCount={legalMoveCount}
              cpuThinking={cpuThinking}
              status={game.status}
            />
            <Board
              game={game}
              ghostCells={ghostCells}
              ghostLegal={ghostLegal}
              currentPlayer={currentPlayer}
              gridRef={boardGridRef}
              onHover={updateHoverCell}
              onLeave={clearHoverCell}
              onPlace={placeAtEvent}
              onDropPiece={dropPieceEvent}
            />
          </section>

          <aside className="command-panel">
            <div className="status-panel glass-panel">
              <PanelHeader title="Players" />
              <div className="player-stack">
                {game.players.map((player, index) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    active={index === game.currentPlayerIndex && game.status === "playing"}
                    winner={game.winnerIds.includes(player.id)}
                  />
                ))}
              </div>

              <div className="status-box">
                <div className="status-title">
                  <Icon name={game.status === "finished" ? "trophy" : "info"} />
                  {game.status === "finished" ? "Game Over" : currentPlayer?.type === "cpu" ? "CPU Turn" : "Your Turn"}
                </div>
                <p>{game.status === "finished" ? winnerText(game) : notice}</p>
                {currentSummary && game.status === "playing" ? (
                  <div className="mini-stats">
                    <span>{currentSummary.frontiers} corners</span>
                    <span>{currentSummary.legalMoves} moves</span>
                    <span>{currentSummary.remainingSquares} left</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="control-pad glass-panel">
              <PanelHeader title="Turn Controls" />
              <div className="control-grid compact-controls">
                <button className="control-button" onClick={flipHorizontal} disabled={!selectedPiece || currentPlayer?.type !== "human"}>
                  <Icon name="flipH" />
                  <span>Flip H</span>
                  <kbd>F</kbd>
                </button>
                <button className="control-button" onClick={flipVertical} disabled={!selectedPiece || currentPlayer?.type !== "human"}>
                  <Icon name="flipV" />
                  <span>Flip V</span>
                  <kbd>V</kbd>
                </button>
                <button className="control-button" onClick={undoMove} disabled={history.length === 0}>
                  <Icon name="undo" />
                  <span>Undo</span>
                  <kbd>U</kbd>
                </button>
              </div>

              <div className="turn-actions">
                <button className="aqua-button" data-testid="hint-button" onClick={requestHint} disabled={currentPlayer?.type !== "human" || game.status !== "playing"}>
                  <Icon name="bulb" />
                  Hint
                </button>
                <button className="aqua-button" data-testid="play-hint-button" onClick={playHint} disabled={!hintMove}>
                  <Icon name="star" />
                  Play Hint
                </button>
                <button className="aqua-button warning" data-testid="pass-button" onClick={passCurrentPlayer} disabled={legalMoveCount > 0 || currentPlayer?.type !== "human" || game.status !== "playing"}>
                  <Icon name="skip" />
                  Pass
                </button>
              </div>
            </div>

            <div className="log-panel glass-panel">
              <PanelHeader title="Game Log" />
              <ol>
                {game.log.map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
              <div className="timer-pill">
                <Icon name="clock" />
                {formatTime(elapsed)}
              </div>
            </div>
          </aside>
        </section>
      )}

      {pointerDrag && !pointerDrag.overBoard ? (
        <div
          ref={dragPreviewRef}
          className="drag-preview"
          style={{
            "--preview-x": `${(dragPreviewPointRef.current ?? pointerDrag).x}px`,
            "--preview-y": `${(dragPreviewPointRef.current ?? pointerDrag).y}px`,
            ...playerStyle(currentPlayer)
          }}
        >
          <MiniPiece
            piece={PIECE_MAP.get(pointerDrag.pieceId)}
            transform={getPieceTransform(pieceTransforms, currentPlayer?.id, pointerDrag.pieceId)}
            color={currentPlayer?.colors}
          />
        </div>
      ) : null}

      {screen === "play" && game.status === "finished" ? (
        <div className="results-modal" role="dialog" aria-modal="true" aria-labelledby="results-title">
          <div className="results-card glass-panel">
            <h2 id="results-title">Final Scores</h2>
            <div className="results-list">
              {finalScores
                .sort((a, b) => b.score - a.score)
                .map(({ player, score, placed, remaining, bonus }) => (
                  <div key={player.id} className="result-row" style={playerStyle(player)}>
                    <span className="player-orb">{player.shortName[0]}</span>
                    <strong>{player.shortName}</strong>
                    <span>{placed} placed</span>
                    <span>{remaining} left</span>
                    <span>{bonus ? `+${bonus} bonus` : "no bonus"}</span>
                    <b>{score}</b>
                  </div>
                ))}
            </div>
            <button className="aqua-button start-button" onClick={openSetupScreen}>
              <Icon name="spark" />
              New Game
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function BackgroundDecor() {
  return (
    <div className="background-decor" aria-hidden="true">
      <span className="bubble b1" />
      <span className="bubble b2" />
      <span className="bubble b3" />
      <span className="bubble b4" />
      <span className="bubble b5" />
      <span className="light-arc arc1" />
      <span className="light-arc arc2" />
    </div>
  );
}

function PanelHeader({ title }) {
  return (
    <div className="panel-header">
      <span>{title}</span>
      <i />
    </div>
  );
}

function SetupPlayerRow({ index, player, setup, onChange }) {
  return (
    <div className="setup-player" style={playerStyle(player)}>
      <span className="player-orb">{index + 1}</span>
      <div className="setup-copy">
        <strong>{player.shortName}</strong>
        <span>{setup.type === "human" ? "Human" : `CPU ${titleCase(setup.difficulty)}`}</span>
      </div>
      <select value={setup.type} onChange={(event) => onChange({ type: event.target.value })}>
        <option value="human">Human</option>
        <option value="cpu">CPU</option>
      </select>
      {setup.type === "cpu" ? (
        <select value={setup.difficulty} onChange={(event) => onChange({ difficulty: event.target.value })}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      ) : null}
    </div>
  );
}

const BoardHeader = memo(function BoardHeader({ currentPlayer, legalMoveCount, cpuThinking, status }) {
  return (
    <div className="board-header">
      <div>
        <span className="dock-label">Current Turn</span>
        <strong style={playerStyle(currentPlayer)}>{status === "finished" ? "Finished" : currentPlayer?.shortName}</strong>
      </div>
      <div className="turn-meter" style={playerStyle(currentPlayer)}>
        <span className={cpuThinking ? "pulse-dot active" : "pulse-dot"} />
        {status === "finished" ? "Complete" : cpuThinking ? "Thinking" : `${legalMoveCount} legal moves`}
      </div>
    </div>
  );
});

const PiecePanel = memo(function PiecePanel({
  currentPlayer,
  selectedPieceId,
  pieceTransforms,
  dragPieceId,
  gameStatus,
  onSelect,
  onRotate,
  onDragStart,
  onDragEnd,
  onPointerDown
}) {
  const remainingPieces = useMemo(() => new Set(currentPlayer?.remaining ?? []), [currentPlayer?.remaining]);

  return (
    <aside className="piece-panel glass-panel">
      <div className="tray-heading">
        <div>
          <span className="dock-label">{currentPlayer?.shortName ?? "Player"} Pieces</span>
          <strong>{currentPlayer?.remaining.length ?? 0} left</strong>
        </div>
        <div className="dock-score">
          <span>Score</span>
          <strong>{currentPlayer ? getFinalScore(currentPlayer).placed : 0}</strong>
        </div>
      </div>

      <div className="piece-bank" aria-label="Draggable remaining pieces">
        {PIECES.map((piece) => (
          <PieceToken
            key={piece.id}
            piece={piece}
            player={currentPlayer}
            pieceTransform={getPieceTransform(pieceTransforms, currentPlayer?.id, piece.id)}
            selected={selectedPieceId === piece.id}
            dragging={dragPieceId === piece.id}
            available={remainingPieces.has(piece.id)}
            playable={
              remainingPieces.has(piece.id) &&
              currentPlayer?.type === "human" &&
              gameStatus === "playing"
            }
            onSelect={onSelect}
            onRotate={onRotate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onPointerDown={onPointerDown}
          />
        ))}
      </div>
    </aside>
  );
});

const PieceToken = memo(function PieceToken({
  piece,
  player,
  pieceTransform,
  selected,
  dragging,
  available,
  playable,
  onSelect,
  onRotate,
  onDragStart,
  onDragEnd,
  onPointerDown
}) {
  return (
    <div
      className={[
        "piece-token",
        selected ? "selected" : "",
        dragging ? "dragging" : "",
        !available ? "spent" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={playerStyle(player)}
    >
      <button
        type="button"
        className="piece-dragger"
        data-testid={`piece-${piece.id}`}
        draggable={playable}
        disabled={!playable}
        onClick={() => playable && onSelect(piece.id)}
        onPointerDown={(event) => onPointerDown(event, piece.id)}
        onDragStart={(event) => onDragStart(event, piece.id)}
        onDragEnd={onDragEnd}
        title={`${piece.label}, ${piece.size} squares`}
      >
        <MiniPiece
          piece={piece}
          transform={pieceTransform}
          color={player?.colors}
          disabled={!available}
        />
        <span>{piece.label}</span>
      </button>
      <button
        type="button"
        className="piece-rotate"
        data-testid={`rotate-piece-${piece.id}`}
        disabled={!playable}
        onClick={() => onRotate(piece.id)}
        title={`Rotate ${piece.label}`}
      >
        <Icon name="rotate" />
      </button>
    </div>
  );
});

function Board({ game, ghostCells, ghostLegal, currentPlayer, gridRef, onHover, onLeave, onPlace, onDropPiece }) {
  return (
    <div className="board-frame">
      <BoardTopCoords boardSize={game.boardSize} />
      <div className="board-row">
        <BoardSideCoords boardSize={game.boardSize} />
        <div className="board-grid-wrap">
          <BoardGrid
            game={game}
            currentPlayer={currentPlayer}
            gridRef={gridRef}
            onHover={onHover}
            onLeave={onLeave}
            onPlace={onPlace}
            onDropPiece={onDropPiece}
          />
          <BoardPreview
            boardSize={game.boardSize}
            cells={ghostCells}
            legal={ghostLegal}
            player={currentPlayer}
          />
        </div>
      </div>
    </div>
  );
}

const BoardTopCoords = memo(function BoardTopCoords({ boardSize }) {
  return (
    <div className="top-coords">
      {Array.from({ length: boardSize }, (_, index) => (
        <span key={index}>{index + 1}</span>
      ))}
    </div>
  );
});

const BoardSideCoords = memo(function BoardSideCoords({ boardSize }) {
  return (
    <div className="side-coords">
      {BOARD_LABELS.slice(0, boardSize).map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
});

const BoardGrid = memo(function BoardGrid({ game, currentPlayer, gridRef, onHover, onLeave, onPlace, onDropPiece }) {
  const corners = useMemo(
    () => new Map(game.players.map((player) => [`${player.corner.x},${player.corner.y}`, player])),
    [game.players]
  );
  const playerById = useMemo(
    () => new Map(game.players.map((player) => [player.id, player])),
    [game.players]
  );
  const playerStyles = useMemo(
    () => new Map(game.players.map((player) => [player.id, playerStyle(player)])),
    [game.players]
  );

  return (
    <div
      ref={gridRef}
      className="board-grid"
      data-board-grid="true"
      style={{ "--board-size": game.boardSize }}
      onMouseLeave={onLeave}
      onBlur={onLeave}
    >
      {game.board.map((row, y) =>
        row.map((cell, x) => {
          const occupant = cell ? playerById.get(cell.playerId) : null;
          const cornerPlayer = corners.get(`${x},${y}`);
          const stylePlayer = occupant ?? cornerPlayer;
          const cellStyle = stylePlayer ? playerStyles.get(stylePlayer.id) : undefined;
          const classes = [
            "board-cell",
            occupant ? "occupied" : "",
            cornerPlayer ? "corner-cell" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              type="button"
              aria-label={`Column ${x + 1}, row ${y + 1}`}
              key={`${x}-${y}`}
              data-testid={`cell-${x}-${y}`}
              data-board-cell="true"
              data-x={x}
              data-y={y}
              className={classes}
              style={cellStyle}
              onMouseEnter={() => onHover({ x, y })}
              onFocus={() => onHover({ x, y })}
              onDragEnter={() => onHover({ x, y })}
              onDragOver={(event) => {
                if (game.status !== "playing" || currentPlayer?.type !== "human") return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                onHover({ x, y });
              }}
              onDrop={(event) => {
                event.preventDefault();
                const pieceId =
                  event.dataTransfer.getData("application/x-cool-frutiger-aero-block-game-piece") ||
                  event.dataTransfer.getData("text/plain");
                onDropPiece({ x, y }, pieceId);
              }}
              onClick={() => onPlace({ x, y })}
              disabled={game.status !== "playing" || currentPlayer?.type !== "human"}
            >
              {cornerPlayer ? <span className="corner-star">✦</span> : null}
            </button>
          );
        })
      )}
    </div>
  );
});

const BoardPreview = memo(function BoardPreview({ boardSize, cells, legal, player }) {
  if (cells.length === 0) return null;

  return (
    <div
      className="board-preview-layer"
      aria-hidden="true"
      style={{
        "--board-size": boardSize,
        ...playerStyle(player)
      }}
    >
      {cells.map((point) => (
        <span
          key={`${point.x}-${point.y}`}
          className={`board-preview-cell ${legal ? "legal" : "illegal"}`}
          style={{
            gridColumn: `${point.x + 1}`,
            gridRow: `${point.y + 1}`
          }}
        />
      ))}
    </div>
  );
});

const PlayerCard = memo(function PlayerCard({ player, active, winner }) {
  const score = getFinalScore(player);
  const remainingSquares = getRemainingSquares(player);
  return (
    <article className={`player-card ${active ? "active" : ""} ${winner ? "winner" : ""}`} style={playerStyle(player)}>
      <div className="player-card-top">
        <span className="player-orb">{player.shortName[0]}</span>
        <div>
          <strong>{player.shortName}</strong>
          <span>{player.type === "human" ? "Human" : `CPU ${titleCase(player.difficulty)}`}</span>
        </div>
        <b>{score.score}</b>
      </div>
      <div className="player-progress">
        <span style={{ width: `${Math.round((player.placedCells / 89) * 100)}%` }} />
      </div>
      <div className="player-card-meta">
        <span>{player.remaining.length} pieces</span>
        <span>{remainingSquares} squares left</span>
        <span>{player.passed ? "Blocked" : active ? "Active" : "Waiting"}</span>
      </div>
    </article>
  );
});

const MiniPiece = memo(function MiniPiece({ piece, color, transform = DEFAULT_TRANSFORM, disabled = false }) {
  const { bounds, cellSet } = useMemo(() => {
    const cells = transformCells(piece, transform);
    return {
      bounds: getPieceBounds(cells),
      cellSet: new Set(cells.map(([x, y]) => `${x},${y}`))
    };
  }, [piece, transform]);

  return (
    <span
      className={`mini-piece ${disabled ? "disabled" : ""}`}
      style={{
        "--mini-cols": bounds.width,
        "--mini-rows": bounds.height,
        "--player-base": color?.base ?? "#79cfff",
        "--player-deep": color?.deep ?? "#1478ff",
        "--player-light": color?.light ?? "#d4f8ff"
      }}
    >
      {Array.from({ length: bounds.width * bounds.height }, (_, index) => {
        const x = index % bounds.width;
        const y = Math.floor(index / bounds.width);
        return <i key={`${x}-${y}`} className={cellSet.has(`${x},${y}`) ? "filled" : ""} />;
      })}
    </span>
  );
});

function Icon({ name }) {
  const paths = {
    save: "M5 3h11l3 3v15H5z M8 3v6h8V3 M8 16h8",
    folder: "M3 7h7l2 2h9v10H3z M3 7V5h7l2 2",
    spark: "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z",
    play: "M8 5v14l11-7z",
    rotate: "M18 8a7 7 0 1 0 1 5 M18 8h-5 M18 8V3",
    flipH: "M4 4v16 M20 4v16 M7 12h10 M11 8l-4 4 4 4 M13 8l4 4-4 4",
    flipV: "M4 4h16 M4 20h16 M12 7v10 M8 11l4-4 4 4 M8 13l4 4 4-4",
    undo: "M9 7H4v5 M5 12a8 8 0 1 0 2-5",
    bulb: "M9 18h6 M10 22h4 M8 14a6 6 0 1 1 8 0c-1.4 1-2 2.4-2 4h-4c0-1.6-.6-3-2-4z",
    star: "M12 2l2.7 6.8 7.3.5-5.6 4.7 1.8 7-6.2-3.8L5.8 21l1.8-7L2 9.3l7.3-.5z",
    skip: "M5 5l8 7-8 7z M15 5h4v14h-4z",
    trophy: "M8 4h8v4a4 4 0 0 1-8 0z M6 5H3v2a4 4 0 0 0 4 4 M18 5h3v2a4 4 0 0 1-4 4 M12 12v5 M8 21h8 M10 17h4",
    info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 10v7 M12 7h.01",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    moon: "M21 14.4A7.5 7.5 0 0 1 9.6 3a8.7 8.7 0 1 0 11.4 11.4z",
    sun: "M12 5V2 M12 22v-3 M5 12H2 M22 12h-3 M6.3 6.3 4.2 4.2 M19.8 19.8l-2.1-2.1 M17.7 6.3l2.1-2.1 M4.2 19.8l2.1-2.1 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name] ?? paths.info} />
    </svg>
  );
}

function playerStyle(player) {
  if (!player) return undefined;
  return {
    "--player-base": player.colors.base,
    "--player-deep": player.colors.deep,
    "--player-light": player.colors.light,
    "--player-shadow": player.colors.shadow
  };
}

function winnerText(game) {
  const winners = game.players.filter((player) => game.winnerIds.includes(player.id));
  if (winners.length === 0) return "No winner recorded.";
  if (winners.length === 1) return `${winners[0].shortName} wins.`;
  const names = winners.map((player) => player.shortName);
  const last = names.pop();
  return `${names.join(", ")} and ${last} tie.`;
}

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default App;
