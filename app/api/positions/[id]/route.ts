import { NextResponse } from "next/server";
import { getPositionById, updatePosition, deletePosition } from "@/lib/db/positions";

// GET /api/positions/[id] - Get single position
export async function GET(
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
    
    const position = await getPositionById(id);
    
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
    const position = await updatePosition(id, data);
    
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
    
    const success = await deletePosition(id);
    
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
