import { NextResponse } from "next/server";
import { getPositions, createPosition, updatePosition, deletePosition } from "@/lib/db/positions";

// GET /api/positions - Get all positions
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const strategy = searchParams.get('strategy') || undefined;
    const ticker = searchParams.get('ticker') || undefined;
    
    const positions = await getPositions({
      status: status || undefined,
      strategy: strategy || undefined,
      ticker: ticker || undefined
    });
    
    return NextResponse.json(positions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch positions", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/positions - Create new position
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    const requiredFields = ['ticker', 'strategy', 'contracts', 'shortStrike', 'entryCreditPerContract', 'expirationDate'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    const position = await createPosition(data);
    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error("Error creating position:", error);
    return NextResponse.json(
      { error: "Failed to create position", detail: String(error) },
      { status: 500 }
    );
  }
}
