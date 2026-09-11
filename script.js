const BOARD_SIZE = 8;
const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const resetButton = document.getElementById("reset");
const aiLevelSelect = document.getElementById("aiLevel");

let aiTimer = null;
let state = createInitialState();

function createInitialState() {
  return {
    board: createInitialBoard(),
    turn: "black",
    selected: null,
    legalMoves: [],
    winner: null,
    aiLevel: Number(aiLevelSelect?.value ?? 1),
  };
}

function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isDarkSquare(row, col)) {
        board[row][col] = { color: "black", king: false };
      }
    }
  }

  for (let row = 5; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isDarkSquare(row, col)) {
        board[row][col] = { color: "red", king: false };
      }
    }
  }

  return board;
}

function getAiSearchDepth(level) {
  if (level <= 1) {
    return 0;
  }

  if (level <= 3) {
    return 1;
  }

  if (level <= 5) {
    return 2;
  }

  if (level <= 7) {
    return 3;
  }

  if (level <= 9) {
    return 4;
  }

  return 5;
}

function evaluateBoard(board) {
  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }

      const value = piece.king ? 4 : 1;
      const advancement = piece.color === "black" ? BOARD_SIZE - 1 - row : row;
      const advancementBonus = advancement * 0.4;

      score += piece.color === "black" ? value + advancementBonus : -(value + advancementBonus);
    }
  }

  const blackMoves = getLegalMoves(board, "black").length;
  const redMoves = getLegalMoves(board, "red").length;

  score += (blackMoves - redMoves) * 0.75;

  return score;
}

function minimax(board, turn, depth, alpha, beta) {
  const legalMoves = getLegalMoves(board, turn);

  if (depth === 0 || legalMoves.length === 0) {
    if (legalMoves.length === 0) {
      return turn === "black" ? -100000 + depth : 100000 - depth;
    }

    return evaluateBoard(board);
  }

  if (turn === "black") {
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      const score = minimax(move.board, "red", depth - 1, alpha, beta);
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, bestScore);

      if (beta <= alpha) {
        break;
      }
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const move of legalMoves) {
    const score = minimax(move.board, "black", depth - 1, alpha, beta);
    bestScore = Math.min(bestScore, score);
    beta = Math.min(beta, bestScore);

    if (beta <= alpha) {
      break;
    }
  }

  return bestScore;
}

function chooseAiMove(board, level) {
  const legalMoves = getLegalMoves(board, "black");

  if (legalMoves.length === 0) {
    return null;
  }

  if (level <= 1) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const depth = getAiSearchDepth(level);

  if (level <= 2) {
    const scoredMoves = legalMoves.map((move) => ({
      move,
      score: evaluateBoard(move.board),
    }));

    const bestScore = Math.max(...scoredMoves.map(({ score }) => score));
    const topMoves = scoredMoves.filter(({ score }) => score === bestScore);
    return topMoves[Math.floor(Math.random() * topMoves.length)].move;
  }

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  for (const move of legalMoves) {
    const score = minimax(move.board, "red", depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function scheduleAiTurn() {
  if (aiTimer) {
    clearTimeout(aiTimer);
  }

  if (state.turn !== "black" || state.winner) {
    return;
  }

  aiTimer = setTimeout(() => {
    const move = chooseAiMove(state.board, state.aiLevel);

    if (move) {
      applyMove(move);
      return;
    }

    state.winner = "red";
    render();
  }, 300);
}

function isDarkSquare(row, col) {
  return (row + col) % 2 === 1;
}

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function isPieceAt(board, row, col) {
  return !!board[row][col];
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function getDirections(piece) {
  if (piece.king) {
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
  }

  return piece.color === "black"
    ? [
        [1, 1],
        [1, -1],
      ]
    : [
        [-1, 1],
        [-1, -1],
      ];
}

function getCaptureSequences(board, row, col, piece) {
  const sequences = [];

  for (const [deltaRow, deltaCol] of getDirections(piece)) {
    const middleRow = row + deltaRow;
    const middleCol = col + deltaCol;
    const landingRow = row + deltaRow * 2;
    const landingCol = col + deltaCol * 2;

    if (
      isInside(landingRow, landingCol) &&
      board[middleRow] &&
      board[middleRow][middleCol] &&
      board[middleRow][middleCol].color !== piece.color &&
      !board[landingRow][landingCol]
    ) {
      const nextBoard = cloneBoard(board);
      const movingPiece = { ...nextBoard[row][col] };

      nextBoard[row][col] = null;
      nextBoard[middleRow][middleCol] = null;

      const promotedPiece = { ...movingPiece };
      if (promotedPiece.color === "black" && landingRow === BOARD_SIZE - 1) {
        promotedPiece.king = true;
      }
      if (promotedPiece.color === "red" && landingRow === 0) {
        promotedPiece.king = true;
      }

      nextBoard[landingRow][landingCol] = promotedPiece;

      sequences.push({
        from: { row, col },
        to: { row: landingRow, col: landingCol },
        captures: [{ row: middleRow, col: middleCol }],
        board: nextBoard,
        path: [
          { row, col },
          { row: landingRow, col: landingCol },
        ],
      });
    }
  }

  return sequences;
}

function getSimpleMoves(board, row, col, piece) {
  const moves = [];

  for (const [deltaRow, deltaCol] of getDirections(piece)) {
    const nextRow = row + deltaRow;
    const nextCol = col + deltaCol;

    if (isInside(nextRow, nextCol) && !board[nextRow][nextCol]) {
      const nextBoard = cloneBoard(board);
      const movingPiece = { ...nextBoard[row][col] };
      nextBoard[row][col] = null;

      if (movingPiece.color === "black" && nextRow === BOARD_SIZE - 1) {
        movingPiece.king = true;
      }
      if (movingPiece.color === "red" && nextRow === 0) {
        movingPiece.king = true;
      }

      nextBoard[nextRow][nextCol] = movingPiece;

      moves.push({
        from: { row, col },
        to: { row: nextRow, col: nextCol },
        captures: [],
        board: nextBoard,
        path: [
          { row, col },
          { row: nextRow, col: nextCol },
        ],
      });
    }

    const skippedRow = row + deltaRow * 2;
    const skippedCol = col + deltaCol * 2;

    if (
      isInside(skippedRow, skippedCol) &&
      !board[skippedRow][skippedCol] &&
      board[nextRow] &&
      board[nextRow][nextCol] &&
      board[nextRow][nextCol].color === piece.color
    ) {
      const nextBoard = cloneBoard(board);
      const movingPiece = { ...nextBoard[row][col] };
      nextBoard[row][col] = null;

      if (movingPiece.color === "black" && skippedRow === BOARD_SIZE - 1) {
        movingPiece.king = true;
      }
      if (movingPiece.color === "red" && skippedRow === 0) {
        movingPiece.king = true;
      }

      nextBoard[skippedRow][skippedCol] = movingPiece;

      moves.push({
        from: { row, col },
        to: { row: skippedRow, col: skippedCol },
        captures: [],
        board: nextBoard,
        path: [
          { row, col },
          { row: skippedRow, col: skippedCol },
        ],
      });
    }
  }

  return moves;
}

function findForcedCaptureMoves(board, turn) {
  const forcedMoves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === turn) {
        forcedMoves.push(...getCaptureSequences(board, row, col, piece));
      }
    }
  }

  return forcedMoves;
}

function getMovesForPiece(row, col, piece) {
  if (!piece) {
    return [];
  }

  const captureMoves = getCaptureSequences(state.board, row, col, piece);
  const simpleMoves = getSimpleMoves(state.board, row, col, piece);

  return [...captureMoves, ...simpleMoves];
}

function getLegalMoves(board, color) {
  const moves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        moves.push(...getCaptureSequences(board, row, col, piece));
        moves.push(...getSimpleMoves(board, row, col, piece));
      }
    }
  }

  return moves;
}

function applyMove(move) {
  state.board = move.board;
  state.selected = null;
  state.legalMoves = [];

  const opponent = state.turn === "black" ? "red" : "black";

  if (!hasAnyMoves(state.board, opponent)) {
    state.winner = state.turn;
  } else {
    state.turn = opponent;
  }

  render();

  if (state.turn === "black" && !state.winner) {
    scheduleAiTurn();
  }
}

function hasAnyMoves(board, color) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const forcedMoves = findForcedCaptureMoves(board, color);

        if (forcedMoves.length > 0) {
          return true;
        }

        if (getSimpleMoves(board, row, col, piece).length > 0) {
          return true;
        }
      }
    }
  }

  return false;
}

function render() {
  if (aiLevelSelect) {
    aiLevelSelect.value = String(state.aiLevel);
  }

  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${isDarkSquare(row, col) ? "dark" : "light"}`;
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      if (state.selected && state.selected.row === row && state.selected.col === col) {
        square.classList.add("selected");
      }

      const moveTarget = state.legalMoves.find(
        (move) => move.to.row === row && move.to.col === col
      );
      if (moveTarget) {
        square.classList.add("legal");
      }

      const piece = state.board[row][col];
      if (piece) {
        const pieceElement = document.createElement("div");
        pieceElement.className = `piece ${piece.color} ${piece.king ? "king" : ""}`;
        pieceElement.textContent = "";
        square.appendChild(pieceElement);
      }

      boardElement.appendChild(square);
    }
  }

  if (state.winner) {
    const winnerName = state.winner === "black" ? "黒" : "赤";
    statusElement.textContent = `${winnerName}の勝ちです。`;
  } else {
    const turnName = state.turn === "black" ? "黒" : "赤";
    const suffix = state.turn === "black" ? `（CPU Lv.${state.aiLevel}）` : "";
    statusElement.textContent = `${turnName}の番です${suffix}`;
  }
}

boardElement.addEventListener("click", (event) => {
  const square = event.target.closest(".square");
  if (!square) {
    return;
  }

  const row = Number(square.dataset.row);
  const col = Number(square.dataset.col);

  if (state.winner || state.turn === "black") {
    return;
  }

  const piece = state.board[row][col];

  if (piece && piece.color === state.turn) {
    const candidateMoves = getMovesForPiece(row, col, piece);

    if (candidateMoves.length > 0) {
      state.selected = { row, col };
      state.legalMoves = candidateMoves;
      render();
      return;
    }
  }

  if (!state.selected) {
    return;
  }

  const matchingMove = state.legalMoves.find(
    (move) => move.to.row === row && move.to.col === col
  );

  if (matchingMove) {
    applyMove(matchingMove);
    return;
  }

  if (piece && piece.color === state.turn) {
    const candidateMoves = getMovesForPiece(row, col, piece);
    if (candidateMoves.length > 0) {
      state.selected = { row, col };
      state.legalMoves = candidateMoves;
      render();
    }
  }
});

if (aiLevelSelect) {
  aiLevelSelect.addEventListener("change", () => {
    state.aiLevel = Number(aiLevelSelect.value);
    scheduleAiTurn();
  });
}

resetButton.addEventListener("click", () => {
  state = createInitialState();
  render();
  scheduleAiTurn();
});

render();
scheduleAiTurn();
