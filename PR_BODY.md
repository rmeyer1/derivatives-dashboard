## Summary
Integrates live price streaming into the Portfolio component for real-time P&L updates.

## Changes
- **New Hook**: `usePortfolioLivePrices` — SSE streaming with symbol extraction from positions
- **New Component**: `LivePortfolioTable` — Live mode toggle, bid/ask columns, streaming status
- **Updated**: `ResizableDashboard` uses live portfolio
- **Updated**: `CompactMode` Position type compatibility
- **Added**: `Switch` UI component for live mode toggle

## Features
- Real-time price updates via SSE (`/api/market/stream`)
- Live P&L calculations: `(currentPrice - entryPrice) * quantity`
- Color-coded cells (green/red) with streaming status indicator
- Graceful fallback to static mode when disconnected

## Technical Notes
- Option prices: Alpaca paid tier required (documented, stock-only for now)
- Uses existing `useLivePrices` hook from Milestone 2
- Clean TypeScript types throughout

## Testing
1. Run `npm run dev`
2. Navigate to Portfolio
3. Toggle "Live Mode" — prices should stream and P&L update

---
*Coding Agent: qwen3-coder*