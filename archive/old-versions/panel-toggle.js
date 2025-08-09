// Panel Toggle Logic for Smart Auto-Hide Layout
// This handles showing/hiding panels when they're auto-hidden based on screen size

document.addEventListener('DOMContentLoaded', function() {
    
    // Panel toggle functionality
    function togglePanel(panelSide) {
        const panel = document.getElementById(`${panelSide}-panel`);
        const isVisible = panel.classList.contains('show');
        
        if (isVisible) {
            panel.classList.remove('show');
        } else {
            // Hide other panel first if on mobile
            const otherSide = panelSide === 'left' ? 'right' : 'left';
            const otherPanel = document.getElementById(`${otherSide}-panel`);
            otherPanel.classList.remove('show');
            
            // Show requested panel
            panel.classList.add('show');
        }
    }
    
    // Add event listeners to toggle buttons
    const leftToggle = document.getElementById('toggle-left-panel');
    const rightToggle = document.getElementById('toggle-right-panel');
    
    if (leftToggle) {
        leftToggle.addEventListener('click', () => togglePanel('left'));
    }
    
    if (rightToggle) {
        rightToggle.addEventListener('click', () => togglePanel('right'));
    }
    
    // Handle mobile toggle buttons
    window.togglePanel = togglePanel;
    
    // Close panels when clicking outside (for mobile)
    document.addEventListener('click', function(event) {
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        const toggleButtons = document.querySelectorAll('.panel-toggle, .mobile-toggle');
        
        // Check if click is outside panels and toggle buttons
        const isClickInsidePanel = leftPanel.contains(event.target) || rightPanel.contains(event.target);
        const isClickOnToggle = Array.from(toggleButtons).some(btn => btn.contains(event.target));
        
        if (!isClickInsidePanel && !isClickOnToggle) {
            leftPanel.classList.remove('show');
            rightPanel.classList.remove('show');
        }
    });
    
    // Handle escape key to close panels
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.getElementById('left-panel').classList.remove('show');
            document.getElementById('right-panel').classList.remove('show');
        }
    });
    
    // Update toggle button positions based on screen size
    function updateToggleButtonPositions() {
        const leftToggle = document.getElementById('toggle-left-panel');
        const rightToggle = document.getElementById('toggle-right-panel');
        
        if (leftToggle) leftToggle.style.left = '10px';
        if (rightToggle) rightToggle.style.right = '10px';
    }
    
    // Initialize positions
    updateToggleButtonPositions();
    
    // Update on window resize
    window.addEventListener('resize', updateToggleButtonPositions);
});