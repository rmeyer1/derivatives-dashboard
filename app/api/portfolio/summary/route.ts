import { NextResponse } from "next/server";
import { getPortfolioSummary, getRiskDistribution, getPositions } from "@/lib/db/positions";

// GET /api/portfolio/summary - Get portfolio summary with risk distribution
export async function GET() {
  try {
    const [summary, riskDistribution] = await Promise.all([
      getPortfolioSummary(),
      getRiskDistribution()
    ]);

    return NextResponse.json({
      ...summary,
      risk_distribution: riskDistribution
    });
  } catch (error) {
    console.error("Error fetching portfolio summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio summary", detail: String(error) },
      { status: 500 }
    );
  }
}
