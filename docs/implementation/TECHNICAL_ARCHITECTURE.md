# Dam Haji Game - Technical Architecture

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Architecture                    │
├─────────────────────────────────────────────────────────────┤
│  User Interface Layer                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   HTML5     │ │    CSS3     │ │ JavaScript  │          │
│  │  Structure  │ │   Styling   │ │   Logic     │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Modular JavaScript Systems                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ ui-v2.js    │ │menu-system  │ │notifications│          │
│  │ (Main UI)   │ │   .js       │ │   .js       │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │settings-    │ │history-     │ │enhanced-    │          │
│  │system.js    │ │system.js    │ │integration  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           integration-v2.js                            │ │
│  │         (Bridge between old & new)                     │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Core Game Engine                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  script.js  │ │   game.js   │ │    ai.js    │          │
│  │ (Main Game) │ │   (Rules)   │ │   (AI)      │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Organization

### **Core Files**
- `index.html` - Main application structure
- `style.css` - Complete styling and responsive design
- `manifest.json` - PWA configuration
- `service-worker.js` - Offline support

### **Game Logic Layer**
- `script.js` - Main game controller and state management
- `game.js` - Game rules, mechanics, and board logic
- `ai.js` - AI decision engine with minimax algorithm

### **Modern UI Layer**
- `ui-v2.js` - Modern UI controller and event handling
- `integration-v2.js` - Bridge between legacy and modern systems

### **Modular Systems**
- `menu-system.js` - Slide-out menu management
- `settings-system.js` - Game configuration panel
- `history-system.js` - Move tracking and navigation
- `notifications.js` - Toast notification system
- `enhanced-integration.js` - System coordination hub

## 🔄 Data Flow Architecture

```
User Interaction
       ↓
┌─────────────────┐
│   UI Events     │ (click, touch, keyboard)
│   (ui-v2.js)    │
└─────────────────┘
       ↓
┌─────────────────┐
│  Integration    │ (event processing, validation)
│ (integration-   │
│    v2.js)       │
└─────────────────┘
       ↓
┌─────────────────┐
│  Game Logic     │ (move validation, state update)
│  (script.js)    │
└─────────────────┘
       ↓
┌─────────────────┐
│  Game Engine    │ (rule enforcement, win detection)
│   (game.js)     │
└─────────────────┘
       ↓
┌─────────────────┐
│   AI Engine     │ (if AI turn, compute best move)
│    (ai.js)      │
└─────────────────┘
       ↓
┌─────────────────┐
│  State Update   │ (update DOM, notify systems)
│  (ui-v2.js)     │
└─────────────────┘
       ↓
┌─────────────────┐
│ Visual Feedback │ (animations, notifications)
│  (CSS + JS)     │
└─────────────────┘
```

## 🧩 Component Architecture

### **1. ModernUI Class (ui-v2.js)**
```javascript
class ModernUI {
  constructor() {
    this.notifications = [];
    this.initializeEventListeners();
    this.setupNotifications();
  }
  
  // Core Methods
  initializeEventListeners()    // Setup button/input handlers
  updateGameBoard()            // Sync board with game state
  addRecentMove(num, desc)     // Update move history display
  showNotification(msg, type)  // Display user feedback
  toggleAI(enabled)           // Handle AI on/off
  handleUndo()                // Process undo requests
  handleRedo()                // Process redo requests
}
```

### **2. GameIntegration Class (integration-v2.js)**
```javascript
class GameIntegration {
  constructor(modernUI) {
    this.modernUI = modernUI;
    this.connectGameControls();
    this.overrideGameFunctions();
  }
  
  // Integration Methods
  connectGameControls()        // Bridge old/new button handlers
  overrideGameFunctions()      // Wrap legacy functions with V2 UI
  formatMoveForV2(move)       // Convert move data to display format
  initializeGameBoard()       // Setup board with V2 styling
}
```

### **3. MenuSystem Class (menu-system.js)**
```javascript
class MenuSystem {
  constructor() {
    this.activePanel = null;
    this.overlay = document.getElementById('overlay');
    this.initializeEventListeners();
  }
  
  // Panel Management
  openPanel(panelId)          // Show slide-out panel
  closePanel(panelId)         // Hide slide-out panel
  togglePanel(panelId)        // Toggle panel visibility
  handleMenuAction(action)    // Process menu selections
}
```

### **4. NotificationSystem Class (notifications.js)**
```javascript
class NotificationSystem {
  constructor() {
    this.container = this.createContainer();
    this.notifications = new Map();
  }
  
  // Notification Methods
  show(message, type, duration) // Display toast message
  dismiss(id)                   // Remove specific notification
  clear()                      // Remove all notifications
  createNotification(msg, type) // Build notification DOM
}
```

## 📱 Responsive Design System

### **CSS Grid Layout Strategy**
```css
/* Desktop Layout */
#app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "nav"
    "main"  
    "actions";
  height: 100vh;
}

#game-area {
  display: grid;
  grid-template-columns: 1fr 300px;
  grid-template-areas: "board info";
  gap: 1rem;
}

/* Tablet Adaptation */
@media (max-width: 1024px) {
  #game-area {
    grid-template-columns: 1fr 250px;
  }
}

/* Mobile Transformation */
@media (max-width: 768px) {
  #game-area {
    grid-template-columns: 1fr;
    grid-template-areas: "board";
  }
  
  #info-panel {
    display: none;
  }
  
  .slide-panel {
    width: 100vw;
    right: -100vw;
  }
}
```

### **Breakpoint Strategy**
- **Large Desktop:** `>1200px` - Full layout with spacious panels
- **Desktop:** `1024px-1200px` - Standard layout
- **Tablet:** `768px-1024px` - Compressed panels, larger touch targets
- **Mobile:** `<768px` - Single column, slide-out panels

## 🎮 Game State Management

### **State Structure**
```javascript
const gameStates = [
  {
    board: Array(8).fill().map(() => Array(8).fill(null)),
    currentPlayer: "B",
    scores: { blackScore: 0, whiteScore: 0 },
    moveHistory: [],
    movesSinceCapture: 0,
    timestamp: Date.now()
  }
];

let currentStateIndex = 0;
const MAX_STATES = 100; // Memory management
```

### **Undo/Redo System**
```javascript
function saveGameState() {
  // Remove future states
  gameStates = gameStates.slice(0, currentStateIndex + 1);
  
  // Create new state
  const newState = new GameState(
    null, 
    currentPlayer, 
    { blackScore, whiteScore }, 
    moveHistory
  );
  
  gameStates.push(newState);
  currentStateIndex = gameStates.length - 1;
  
  // Memory management
  if (gameStates.length > MAX_STATES) {
    gameStates.shift();
    currentStateIndex--;
  }
}

function undoMove() {
  if (currentStateIndex > 0) {
    currentStateIndex--;
    restoreGameState(currentStateIndex);
    // Update all UI systems
    updateCurrentPlayerDisplay();
    updateScore();
    updateMoveHistoryDisplay();
    updateUndoRedoButtons();
    return true;
  }
  return false;
}
```

## 🤖 AI System Architecture

### **AI Decision Engine Flow**
```
makeAIMove()
    ↓
findBestMove(difficulty)
    ↓
iterativeDeepening()
    ↓
searchAtDepth(depth)
    ↓
minimax(board, depth, maximizing, α, β)
    ↓
evaluateBoard(board, player)
    ↓
Return best move
```

### **Difficulty Scaling**
```javascript
function getDynamicDepth(difficulty, gamePhase, board, player) {
  const baseDifficulty = {
    'easy': { opening: 3, midgame: 3, endgame: 4 },
    'medium': { opening: 4, midgame: 5, endgame: 6 },
    'hard': { opening: 5, midgame: 6, endgame: 7 }
  };
  
  return baseDifficulty[difficulty][gamePhase];
}
```

### **Performance Optimizations**
- **Alpha-Beta Pruning:** Reduces search space by ~50%
- **Move Ordering:** Prioritizes captures and central moves
- **Iterative Deepening:** Time-controlled search depth
- **Position Evaluation:** Weighted piece values and board control

## 🔧 Event System Architecture

### **Event Flow Hierarchy**
```
DOM Event (click/touch)
    ↓
UI Event Handler (ui-v2.js)
    ↓
Integration Bridge (integration-v2.js)
    ↓
Core Game Logic (script.js)
    ↓
Game Rule Engine (game.js)
    ↓
State Update
    ↓
UI Refresh (ui-v2.js)
    ↓
Notification Display
```

### **Custom Event System**
```javascript
// Panel state changes
document.dispatchEvent(new CustomEvent('panelOpened', { 
  detail: { panelId: this.activePanel } 
}));

document.dispatchEvent(new CustomEvent('panelClosed', { 
  detail: { panelId: wasOpen } 
}));

// Game state changes
document.dispatchEvent(new CustomEvent('gameStateChanged', {
  detail: { 
    currentPlayer, 
    moveCount: moveHistory.length,
    gamePhase: detectGamePhase()
  }
}));
```

## 💾 Data Persistence Architecture

### **LocalStorage Strategy**
```javascript
// Game state persistence
const STORAGE_KEYS = {
  GAME_STATE: 'damHaji_gameState',
  SETTINGS: 'damHaji_settings',
  STATISTICS: 'damHaji_statistics',
  THEME: 'damHaji_theme'
};

// Auto-save implementation
function autoSave() {
  if (moveHistory.length > 0) {
    const gameData = {
      board: getBoardState(),
      currentPlayer,
      scores: { blackScore, whiteScore },
      moveHistory,
      timestamp: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, 
                        JSON.stringify(gameData));
  }
}

// Settings persistence
class SettingsSystem {
  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, 
                        JSON.stringify(settings));
  }
  
  loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : this.getDefaultSettings();
  }
}
```

## 🎨 CSS Architecture

### **Design System Variables**
```css
:root {
  /* Colors */
  --primary-brown: #8B4513;
  --secondary-brown: #A0522D;
  --light-brown: #D2B48C;
  --cream: #F5F5DC;
  --white: #FFFFFF;
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.15);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.2);
  
  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
  
  /* Z-index Scale */
  --z-base: 1;
  --z-panels: 1000;
  --z-overlay: 1002;
  --z-modal: 1004;
  --z-notification: 1006;
}
```

### **Component-Based CSS Structure**
```css
/* Base Styles */
@import 'base/reset.css';
@import 'base/typography.css';
@import 'base/variables.css';

/* Layout Components */
@import 'layout/grid.css';
@import 'layout/header.css';
@import 'layout/footer.css';

/* UI Components */
@import 'components/buttons.css';
@import 'components/panels.css';
@import 'components/notifications.css';
@import 'components/board.css';

/* Responsive Design */
@import 'responsive/mobile.css';
@import 'responsive/tablet.css';
@import 'responsive/desktop.css';
```

## 🚀 Performance Optimization Strategies

### **1. JavaScript Performance**
- **Event Delegation:** Minimize event listeners
- **Debounced Inputs:** Prevent excessive function calls
- **Lazy Loading:** Load modules only when needed
- **Memory Management:** Proper cleanup and state limits

### **2. CSS Performance**
- **Hardware Acceleration:** `transform3d()` for animations
- **Efficient Selectors:** Avoid deep nesting
- **Critical CSS:** Inline above-the-fold styles
- **CSS Containment:** Isolate layout/paint operations

### **3. DOM Optimization**
- **Batch Updates:** Group DOM modifications
- **Virtual Scrolling:** For large move history
- **Fragment Usage:** Minimize reflows
- **Selector Caching:** Store frequently used elements

### **4. Network Optimization**
- **Resource Minification:** Compressed CSS/JS
- **Gzip Compression:** Server-side compression
- **Cache Headers:** Proper browser caching
- **CDN Usage:** Fast asset delivery

## 🔒 Security Considerations

### **Input Validation**
```javascript
function validateMove(startPos, endPos) {
  // Sanitize input coordinates
  const startRow = Math.floor(Number(startPos.row));
  const startCol = Math.floor(Number(startPos.col));
  const endRow = Math.floor(Number(endPos.row));
  const endCol = Math.floor(Number(endPos.col));
  
  // Boundary checks
  if (startRow < 0 || startRow > 7 || startCol < 0 || startCol > 7 ||
      endRow < 0 || endRow > 7 || endCol < 0 || endCol > 7) {
    return false;
  }
  
  // Game rule validation
  return isValidMoveByRules(startRow, startCol, endRow, endCol);
}
```

### **XSS Prevention**
```javascript
function sanitizeInput(input) {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function createSafeElement(tag, content) {
  const element = document.createElement(tag);
  element.textContent = content; // Safe text insertion
  return element;
}
```

## 📊 Monitoring & Analytics

### **Performance Monitoring**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      errorCount: 0
    };
  }
  
  measureRenderTime(operation) {
    const start = performance.now();
    operation();
    const end = performance.now();
    this.metrics.renderTime = end - start;
  }
  
  trackError(error) {
    this.metrics.errorCount++;
    console.error('Application Error:', error);
  }
}
```

### **User Analytics**
```javascript
class GameAnalytics {
  trackMove(moveData) {
    // Track move patterns for AI improvement
    this.logEvent('move_made', {
      player: moveData.player,
      piece: moveData.piece,
      position: moveData.position,
      timestamp: Date.now()
    });
  }
  
  trackGameCompletion(result) {
    this.logEvent('game_completed', {
      winner: result.winner,
      moveCount: result.moves,
      duration: result.duration,
      aiDifficulty: result.aiLevel
    });
  }
}
```

---

## 🎯 Architecture Benefits

### **Maintainability**
- **Modular Design:** Easy to update individual components
- **Clear Separation:** UI, logic, and integration layers distinct
- **Documentation:** Comprehensive inline and external docs
- **Testing Ready:** Structured for unit and integration tests

### **Scalability**
- **Plugin Architecture:** Easy to add new features
- **Performance Optimized:** Handles complex game states
- **Memory Efficient:** Proper cleanup and state management
- **Mobile Ready:** Touch-optimized for all devices

### **Developer Experience**
- **Clear Structure:** Logical file organization
- **Debugging Tools:** Console logging and error handling
- **Hot Reload Ready:** Development environment friendly
- **Version Control:** Git-friendly modular structure

---

*This architecture successfully balances modern web development practices with game-specific requirements, resulting in a maintainable, performant, and user-friendly application.*