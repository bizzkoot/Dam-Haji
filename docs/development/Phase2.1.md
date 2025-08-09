# Phase 2.1: Core AI Improvements - Implementation Guide

## 📋 Overview

**Phase 2.1** focuses on enhancing the core AI capabilities of Dam Haji with four key improvements:

1. **Iterative Deepening** - Start with depth 1, gradually increase for better move selection
2. **Move Ordering** - Prioritize promising moves for better alpha-beta pruning
3. **Variable Search Depth** - Different depths per difficulty level
4. **Endgame Recognition** - Special handling for king vs king scenarios

**Estimated Timeline**: 2-3 weeks  
**Priority**: High Impact, Low Complexity  
**Dependencies**: Current AI implementation (ai.js, script.js)

---

## 🎯 Current AI Implementation Analysis

### **Existing Architecture**
```javascript
// Current AI structure in ai.js
const AI_WEIGHTS = {
    easy: { captureValue: 10, pieceValue: 1, positionValue: 0.1, hajiValue: 3, centerControl: 0.05 },
    medium: { captureValue: 15, pieceValue: 1.5, positionValue: 0.2, hajiValue: 5, centerControl: 0.1 },
    hard: { captureValue: 20, pieceValue: 2, positionValue: 0.3, hajiValue: 8, centerControl: 0.15 }
};

// Current search depths
const depth = { easy: 1, medium: 3, hard: 5 }[aiDifficulty];

// Current minimax implementation
function minimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty) {
    // ... existing implementation
}

// Current findBestMove implementation
function findBestMove(board, player, aiDifficulty, aiPlayer) {
    // ... existing implementation
}
```

### **Current Limitations**
1. **Fixed Depth**: Each difficulty level uses a fixed search depth
2. **No Move Ordering**: Moves are evaluated in arbitrary order
3. **No Iterative Deepening**: AI doesn't start with shallow searches
4. **Basic Endgame**: No special handling for endgame scenarios
5. **Inefficient Pruning**: Alpha-beta pruning effectiveness limited by move order

---

## 🚀 Implementation Plan

### **Phase 2.1.1: Iterative Deepening** (Week 1)

#### **Objective**
Implement iterative deepening to start with shallow searches and gradually increase depth, providing better move selection and time management.

#### **Implementation Steps**

1. **Create Iterative Deepening Function**
```javascript
// Add to ai.js
function iterativeDeepening(board, player, aiDifficulty, aiPlayer, maxTime = 5000) {
    const startTime = Date.now();
    let bestMove = null;
    let bestValue = -Infinity;
    let currentDepth = 1;
    const maxDepth = { easy: 3, medium: 6, hard: 8 }[aiDifficulty];
    
    console.log(`[AI DEBUG] Starting iterative deepening for ${aiDifficulty} difficulty`);
    
    while (currentDepth <= maxDepth && (Date.now() - startTime) < maxTime) {
        console.log(`[AI DEBUG] Searching at depth ${currentDepth}`);
        
        const result = searchAtDepth(board, player, currentDepth, aiPlayer, aiDifficulty);
        
        if (result.move) {
            bestMove = result.move;
            bestValue = result.value;
            console.log(`[AI DEBUG] Depth ${currentDepth} completed. Best move: (${bestMove.startRow},${bestMove.startCol})->(${bestMove.endRow},${bestMove.endCol}) with value: ${bestValue}`);
        } else {
            console.log(`[AI DEBUG] No move found at depth ${currentDepth}`);
            break;
        }
        
        currentDepth++;
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[AI DEBUG] Iterative deepening completed in ${totalTime}ms. Final depth: ${currentDepth - 1}`);
    
    return bestMove;
}

function searchAtDepth(board, player, depth, aiPlayer, aiDifficulty) {
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);
    
    if (moves.length === 0) return { move: null, value: -Infinity };
    
    let bestMove = null;
    let bestValue = -Infinity;
    
    for (const move of moves) {
        const nextBoard = pureApplyMove(board, move);
        const val = minimax(nextBoard, depth - 1, false, -Infinity, Infinity, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
        if (val > bestValue) {
            bestValue = val;
            bestMove = move;
        }
    }
    
    return { move: bestMove, value: bestValue };
}
```

2. **Update findBestMove Function**
```javascript
// Replace existing findBestMove in ai.js
function findBestMove(board, player, aiDifficulty, aiPlayer) {
    // Use iterative deepening instead of fixed depth
    return iterativeDeepening(board, player, aiDifficulty, aiPlayer);
}
```

3. **Add Time Management**
```javascript
// Add to ai.js
const AI_TIME_LIMITS = {
    easy: 2000,    // 2 seconds
    medium: 5000,  // 5 seconds
    hard: 10000    // 10 seconds
};

function getTimeLimit(aiDifficulty) {
    return AI_TIME_LIMITS[aiDifficulty] || 5000;
}
```

#### **Testing Strategy**
- Test with different board positions
- Verify time limits are respected
- Check that deeper searches find better moves
- Ensure backward compatibility

---

### **Phase 2.1.2: Move Ordering** (Week 1-2)

#### **Objective**
Implement intelligent move ordering to improve alpha-beta pruning efficiency by evaluating promising moves first.

#### **Implementation Steps**

1. **Create Move Scoring Function**
```javascript
// Add to ai.js
function scoreMove(board, move, player, aiDifficulty) {
    const weights = AI_WEIGHTS[aiDifficulty];
    let score = 0;
    
    // Capture moves get highest priority
    if (move.isCapture) {
        score += 1000;
        
        // Multiple captures get bonus
        const nextBoard = pureApplyMove(board, move);
        const nextCaptures = pureGetAllCaptureMoves(nextBoard, player);
        score += nextCaptures.length * 100;
    }
    
    // Haji moves get priority
    const piece = board[move.startRow][move.startCol];
    if (piece && piece.haji) {
        score += 100;
    }
    
    // Center control
    const centerDistance = Math.abs(move.endCol - 3.5) + Math.abs(move.endRow - 3.5);
    score += (7 - centerDistance) * 10;
    
    // Promotion moves
    if ((move.endRow === 0 && player === 'W') || (move.endRow === 7 && player === 'B')) {
        score += 200;
    }
    
    // Position value
    const positionValue = player === 'B' ? move.endRow / 7 : (7 - move.endRow) / 7;
    score += positionValue * 50;
    
    return score;
}
```

2. **Create Move Ordering Function**
```javascript
// Add to ai.js
function orderMoves(board, moves, player, aiDifficulty) {
    return moves.map(move => ({
        ...move,
        score: scoreMove(board, move, player, aiDifficulty)
    })).sort((a, b) => b.score - a.score);
}
```

3. **Update minimax Function**
```javascript
// Update minimax function in ai.js
function minimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty) {
    if (depth === 0) {
        return evaluateBoardState(board, player, aiDifficulty);
    }

    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);

    if (moves.length === 0) {
        return isMaximizingPlayer ? -Infinity : Infinity;
    }

    // Order moves for better pruning
    const orderedMoves = orderMoves(board, moves, player, aiDifficulty);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = minimax(nextBoard, depth - 1, false, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) {
                console.log(`[AI DEBUG] Alpha-beta cutoff at depth ${depth}`);
                break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = minimax(nextBoard, depth - 1, true, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) {
                console.log(`[AI DEBUG] Alpha-beta cutoff at depth ${depth}`);
                break;
            }
        }
        return minEval;
    }
}
```

#### **Testing Strategy**
- Compare pruning efficiency with and without move ordering
- Test with various board positions
- Verify that captures are prioritized
- Check that Haji moves get appropriate priority

---

### **Phase 2.1.3: Variable Search Depth** (Week 2)

#### **Objective**
Implement dynamic search depths based on game phase and difficulty level.

#### **Implementation Steps**

1. **Create Game Phase Detection**
```javascript
// Add to ai.js
function detectGamePhase(board, player) {
    let playerPieces = 0;
    let opponentPieces = 0;
    let playerHaji = 0;
    let opponentHaji = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            
            if (cell.color === player) {
                playerPieces++;
                if (cell.haji) playerHaji++;
            } else {
                opponentPieces++;
                if (cell.haji) opponentHaji++;
            }
        }
    }
    
    const totalPieces = playerPieces + opponentPieces;
    
    if (totalPieces <= 6) return 'endgame';
    if (totalPieces <= 12) return 'midgame';
    return 'opening';
}

function getDynamicDepth(aiDifficulty, gamePhase, board, player) {
    const baseDepths = {
        easy: { opening: 2, midgame: 3, endgame: 4 },
        medium: { opening: 4, midgame: 5, endgame: 6 },
        hard: { opening: 6, midgame: 7, endgame: 8 }
    };
    
    let depth = baseDepths[aiDifficulty][gamePhase];
    
    // Adjust depth based on game state
    const mustCapture = pureCheckAvailableCaptures(board, player);
    if (mustCapture) {
        depth += 1; // Search deeper when captures are available
    }
    
    // Reduce depth in complex positions
    const totalMoves = pureGetAllCaptureMoves(board, player).length + pureGetAllRegularMoves(board, player).length;
    if (totalMoves > 20) {
        depth = Math.max(depth - 1, 1);
    }
    
    return depth;
}
```

2. **Update Iterative Deepening**
```javascript
// Update iterativeDeepening function
function iterativeDeepening(board, player, aiDifficulty, aiPlayer, maxTime = 5000) {
    const startTime = Date.now();
    let bestMove = null;
    let bestValue = -Infinity;
    let currentDepth = 1;
    
    const gamePhase = detectGamePhase(board, player);
    const maxDepth = getDynamicDepth(aiDifficulty, gamePhase, board, player);
    
    console.log(`[AI DEBUG] Game phase: ${gamePhase}, Max depth: ${maxDepth}`);
    
    while (currentDepth <= maxDepth && (Date.now() - startTime) < maxTime) {
        console.log(`[AI DEBUG] Searching at depth ${currentDepth}`);
        
        const result = searchAtDepth(board, player, currentDepth, aiPlayer, aiDifficulty);
        
        if (result.move) {
            bestMove = result.move;
            bestValue = result.value;
            console.log(`[AI DEBUG] Depth ${currentDepth} completed. Best move: (${bestMove.startRow},${bestMove.startCol})->(${bestMove.endRow},${bestMove.endCol}) with value: ${bestValue}`);
        } else {
            console.log(`[AI DEBUG] No move found at depth ${currentDepth}`);
            break;
        }
        
        currentDepth++;
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[AI DEBUG] Iterative deepening completed in ${totalTime}ms. Final depth: ${currentDepth - 1}`);
    
    return bestMove;
}
```

#### **Testing Strategy**
- Test with different game phases
- Verify depth adjustments work correctly
- Check performance impact
- Ensure backward compatibility

---

### **Phase 2.1.4: Endgame Recognition** (Week 2-3)

#### **Objective**
Implement special handling for endgame scenarios, particularly king vs king situations.

#### **Implementation Steps**

1. **Create Endgame Detection**
```javascript
// Add to ai.js
function isEndgame(board, player) {
    let playerPieces = 0;
    let opponentPieces = 0;
    let playerHaji = 0;
    let opponentHaji = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            
            if (cell.color === player) {
                playerPieces++;
                if (cell.haji) playerHaji++;
            } else {
                opponentPieces++;
                if (cell.haji) opponentHaji++;
            }
        }
    }
    
    // Endgame conditions
    if (playerPieces + opponentPieces <= 6) return true;
    if (playerHaji + opponentHaji >= 3) return true;
    if (playerPieces <= 2 || opponentPieces <= 2) return true;
    
    return false;
}

function isKingVsKing(board, player) {
    let playerHaji = 0;
    let opponentHaji = 0;
    let playerRegular = 0;
    let opponentRegular = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            
            if (cell.color === player) {
                if (cell.haji) playerHaji++;
                else playerRegular++;
            } else {
                if (cell.haji) opponentHaji++;
                else opponentRegular++;
            }
        }
    }
    
    return playerRegular === 0 && opponentRegular === 0 && playerHaji > 0 && opponentHaji > 0;
}
```

2. **Create Endgame Evaluation**
```javascript
// Add to ai.js
function evaluateEndgame(board, player, aiDifficulty) {
    const weights = AI_WEIGHTS[aiDifficulty];
    let score = 0;
    
    if (isKingVsKing(board, player)) {
        score = evaluateKingVsKing(board, player, aiDifficulty);
    } else {
        score = evaluateBoardState(board, player, aiDifficulty);
    }
    
    return score;
}

function evaluateKingVsKing(board, player, aiDifficulty) {
    let playerHaji = 0;
    let opponentHaji = 0;
    let playerCenterControl = 0;
    let opponentCenterControl = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            
            const centerDistance = Math.abs(c - 3.5) + Math.abs(r - 3.5);
            const centerValue = (7 - centerDistance) / 7;
            
            if (cell.color === player) {
                playerHaji++;
                playerCenterControl += centerValue;
            } else {
                opponentHaji++;
                opponentCenterControl += centerValue;
            }
        }
    }
    
    // King vs King evaluation
    let score = (playerHaji - opponentHaji) * 1000; // Haji count is crucial
    score += (playerCenterControl - opponentCenterControl) * 100; // Center control matters
    score += (playerHaji - opponentHaji) * 50; // Extra weight for Haji advantage
    
    return score;
}
```

3. **Update minimax Function**
```javascript
// Update minimax function to use endgame evaluation
function minimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty) {
    if (depth === 0) {
        if (isEndgame(board, player)) {
            return evaluateEndgame(board, player, aiDifficulty);
        }
        return evaluateBoardState(board, player, aiDifficulty);
    }
    
    // ... rest of existing minimax implementation
}
```

#### **Testing Strategy**
- Test with various endgame scenarios
- Verify king vs king evaluation
- Check that endgame detection works correctly
- Test performance impact

---

## 🧪 Testing Framework

### **Test Cases**

1. **Iterative Deepening Tests**
```javascript
// Test iterative deepening with time limits
function testIterativeDeepening() {
    const testBoard = buildBoardFromDOM();
    const startTime = Date.now();
    const move = iterativeDeepening(testBoard, 'B', 'medium', 'B', 2000);
    const endTime = Date.now();
    
    console.assert(endTime - startTime <= 2500, 'Time limit exceeded');
    console.assert(move !== null, 'No move returned');
}
```

2. **Move Ordering Tests**
```javascript
// Test move ordering efficiency
function testMoveOrdering() {
    const testBoard = buildBoardFromDOM();
    const moves = pureGetAllCaptureMoves(testBoard, 'B').concat(pureGetAllRegularMoves(testBoard, 'B'));
    const orderedMoves = orderMoves(testBoard, moves, 'B', 'medium');
    
    // Verify captures are prioritized
    const captures = orderedMoves.filter(m => m.isCapture);
    const regular = orderedMoves.filter(m => !m.isCapture);
    
    console.assert(captures.length === 0 || captures[0].score > regular[0].score, 'Captures not prioritized');
}
```

3. **Endgame Recognition Tests**
```javascript
// Test endgame detection
function testEndgameRecognition() {
    const endgameBoard = createEndgameBoard();
    const isEndgameResult = isEndgame(endgameBoard, 'B');
    const isKingVsKingResult = isKingVsKing(endgameBoard, 'B');
    
    console.assert(isEndgameResult === true, 'Endgame not detected');
    console.assert(isKingVsKingResult === true, 'King vs King not detected');
}
```

### **Performance Benchmarks**

1. **Search Speed**
   - Measure time per move at different depths
   - Compare with and without optimizations
   - Track memory usage

2. **Move Quality**
   - Test against known strong positions
   - Compare move selection with previous version
   - Verify tactical accuracy

3. **User Experience**
   - Test response times
   - Verify AI doesn't freeze
   - Check for memory leaks

---

## 🔧 Integration Plan

### **File Modifications**

1. **ai.js Updates**
   - Add new functions for iterative deepening
   - Implement move ordering
   - Add endgame recognition
   - Update existing functions

2. **script.js Updates**
   - Update AI status display
   - Add debugging information
   - Ensure backward compatibility

3. **Testing Integration**
   - Add test functions
   - Create test scenarios
   - Implement performance monitoring

### **Backward Compatibility**

1. **Maintain Existing API**
   - Keep existing function signatures
   - Preserve current AI weights
   - Maintain difficulty levels

2. **Gradual Rollout**
   - Implement features incrementally
   - Test each component separately
   - Rollback plan if issues arise

---

## 📊 Success Metrics

### **Performance Targets**

1. **Search Efficiency**
   - 30% improvement in nodes searched per second
   - 50% reduction in unnecessary evaluations
   - 20% faster move selection

2. **Move Quality**
   - 25% improvement in tactical accuracy
   - 40% better endgame play
   - 15% stronger opening play

3. **User Experience**
   - AI response time < 3 seconds for medium difficulty
   - AI response time < 5 seconds for hard difficulty
   - No AI freezing or crashes

### **Quality Assurance**

1. **Code Quality**
   - 90% code coverage
   - No critical bugs
   - Clean, documented code

2. **Testing**
   - All test cases pass
   - Performance benchmarks met
   - User acceptance testing completed

---

## 🚨 Risk Mitigation

### **Technical Risks**

1. **Performance Degradation**
   - **Risk**: New features slow down AI
   - **Mitigation**: Implement performance monitoring and rollback plan

2. **Memory Issues**
   - **Risk**: Iterative deepening consumes too much memory
   - **Mitigation**: Implement memory limits and cleanup

3. **Bug Introduction**
   - **Risk**: New code introduces bugs
   - **Mitigation**: Comprehensive testing and gradual rollout

### **Timeline Risks**

1. **Scope Creep**
   - **Risk**: Adding too many features
   - **Mitigation**: Stick to Phase 2.1 scope

2. **Integration Issues**
   - **Risk**: New code doesn't integrate well
   - **Mitigation**: Maintain backward compatibility

---

## 📝 Documentation Requirements

### **Code Documentation**

1. **Function Documentation**
   - JSDoc comments for all new functions
   - Parameter descriptions
   - Return value explanations

2. **Algorithm Documentation**
   - Iterative deepening explanation
   - Move ordering rationale
   - Endgame recognition logic

3. **Testing Documentation**
   - Test case descriptions
   - Performance benchmarks
   - Quality metrics

### **User Documentation**

1. **AI Behavior Changes**
   - Explain new AI capabilities
   - Document difficulty level changes
   - Provide usage examples

2. **Performance Improvements**
   - Document speed improvements
   - Explain quality enhancements
   - Provide comparison metrics

---

## 🎯 Next Steps

### **Immediate Actions**

1. **Set up development environment**
2. **Create test framework**
3. **Implement iterative deepening**
4. **Test and validate**

### **Phase 2.1 Completion Criteria**

- [x] Iterative deepening implemented and tested
- [x] Move ordering implemented and tested
- [x] Variable search depth implemented and tested
- [x] Endgame recognition implemented and tested
- [ ] Performance benchmarks met
- [ ] Documentation completed
- [ ] Code review completed
- [ ] User testing completed

### **Phase 2.2 Preparation**

- [ ] Performance analysis completed
- [ ] User feedback collected
- [ ] Phase 2.2 requirements defined
- [ ] Implementation plan created

---

*This document provides a comprehensive guide for implementing Phase 2.1 Core AI Improvements. Follow the implementation steps carefully and test thoroughly at each stage.* 