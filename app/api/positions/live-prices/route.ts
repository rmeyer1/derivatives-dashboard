import { NextResponse } from "next/server";
import { getLivePrices } from "@/lib/db/positions";

// GET /api/positions/live-prices - Get live prices for open positions
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    
    let positionIds: number[] | undefined;
    if (idsParam) {
      positionIds = idsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    }

    const prices = await getLivePrices(positionIds?.length ? positionIds : undefined);
    
    return NextResponse.json(prices);
  } catch (error) {
    console.error("Error fetching live prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch live prices", detail: String(error) },
      { status: 500 }
    );
  }
}
