import { NextRequest, NextResponse } from "next/server";
import { closePosition } from "@/lib/db/positions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/positions/[id]/close - Close a position
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    
    if (!body.closeDebitPerContract === undefined) {
      return NextResponse.json(
        { error: "Missing required field: closeDebitPerContract" },
        { status: 400 }
      );
    }
    
    const position = await closePosition(
      id,
      body.closeDebitPerContract,
      body.closeDate
    );
    
    if (!position) {
      return NextResponse.json(
        { error: "Open position not found" },
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
