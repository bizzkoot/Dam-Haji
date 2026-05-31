// Web Worker for Dam Haji AI search
importScripts('ai.js');

self.onmessage = function(e) {
    const { board, player, aiDifficulty, aiPlayer } = e.data;
    try {
        const bestMove = findBestMove(board, player, aiDifficulty, aiPlayer);
        self.postMessage({ success: true, bestMove });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};
