# My Pong — 10 Levels

Cross-browser improvements for Windows (Chrome, Firefox, Edge):

- Pointer event support for on-screen controls (works with mouse, touch, stylus)
- Prevent default on Space to stop page scrolling in Firefox/Edge
- Visibility handling pauses the game when the tab is hidden
- Single AudioContext created/resumed on user gesture to satisfy browser autoplay policies

How to test:
1. Serve the repository root (python -m http.server 8000) and open in Chrome/Firefox/Edge on Windows.
2. Click Start (or press Space) to enable audio and begin playing.
3. Controls: W/S or Up/Down; P to pause; on-screen buttons for mobile/ touch.
