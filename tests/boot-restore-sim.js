#!/usr/bin/env node
/**
 * Cold-boot restore simulation.
 *
 * Reproduces the REAL page boot order with ALL app scripts loaded
 * (game, ai, script, ui-v2, integration-v2, notifications, menu-system,
 * settings-system, history-system), DOMContentLoaded before load, exactly
 * like index.html does.
 *
 * Session A: fresh install, play a user move + an AI move (both flow
 *            through executeMove), then "close the app".
 * Session B: fresh JS realm (cold start), SAME localStorage, full boot.
 *            checkForAutoSave() must prompt; confirming must restore the
 *            exact played position.
 *
 * Run: node tests/boot-restore-sim.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP_SCRIPTS = ['game.js', 'ai.js', 'script.js', 'ui-v2.js', 'integration-v2.js', 'notifications.js', 'menu-system.js', 'settings-system.js', 'history-system.js'];
const AUTOSAVE_KEY = 'dam_haji_autosave';

// ---------------------------------------------------------------------------
// Fake DOM (element tree + board + listener capture)
// ---------------------------------------------------------------------------

class FakeElement {
    constructor(tag = 'div') {
        this.tagName = String(tag).toUpperCase();
        this.__classes = new Set();
        this.children = [];
        this.parentNode = null;
        this.style = { setProperty: () => {}, removeProperty: () => {}, getPropertyValue: () => '' };
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

const vivified = new Map();
function autoVivify(selOrId) {
    const key = String(selOrId);
    if (!vivified.has(key)) vivified.set(key, new FakeElement());
    return vivified.get(key);
}

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

function placePiece(color, row, col) {
    const cell = cellAt(row, col);
    cell.innerHTML = '';
    const p = new FakeElement();
    p.__classes.add('piece');
    p.__classes.add(color);
    cell.appendChild(p);
    return p;
}

// ---------------------------------------------------------------------------
// Sandbox/session machinery
// ---------------------------------------------------------------------------

const realConsole = console;
const APP_CONTEXT_KEYS = ['currentPlayer', 'gameStates', 'moveHistory'];

function createSession(storageObj, options = {}) {
    const elementIds = new Map();
    const docListeners = {};
    const winListeners = {};
    const pendingTimeouts = new Map();
    let timeoutId = 0;

    const documentStub = {
        createElement: tag => new FakeElement(tag),
        getElementById: id => {
            if (id === 'game-board') return gameBoard;
            if (!elementIds.has(id)) elementIds.set(id, new FakeElement());
            return elementIds.get(id);
        },
        querySelector: sel => matchDescendants(gameBoard, sel)[0] || autoVivify(sel),
        querySelectorAll: sel => matchDescendants(gameBoard, sel),
        addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
        removeEventListener: () => {},
        dispatchEvent: () => true,
        head: new FakeElement('head'),
        documentElement: new FakeElement('html'),
        body: new FakeElement('body'),
        visibilityState: 'visible',
    };

    const localStorageStub = {
        getItem: k => (k in storageObj ? storageObj[k] : null),
        setItem: (k, v) => { storageObj[k] = String(v); },
        removeItem: k => { delete storageObj[k]; },
    };

    const sandbox = {
        JSON, Math, Date, Set, Map, Object, Array, String, Number, Boolean,
        Promise, RegExp, Error, parseInt, parseFloat, isNaN, isFinite,
        console: {
            log: () => {}, debug: () => {}, info: () => {},
            warn: (...a) => realConsole.error('VM-WARN:', ...a),
            error: (...a) => realConsole.error('VM-ERROR:', ...a),
        },
        performance: { now: () => Date.now() },
        addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
        dispatchEvent: () => true,
        document: documentStub,
        localStorage: localStorageStub,
        confirm: () => (options.confirmResult !== undefined ? options.confirmResult : true),
        setTimeout: (fn) => { const id = ++timeoutId; pendingTimeouts.set(id, fn); return id; },
        clearTimeout: id => pendingTimeouts.delete(id),
        setInterval: () => 0,
        clearInterval: () => {},
        requestAnimationFrame: () => 0,
        matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
        getComputedStyle: () => ({ getPropertyValue: () => '', setProperty: () => {} }),
        ResizeObserver: class { observe() {} disconnect() {} },
        IntersectionObserver: class { observe() {} disconnect() {} },
        navigator: { serviceWorker: { register: async () => ({}) } },
        CustomEvent: class { constructor(type, opts) { this.type = type; Object.assign(this, opts); } },
        Event: class { constructor(type) { this.type = type; } },
        Worker: class { postMessage() {} set onmessage(f) {} set onerror(f) {} },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);
    for (const file of APP_SCRIPTS) {
        const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
        vm.runInContext(code, context, { filename: file });
    }

    function runInApp(code) {
        return vm.runInContext(code, context, { filename: 'sim-driver' });
    }

    function fireDOMContentLoaded() {
        (docListeners['DOMContentLoaded'] || []).forEach(fn => fn());
    }
    function fireLoad() {
        (winListeners['load'] || []).forEach(fn => fn());
    }

    return { runInApp, fireDOMContentLoaded, fireLoad, storageObj, pendingTimeouts, elementIds };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
function check(name, cond) {
    if (cond) { passed++; console.log('  ok  ' + name); }
    else { failed++; console.log('  FAIL ' + name); }
}

function readAutosave(storageObj) {
    const raw = storageObj[AUTOSAVE_KEY];
    return raw ? JSON.parse(raw) : null;
}

// ---------------------------------------------------------------------------
// Session A: fresh install, play user + AI moves, "close the app"
// ---------------------------------------------------------------------------

console.log('\n[Session A] fresh install: boot, play user + AI moves');
const storageA = {};
const sessionA = createSession(storageA);
// Board write tracer — installed once, captures BOTH sessions
const __boardDesc = Object.getOwnPropertyDescriptor(FakeElement.prototype, 'innerHTML');
Object.defineProperty(gameBoard, 'innerHTML', {
    get() { return __boardDesc.get.call(gameBoard); },
    set(v) {
        if (v === '') {
            realConsole.log('  [board-clear] pieces before: ' + matchDescendants(gameBoard, '.piece').length
                + ' | caller: ' + ((new Error().stack.split('\n')[2] || '?').trim()));
        }
        __boardDesc.set.call(gameBoard, v);
    }
});
buildEmptyBoard();
sessionA.fireDOMContentLoaded();
sessionA.fireLoad();

placePiece('black', 2, 1);
placePiece('white', 5, 2);

// user move: black (2,1) -> (3,0)
sessionA.runInApp(`
    executeMove({ piece: getPiece(2, 1), startRow: 2, startCol: 1, endRow: 3, endCol: 0, isCapture: false });
`);
check('user move reflected on board', cellAt(3, 0).firstChild !== null);
check('autosave written after user move', readAutosave(storageA) !== null);

// AI move (white): (5,2) -> (4,1) — the exact moment the tester backgrounded
sessionA.runInApp(`
    executeMove({ piece: getPiece(5, 2), startRow: 5, startCol: 2, endRow: 4, endCol: 1, isCapture: false });
`);
const snapA = readAutosave(storageA);
check('autosave exists after AI move', snapA !== null);
check('snapshot has 2 moves', snapA.gameState.moveHistory.length === 2);
check('snapshot: black at (3,0)', snapA.gameState.boardState[3][0] && snapA.gameState.boardState[3][0].color === 'black');
check('snapshot: white at (4,1)', snapA.gameState.boardState[4][1] && snapA.gameState.boardState[4][1].color === 'white');
check('snapshot: black to move', snapA.metadata.currentPlayer === 'B');

// ---------------------------------------------------------------------------
// Session B: force-closed and relaunched — cold start, same storage
// ---------------------------------------------------------------------------

console.log('\n[Session B] relaunch (cold boot): confirm restore');
const storageB = JSON.parse(JSON.stringify(storageA)); // OS-persisted storage
buildEmptyBoard(); // fresh page: empty board before scripts run
const sessionB = createSession(storageB, { confirmResult: true });
// Trace every board re-init and state save with its caller
sessionB.runInApp(`
    window.__initLog = [];
    window.__saveLog = [];
    const __origInit = initializeBoard;
    initializeBoard = function(board) {
        window.__initLog.push((new Error().stack.split(String.fromCharCode(10))[2] || '?').trim());
        return __origInit(board);
    };
    const __origSave = saveGameState;
    saveGameState = function() {
        window.__saveLog.push((new Error().stack.split(String.fromCharCode(10))[2] || '?').trim());
        return __origSave();
    };
    const __origExec = executeMove;
    window.__execLog = [];
    executeMove = function(move) {
        window.__execLog.push('executeMove ' + move.startRow + ',' + move.startCol + ' -> ' + move.endRow + ',' + move.endCol + ' from: ' + (new Error().stack.split(String.fromCharCode(10))[2] || '?').trim());
        return __origExec(move);
    };
`);

// Real boot order: DOMContentLoaded handlers (ui-v2, integration-v2) fire
// BEFORE the window load handler (script.js init + checkForAutoSave).
sessionB.fireDOMContentLoaded();
console.log('  [after DOMContentLoaded] pieces:', matchDescendants(gameBoard, '.piece').length, 'rows:', gameBoard.children.length);
sessionB.fireLoad();
console.log('  [after load] pieces:', matchDescendants(gameBoard, '.piece').length, 'rows:', gameBoard.children.length, 'cells:', (() => { let c = 0; gameBoard.children.forEach(r => c += r.children.length); return c; })());

console.log('  [trace] initializeBoard calls:');
sessionB.runInApp('window.__initLog').forEach(l => console.log('    ', l));
console.log('  [trace] saveGameState calls:');
sessionB.runInApp('window.__saveLog').forEach(l => console.log('    ', l));
console.log('  [trace] executeMove calls:');
sessionB.runInApp('window.__execLog').forEach(l => console.log('    ', l));

check('restore prompt appeared and was confirmed — autosave still present', readAutosave(storageB) !== null);
check('turn restored: black to move', sessionB.runInApp('currentPlayer') === 'B');
check('scores restored', sessionB.runInApp('blackScore') === 0 && sessionB.runInApp('whiteScore') === 0);
check('move history restored (2 moves)', sessionB.runInApp('moveHistory.length') === 2);
check('RESTORED BOARD: black at (3,0)', cellAt(3, 0).firstChild !== null && cellAt(3, 0).firstChild.classList.contains('black'));
check('RESTORED BOARD: white at (4,1)', cellAt(4, 1).firstChild !== null && cellAt(4, 1).firstChild.classList.contains('white'));
check('RESTORED BOARD: origin (2,1) empty', cellAt(2, 1).firstChild === null);
check('RESTORED BOARD: origin (5,2) empty', cellAt(5, 2).firstChild === null);
// 24 pieces: a non-capture move relocates pieces, it never removes them.
check('all 24 pieces present (two relocated, none captured)', matchDescendants(gameBoard, '.piece').length === 24);
check('no extra start-board rebuild happened (8 rows)', gameBoard.children.length === 8);

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
