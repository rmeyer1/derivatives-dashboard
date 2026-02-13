import { NextRequest, NextResponse } from "next/server";
import { rollPosition } from "@/lib/db/positions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/positions/[id]/roll - Roll a position
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    
    // Validate required fields
    const required = ['newShortStrike', 'newExpirationDate', 'newEntryCredit'];
    for (const field of required) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    const position = await rollPosition(id, {
      newShortStrike: body.newShortStrike,
      newLongStrike: body.newLongStrike,
      newExpirationDate: body.newExpirationDate,
      newEntryCredit: body.newEntryCredit,
      newContracts: body.newContracts,
    });
    
    if (!position) {
      return NextResponse.json(
        { error: "Open position not found" },
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
