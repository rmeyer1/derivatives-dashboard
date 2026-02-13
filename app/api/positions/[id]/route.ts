import { NextRequest, NextResponse } from "next/server";
import { getPositionById, updatePosition, deletePosition, closePosition, rollPosition } from "@/lib/db/positions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/positions/[id] - Get single position
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const position = await getPositionById(parseInt(id));
    
    if (!position) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(position);
  } catch (error) {
    console.error("Error fetching position:", error);
    return NextResponse.json(
      { error: "Failed to fetch position", detail: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/positions/[id] - Update position
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    
    const position = await updatePosition(id, {
      currentPrice: body.currentPrice,
      notes: body.notes,
      acknowledgmentFlag: body.acknowledgmentFlag,
      alertType: body.alertType,
      managementPlan: body.managementPlan,
    });
    
    if (!position) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(position);
  } catch (error) {
    console.error("Error updating position:", error);
    return NextResponse.json(
      { error: "Failed to update position", detail: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/positions/[id] - Delete position
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const success = await deletePosition(id);
    
    if (!success) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: "Position deleted successfully" });
  } catch (error) {
    console.error("Error deleting position:", error);
    return NextResponse.json(
      { error: "Failed to delete position", detail: String(error) },
      { status: 500 }
    );
  }
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
    
    // Check if this is a close request or roll request based on URL path
    const url = new URL(request.url);
    const isClose = url.pathname.endsWith('/close');
    const isRoll = url.pathname.endsWith('/roll');
    
    if (isClose) {
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
    }
    
    if (isRoll) {
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
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing position action:", error);
    return NextResponse.json(
      { error: "Failed to process action", detail: String(error) },
      { status: 500 }
    );
  }
}
