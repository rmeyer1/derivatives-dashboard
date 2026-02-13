import { NextRequest, NextResponse } from "next/server";
import { getPositionById, updatePosition, deletePosition } from "@/lib/db/positions";

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
    const { id } = await params;
    const body = await request.json();
    
    const position = await updatePosition(parseInt(id), {
      currentPrice: body.currentPrice,
      notes: body.notes,
      acknowledgmentFlag: body.acknowledgmentFlag,
      acknowledgmentExpiry: body.acknowledgmentExpiry,
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
    const { id } = await params;
    const success = await deletePosition(parseInt(id));
    
    if (!success) {
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting position:", error);
    return NextResponse.json(
      { error: "Failed to delete position", detail: String(error) },
      { status: 500 }
    );
  }
}
