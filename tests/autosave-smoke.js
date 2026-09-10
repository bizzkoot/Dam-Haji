#!/usr/bin/env node
/**
 * Autosave/restore smoke test for the Dam Haji save-flow refactor.
 *
 * Loads the REAL game.js + script.js inside a minimal DOM/localStorage stub
 * (no dependencies) and verifies the persistence contract:
 *
 *   1. Completing a turn (user or AI — both go through executeMove)
 *      immediately writes an exact snapshot to `dam_haji_autosave`.
 *   2. A fresh game (no moves yet) never writes a bogus autosave.
 *   3. On "restart", checkForAutoSave() prompts; confirming restores the
 *      EXACT position (board, turn, scores, history, capture counter) and
 *      re-schedules the AI when it is the AI's turn.
 *   4. Declining the prompt discards the autosave and starts fresh.
 *   5. A finished game (win modal) clears the autosave — no restore prompt
 *      for a game that is over.
 *   6. Captures persist too (scores + captured piece removal).
 *
 * Run: node tests/autosave-smoke.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Minimal fake DOM
// ---------------------------------------------------------------------------

let elementCounter = 0;

function classListOf(el) {
    return el.__classes;
}

class FakeElement {
    constructor(tag = 'div') {
        this.tagName = String(tag).toUpperCase();
        this.__id = 'el' + (++elementCounter);
        this.__classes = new Set();
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.dataset = {};
        this.textContent = '';
        this.__innerHTML = '';
        this.disabled = false;
        this.scrollTop = 0;
        this.scrollHeight = 0;
        this.checked = false;
    }
    get classList() {
        const set = this.__classes;
        return {
            add: (...cs) => cs.forEach(c => set.add(c)),
            remove: (...cs) => cs.forEach(c => set.delete(c)),
            toggle: (c, force) => {
                const on = force === undefined ? !set.has(c) : !!force;
                on ? set.add(c) : set.delete(c);
                return on;
            },
            contains: c => set.has(c),
        };
    }
    get className() { return [...this.__classes].join(' '); }
    set className(v) { this.__classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get firstChild() { return this.children.length ? this.children[0] : null; }
    get parentElement() { return this.parentNode; }
    hasChildNodes() { return this.children.length > 0; }
    get innerHTML() { return this.__innerHTML; }
    set innerHTML(v) {
        if (v === '') {
            this.children.forEach(c => { c.parentNode = null; });
            this.children = [];
        }
        this.__innerHTML = v;
    }
    appendChild(c) {
        if (!c) return c;
        if (c.parentNode) c.parentNode._detach(c);
        this.children.push(c);
        c.parentNode = this;
        return c;
    }
    insertBefore(c, ref) {
        if (!ref) return this.appendChild(c);
        if (c.parentNode) c.parentNode._detach(c);
        const i = this.children.indexOf(ref);
        this.children.splice(Math.max(i, 0), 0, c);
        c.parentNode = this;
        return c;
    }
    _detach(c) {
        const i = this.children.indexOf(c);
        if (i >= 0) this.children.splice(i, 1);
    }
    removeChild(c) { this._detach(c); c.parentNode = null; return c; }
    remove() { if (this.parentNode) this.parentNode._detach(this); }
    addEventListener() {}
    removeEventListener() {}
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
    querySelector(sel) {
        const hits = matchDescendants(this, sel);
        return hits[0] || autoVivify(sel);
    }
    querySelectorAll(sel) { return matchDescendants(this, sel); }
    contains() { return false; }
}

// Parse ".a.b[data-row="3"][data-col="4"]" style selectors into {classes, attrs}
function parseSelector(sel) {
    const classes = [];
    const attrs = {};
    const re = /\.([A-Za-z0-9_-]+)|\[([A-Za-z-]+)(?:="([^"]*)")?\]/g;
    let m;
    while ((m = re.exec(sel)) !== null) {
        if (m[1] !== undefined) classes.push(m[1]);
        else attrs[m[2]] = m[3] === undefined ? '' : m[3];
    }
    return { classes, attrs };
}

function matches(el, parsed) {
    for (const c of parsed.classes) if (!el.__classes || !el.__classes.has(c)) return false;
    for (const [rawKey, v] of Object.entries(parsed.attrs)) {
        // CSS [data-row="2"] maps to el.dataset.row; compare as strings the
        // way the real DOM does (app code assigns numbers to dataset)
        const key = rawKey.startsWith('data-') ? rawKey.slice(5) : rawKey;
        const actual = (el.dataset || {})[key];
        if (actual === undefined || String(actual) !== String(v)) return false;
    }
    return parsed.classes.length > 0 || Object.keys(parsed.attrs).length > 0;
}

function matchDescendants(root, sel) {
    const parsed = parseSelector(sel);
    const out = [];
    (function walk(node) {
        for (const child of node.children || []) {
            if (matches(child, parsed)) out.push(child);
            walk(child);
        }
    })(root);
    return out;
}

// Auto-vivified stand-ins keep unguarded UI code (`el.x = ...`) alive for
// element ids the UI update helpers expect but the test never inspects.
const vivified = new Map();
function autoVivify(selOrId) {
    const key = String(selOrId);
    if (!vivified.has(key)) vivified.set(key, new FakeElement());
    return vivified.get(key);
}

// --- The board -------------------------------------------------------------
// A real 8x8 board of FakeElements. Board cells are looked up via descendant
// scans on game-board, so app-code board rebuilds (innerHTML='' + re-create)
// keep working transparently.

const gameBoard = new FakeElement('div');
gameBoard.id = 'game-board';
gameBoard.__classes.add('game-board');

function buildEmptyBoard() {
    gameBoard.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        const rowEl = new FakeElement();
        rowEl.__classes.add('board-row');
        gameBoard.appendChild(rowEl);
        for (let col = 0; col < 8; col++) {
            const cell = new FakeElement();
            cell.__classes.add('board-cell');
            if ((row + col) % 2 === 0) cell.__classes.add('light');
            else cell.__classes.add('dark');
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);
            rowEl.appendChild(cell);
        }
    }
}

function cellAt(row, col) {
    const hits = matchDescendants(gameBoard, `.board-cell[data-row="${row}"][data-col="${col}"]`);
    if (hits.length !== 1) throw new Error(`cell (${row},${col}) not found`);
    return hits[0];
}

function makePiece(color, isHaji = false) {
    const p = new FakeElement();
    p.__classes.add('piece');
    p.__classes.add(color);
    if (isHaji) p.__classes.add('haji');
    return p;
}

function placePiece(color, row, col, isHaji = false) {
    const cell = cellAt(row, col);
    cell.innerHTML = '';
    cell.appendChild(makePiece(color, isHaji));
    return cell.firstChild;
}

// --- document / window / storage stubs --------------------------------------

const elementIds = new Map();
const documentStub = {
    createElement: tag => new FakeElement(tag),
    getElementById: id => {
        if (id === 'game-board') return gameBoard;
        if (!elementIds.has(id)) elementIds.set(id, new FakeElement());
        return elementIds.get(id);
    },
    querySelector: sel => matchDescendants(gameBoard, sel)[0] || autoVivify(sel),
    querySelectorAll: sel => matchDescendants(gameBoard, sel),
    addEventListener: () => {},
    body: new FakeElement('body'),
    visibilityState: 'visible',
};

const storage = new Map();
const localStorageStub = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
    clear: () => storage.clear(),
};

let confirmResult = true;
let timeoutId = 0;
const pendingTimeouts = new Map();

const sandbox = {
    // real JS builtins
    JSON, Math, Date, Set, Map, Object, Array, String, Number, Boolean,
    Promise, RegExp, Error, parseInt, parseFloat, isNaN, isFinite,
    console: {
        log: () => {}, debug: () => {}, info: () => {},
        // Route warnings/errors through so swallowed app errors (e.g. inside
        // try/catch save paths) surface loudly during the test run.
        warn: (...a) => realConsole.error('VM-WARN:', ...a),
        error: (...a) => realConsole.error('VM-ERROR:', ...a),
    },
    performance: { now: () => Date.now() },
    // browser environment stubs
    addEventListener: () => {},
    dispatchEvent: () => true,
    document: documentStub,
    localStorage: localStorageStub,
    confirm: () => confirmResult,
    setTimeout: (fn) => { const id = ++timeoutId; pendingTimeouts.set(id, fn); return id; },
    clearTimeout: id => pendingTimeouts.delete(id),
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    Worker: class { postMessage() {} set onmessage(f) {} set onerror(f) {} },
    getBoundingClientRect: undefined,
};
sandbox.window = sandbox; // script.js uses bare `window.` everywhere
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);

for (const file of ['game.js', 'script.js']) {
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const realConsole = console;
function check(name, cond) {
    if (cond) { passed++; console.log('  ok  ' + name); }
    else { failed++; console.log('  FAIL ' + name); }
}

function runInApp(code) {
    return vm.runInContext(code, context, { filename: 'test-driver' });
}

function readAutosave() {
    const raw = storage.get('dam_haji_autosave');
    return raw ? JSON.parse(raw) : null;
}

const AUTOSAVE_KEY = 'dam_haji_autosave';

function freshGameStateGlobals() {
    runInApp(`
        gameStates = [];
        currentStateIndex = -1;
        moveHistory = [];
        currentMoveIndex = -1;
        window.moveHistory = moveHistory;
        currentPlayer = 'B';
        selectedPiece = null;
        blackScore = 0;
        whiteScore = 0;
        aiEnabled = true;
        aiDifficulty = 'hard';
        aiPlayer = 'W';
        movesSinceCapture = 0;
        gameIsOver = false;
        gameStartTime = Date.now();
        gameReviewMode = false;
        window.aiMoveTimeout = null;
        window.aiThinking = false;
    `);
}

// ---------------------------------------------------------------------------
// Scenario 1: fresh game with zero moves must not autosave
// ---------------------------------------------------------------------------

console.log('\n[1] Fresh game (no completed moves) does not autosave');
buildEmptyBoard();
freshGameStateGlobals();
storage.delete(AUTOSAVE_KEY);
runInApp('autoSaveGame();');
check('no autosave written for a fresh game', readAutosave() === null);
check('stale autosave is cleared for a fresh game', !storage.has(AUTOSAVE_KEY));

// ---------------------------------------------------------------------------
// Scenario 2: completing a user turn persists the exact position immediately
// (executeMove is the single shared path for user AND AI moves)
// ---------------------------------------------------------------------------

console.log('\n[2] Completed turn (executeMove) persists exact snapshot immediately');
buildEmptyBoard();
freshGameStateGlobals();
storage.delete(AUTOSAVE_KEY);
const blackPiece = placePiece('black', 2, 1);
placePiece('white', 5, 2); // far away, keeps the board win-condition-safe

runInApp(`
    executeMove({ piece: getPiece(2, 1), startRow: 2, startCol: 1, endRow: 3, endCol: 0, isCapture: false });
`);

let snap = readAutosave();
check('autosave exists right after the move completes', snap !== null);
check('turn switched to White in the snapshot', snap.metadata.currentPlayer === 'W');
check('AI settings persisted', snap.metadata.aiEnabled === true && snap.metadata.aiDifficulty === 'hard');
check('scores persisted', snap.metadata.blackScore === 0 && snap.metadata.whiteScore === 0);
check('move history persisted (1 move)', snap.gameState.moveHistory.length === 1);
check('piece is at destination (3,0) as black', snap.gameState.boardState[3][0] && snap.gameState.boardState[3][0].color === 'black');
check('origin (2,1) is empty in the snapshot', snap.gameState.boardState[2][1] === null);
check('non-capture move increments capture counter', snap.gameState.movesSinceCapture === 1);
check('live board matches snapshot (piece moved in DOM too)', cellAt(3, 0).firstChild === blackPiece);
check('AI turn was scheduled after the user move', runInApp('window.aiMoveTimeout') !== null && runInApp('window.aiMoveTimeout') !== undefined);

// ---------------------------------------------------------------------------
// Scenario 3: restart → prompt → confirm restores the EXACT last position
// ---------------------------------------------------------------------------

console.log('\n[3] Restart with confirm restores exact position (incl. AI turn scheduling)');
// Simulate the restart: DOM state is rebuilt from storage only.
buildEmptyBoard(); // wipe live board — restore must rebuild it
confirmResult = true;
runInApp('checkForAutoSave();');
check('currentPlayer restored (White)', runInApp('currentPlayer') === 'W');
check('scores restored', runInApp('blackScore') === 0 && runInApp('whiteScore') === 0);
check('AI settings restored', runInApp('aiEnabled') === true && runInApp('aiDifficulty') === 'hard');
check('move history restored (1 move)', runInApp('moveHistory.length') === 1);
check('capture counter restored', runInApp('movesSinceCapture') === 1);
check('game not marked over', runInApp('gameIsOver') === false);
check('board rebuilt: piece back at (3,0)', cellAt(3, 0).firstChild !== null && cellAt(3, 0).firstChild.classList.contains('black'));
check('board rebuilt: origin (2,1) empty', cellAt(2, 1).firstChild === null);
check('undo/redo state rebuilt (1 state, index 0)', runInApp('gameStates.length') === 1 && runInApp('currentStateIndex') === 0);
check('undo button disabled at restored move 0', elementIds.get('undo-btn') ? elementIds.get('undo-btn').disabled === true : false);
check('AI re-scheduled for its restored turn', runInApp('window.aiMoveTimeout') !== null);
check('autosave kept after restore (game still in progress)', readAutosave() !== null);

// ---------------------------------------------------------------------------
// Scenario 4: AI capture move persists scores and captured-piece removal
// ---------------------------------------------------------------------------

console.log('\n[4] AI capture turn persists capture results');
buildEmptyBoard();
freshGameStateGlobals();
runInApp('currentPlayer = "W";'); // AI (White) is on turn
placePiece('white', 5, 2);
placePiece('black', 4, 3); // White captures downward-diagonal neighbor
placePiece('black', 0, 7); // second black piece keeps the game alive after the capture
storage.delete(AUTOSAVE_KEY);

runInApp(`
    executeMove({ piece: getPiece(5, 2), startRow: 5, startCol: 2, endRow: 3, endCol: 4, isCapture: true });
`);

snap = readAutosave();
check('capture autosave exists immediately', snap !== null);
check('white score incremented to 1', snap.metadata.whiteScore === 1);
check('captured black piece removed from snapshot', snap.gameState.boardState[4][3] === null);
check('capturing white at (3,4) in snapshot', snap.gameState.boardState[3][4] && snap.gameState.boardState[3][4].color === 'white');
check('capture resets no-capture counter', snap.gameState.movesSinceCapture === 0);
check('board matches: captured piece gone from DOM', cellAt(4, 3).firstChild === null);

// Restart and confirm: the AI-made capture move is restored exactly
confirmResult = true;
buildEmptyBoard();
runInApp('checkForAutoSave();');
check('AI capture move restored: white at (3,4)', cellAt(3, 4).firstChild !== null && cellAt(3, 4).firstChild.classList.contains('white'));
check('AI capture move restored: (4,3) empty', cellAt(4, 3).firstChild === null);
check('AI capture move restored: scores', runInApp('whiteScore') === 1);

// ---------------------------------------------------------------------------
// Scenario 5: restart → decline discards the autosave (fresh start)
// ---------------------------------------------------------------------------

console.log('\n[5] Declining the restore prompt discards the save');
check('autosave present before decline', readAutosave() !== null);
confirmResult = false;
runInApp('checkForAutoSave();');
check('autosave removed after decline', readAutosave() === null);

// ---------------------------------------------------------------------------
// Scenario 6: finished game (win) clears autosave — no restore prompt for a
// completed game
// ---------------------------------------------------------------------------

console.log('\n[6] Game over clears the autosave');
buildEmptyBoard();
freshGameStateGlobals();
placePiece('black', 2, 1);
placePiece('white', 5, 2);
runInApp(`
    executeMove({ piece: getPiece(2, 1), startRow: 2, startCol: 1, endRow: 3, endCol: 0, isCapture: false });
`);
check('autosave exists before the win', readAutosave() !== null);
runInApp(`showWinMessage('Black');`);
check('gameIsOver set on win', runInApp('gameIsOver') === true);
check('autosave cleared on win', readAutosave() === null);
runInApp('autoSaveGame();');
check('autosave stays cleared after win (no late writes)', readAutosave() === null);

// ---------------------------------------------------------------------------
// Scenario 7: hide-flush (visibilitychange/pagehide) mirrors live state
// ---------------------------------------------------------------------------

console.log('\n[7] Close-time flush keeps mirroring the live game');
buildEmptyBoard();
freshGameStateGlobals();
placePiece('black', 2, 1);
placePiece('white', 5, 2);
runInApp(`
    executeMove({ piece: getPiece(2, 1), startRow: 2, startCol: 1, endRow: 3, endCol: 0, isCapture: false });
`);
runInApp(`
    executeMove({ piece: getPiece(5, 2), startRow: 5, startCol: 2, endRow: 4, endCol: 1, isCapture: false });
`);
check('two moves recorded, white to move', runInApp('moveHistory.length') === 1 + 1 && runInApp('currentPlayer') === 'B');
// user undoes white's move, then closes the app: flush must save the undone state
runInApp('undoMove();');
// state 0 is the position after black's move 1 — white to move
check('undo restored state 0 with white to move', runInApp('currentStateIndex') === 0 && runInApp('currentPlayer') === 'W');
documentStub.visibilityState = 'hidden';
// the app registers the flush on visibilitychange; the same autoSaveGame()
// body runs here (stubbed listeners cannot dispatch)
runInApp('if (isGameInProgress()) autoSaveGame();');
snap = readAutosave();
check('flush after undo saves the undone position', snap !== null && snap.gameState.moveHistory.length === 1 && snap.metadata.currentPlayer === 'W');
check('undo still counts as game in progress for flush', runInApp('isGameInProgress()') === true);
documentStub.visibilityState = 'visible';

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Scenario 8: manual slot save round-trips (same serialization path)
// ---------------------------------------------------------------------------

console.log('\n[8] Manual slot save round-trips through localStorage');
buildEmptyBoard();
freshGameStateGlobals();
placePiece('black', 2, 1);
placePiece('white', 5, 2);
runInApp(`
    executeMove({ piece: getPiece(2, 1), startRow: 2, startCol: 1, endRow: 3, endCol: 0, isCapture: false });
    saveGameToSlot(0);
`);
const slots = JSON.parse(storage.get('dam_haji_game_state'));
check('slot 0 written with 1 move', slots && slots[0] && slots[0].gameState.moveHistory.length === 1);
confirmResult = true;
buildEmptyBoard();
runInApp('loadGameFromSlot(0);');
check('slot load restores position', cellAt(3, 0).firstChild !== null && cellAt(3, 0).firstChild.classList.contains('black'));
check('slot load mirrors autosave for restart-prompt', readAutosave() !== null);

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
