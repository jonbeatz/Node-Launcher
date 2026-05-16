# Divi 5.0 & Rive Workflow Guide

## Overview
This guide defines the "Sovereign" approach to modern WordPress development using Divi 5.0 and Rive interactive animations.

## 1. Divi 5.0 Foundation
Divi 5.0 replaces the legacy shortcode system with a high-performance, React-based architecture.

### Key Developer Shifts
- **Modern API:** Use the new Divi 5.0 API for building custom modules.
- **Performance First:** No more shortcode "bloat." Everything is native JSON/React.
- **AI Integration:** Leverage Divi AI for layout generation and CSS refactoring.

## 2. Rive Animation Workflow
Rive is the 2026 standard for interactive web motion.

### The Process
1. **Design in Rive:** Create state machines (e.g., a button that "breathes" or a character that follows the mouse).
2. **Export .riv:** Small, vector-based files that are highly performant.
3. **Embed in Divi:**
   - Use a Code Module or a custom Divi 5.0 Module.
   - Use the Rive Canvas runtime for high-performance rendering.

### Why Rive over Lottie?
- **Lower Context Usage:** Rive files are typically smaller.
- **State Machines:** Native logic inside the animation, reducing custom JS needs.
- **Data Binding:** Connect animation properties to WordPress dynamic content.

## 3. Advanced Layout Patterns (Bento & Spatial)
- **Bento Grids:** Use modular, responsive grid systems.
- **Micro-interactions:** Add 10-20ms transitions to all interactive elements.
- **Spatial UI:** Use soft shadows and depth to create a sense of physical space.

## 4. Tools & Resources
- **Divi Pixel:** For advanced 3D rotators and micro-interactions.
- **Rive.app:** For building the interactive assets.
- **Cursor + Agent-Browser:** For researching specific Divi 5.0 API documentation on the fly.
