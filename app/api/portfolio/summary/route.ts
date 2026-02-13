import { NextResponse } from "next/server";
import { getPortfolioSummary, getPositions } from "@/lib/db/positions";

// GET /api/portfolio/summary - Get portfolio summary
export async function GET() {
  try {
    const summary = await getPortfolioSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching portfolio summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio summary", detail: String(error) },
      { status: 500 }
    );
  }
}
