# Derivatives Trading Dashboard

A Next.js + React dashboard for real-time derivatives trading portfolio monitoring.

## Features

- **Portfolio Overview**: Real-time position tracking with P&L, Greeks (Delta, Gamma, Theta, Vega), and IV metrics
- **Technical Charts**: 
  - DMA (Delta-Adjusted Moving Average) analysis
  - Implied Volatility curve visualization
- **Alert System**: Critical position warnings and notifications
- **Modern UI**: Built with shadcn/ui components, Tailwind CSS, and Radix UI primitives

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Card, Table, Tabs, Alert, Badge)
- **Charts**: Recharts
- **Icons**: Radix UI React Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd derivatives-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
derivatives-dashboard/
├── app/
│   ├── api/
│   │   ├── alerts/route.ts      # Alert API endpoints
│   │   └── positions/route.ts   # Portfolio data API
│   ├── globals.css               # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main dashboard
├── components/
│   ├── ui/                      # shadcn UI components
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   └── tabs.tsx
│   ├── alert-panel.tsx          # Alert notifications
│   ├── dma-chart.tsx            # DMA analysis chart
│   ├── iv-chart.tsx             # IV curve chart
│   └── portfolio-table.tsx      # Positions table
├── lib/
│   └── utils.ts                 # Utility functions
├── types/
│   └── dashboard.ts             # TypeScript types
└── next.config.js               # Next.js config
```

## Data Flow

```
Python Backend → API Routes → React Components → Dashboard UI
     ↓               ↓               ↓              ↓
  (Positions)   (Next.js)     (TypeScript)    (Browser)
```

## API Endpoints

- `GET /api/positions` - Returns portfolio positions data
- `GET /api/alerts` - Returns active alerts

## Future Enhancements

- Real-time WebSocket data feed
- Risk analytics (VaR, expected shortfall)
- Options chain analysis
- Trade execution interface
- Historical P&L tracking

## License

MIT
