import { NextResponse } from "next/server";
import { rollPosition } from "@/lib/db/positions";

// POST /api/positions/[id]/roll - Roll a position
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid position ID" },
        { status: 400 }
      );
    }
    
    const data = await request.json();
    const { newShortStrike, newLongStrike, newExpirationDate, newEntryCredit, newContracts } = data;
    
    if (!newShortStrike || !newExpirationDate || typeof newEntryCredit !== 'number') {
      return NextResponse.json(
        { error: "Missing required fields for roll" },
        { status: 400 }
      );
    }
    
    const position = await rollPosition(id, {
      newShortStrike,
      newLongStrike,
      newExpirationDate,
      newEntryCredit,
      newContracts
    });
    
    if (!position) {
      return NextResponse.json(
        { error: "Position not found or cannot be rolled" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(position);
  } catch (error) {
    console.error("Error rolling position:", error);
    return NextResponse.json(
      { error: "Failed to roll position", detail: String(error) },
      { status: 500 }
    );
  }
}
