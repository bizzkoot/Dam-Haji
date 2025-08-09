# Mobile Sizing Improvement for Dam Haji

## Current Issue

The current mobile implementation uses viewport units (`vh` and `vw`) to determine the game board size:

```css
#game-board {
  width: min(70vh, 70vw);
  height: min(70vh, 70vw);
  /* ... */
}
```

This approach has a significant limitation: when the game is embedded within a browser tab (rather than in fullscreen mode), these units refer to the full device screen dimensions rather than the actual available space within the browser tab. This can result in:
- Board elements extending beyond the visible area
- Unnecessary scrolling
- Poor user experience on mobile devices

## Proposed Solution

Replace the viewport-based sizing with a container-aware approach that dynamically calculates the available space within the browser tab.

### 1. Dynamic Board Sizing with JavaScript

Implement a JavaScript function that:
- Measures the actual available space within the container
- Calculates the board dimensions based on this available space
- Maintains the square aspect ratio of the board
- Updates these dimensions when the window or container is resized

```javascript
function updateBoardSize() {
  const boardContainer = document.getElementById('board-container');
  const containerWidth = boardContainer.clientWidth;
  const containerHeight = boardContainer.clientHeight;
  
  // Account for padding/margins
  const availableWidth = containerWidth - 40; // Adjust based on your layout
  const availableHeight = containerHeight - 40; // Adjust based on your layout
  
  // Calculate board size (maintaining square aspect ratio)
  const boardSize = Math.min(availableWidth, availableHeight, 500); // 500px max size
  
  const gameBoard = document.getElementById('game-board');
  gameBoard.style.width = `${boardSize}px`;
  gameBoard.style.height = `${boardSize}px`;
}

// Call on load and resize
window.addEventListener('load', updateBoardSize);
window.addEventListener('resize', updateBoardSize);
```

### 2. CSS Modifications

Update the CSS to use the dynamic sizing:

```css
#board-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  width: 100%;
  height: 100%;
}

#game-board {
  /* Remove fixed viewport sizing */
  /* width: min(70vh, 70vw); */
  /* height: min(70vh, 70vw); */
  
  /* Use dynamic sizing from JavaScript */
  width: 400px; /* Default size */
  height: 400px; /* Default size */
  
  max-width: 100%;
  max-height: 100%;
  min-width: 300px;
  min-height: 300px;
  
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  background: var(--primary-color);
  padding: 8px;
  aspect-ratio: 1 / 1; /* Maintain square aspect ratio */
}
```

### 3. Container Query Implementation (Modern Approach)

If browser support is not a concern, use container queries for a more responsive approach:

```css
#board-container {
  container-type: size;
  container-name: board-container;
}

@container board-container (max-width: 500px) {
  #game-board {
    width: 95cqw; /* 95% of container width */
    height: 95cqh; /* 95% of container height */
  }
}

@container board-container (min-width: 500px) {
  #game-board {
    width: 500px;
    height: 500px;
  }
}
```

### 4. Mobile-Specific Considerations

For mobile devices, account for browser UI elements:

```javascript
function getAvailableScreenSize() {
  // For mobile browsers that dynamically resize the viewport
  const availableWidth = window.innerWidth;
  const availableHeight = window.innerHeight;
  
  // Account for browser UI elements
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let reservedHeight = 0;
  
  if (isMobile) {
    // Reserve space for browser address bar, etc.
    reservedHeight = 100; // Adjust based on testing
  }
  
  return {
    width: availableWidth,
    height: availableHeight - reservedHeight
  };
}
```

### 5. Resize Observer for Container Changes

Use a ResizeObserver to automatically adjust the board size when its container changes:

```javascript
function initBoardResizing() {
  const boardContainer = document.getElementById('board-container');
  
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      if (entry.target === boardContainer) {
        updateBoardSize();
      }
    }
  });
  
  resizeObserver.observe(boardContainer);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initBoardResizing);
```

## Benefits of This Approach

1. **Accurate Sizing**: The board will correctly fit within the available space of the browser tab
2. **Responsive Design**: Adapts to different container sizes and orientations
3. **Better User Experience**: Eliminates unnecessary scrolling and overflow issues
4. **Cross-Platform Compatibility**: Works consistently across different devices and browsers
5. **Future-Proof**: Uses modern web APIs that are becoming standard

## Implementation Steps

1. Modify the CSS to remove viewport-based sizing
2. Add the JavaScript functions for dynamic sizing
3. Implement the resize observer for automatic adjustments
4. Test across different devices and browser configurations
5. Fine-tune the reserved space values for mobile browsers

This approach will ensure the game board properly fits within its container regardless of whether it's viewed in fullscreen mode or within a browser tab.