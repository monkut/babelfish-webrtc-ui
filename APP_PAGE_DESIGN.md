## Overview

This is a simple SPA that connects to the ~/PycharmProjects/babelfish-backend/babelfish api via
WEBRTC.

# Page Design

This APP is a single page with a GREEN 'connect' button.

When the 'connect button' is clicked:
- The connect button changes to a RED 'disconnect' button.
- a web-rtc connection is made with the babelfish-backend server/apis.
- On successful connection a visualization of the real-time audio is displayed while in the 'connected' state.

When the 'disconnect button' is clicked:
- The 'disconnect button' returns to a GREEN 'connect' button.
- The WebRTC connection is closed.
- The audio visualization is terminated.
