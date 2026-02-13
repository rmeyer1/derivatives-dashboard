import { NextResponse } from "next/server";
import { closePosition } from "@/lib/db/positions";

// POST /api/positions/[id]/close - Close a position
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
    const { closeDebitPerContract, closeDate } = data;
    
    if (typeof closeDebitPerContract !== 'number') {
      return NextResponse.json(
        { error: "Missing required field: closeDebitPerContract" },
        { status: 400 }
      );
    }
    
    const position = await closePosition(id, closeDebitPerContract, closeDate);
    
    if (!position) {
      return NextResponse.json(
        { error: "Position not found or already closed" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(position);
  } catch (error) {
    console.error("Error closing position:", error);
    return NextResponse.json(
      { error: "Failed to close position", detail: String(error) },
      { status: 500 }
    );
  }
}
