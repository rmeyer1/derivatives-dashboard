import { NextResponse } from "next/server";
import { getAssignedPositions } from "@/lib/db/trades";

// GET /api/assignments - List assigned CSPs with cost basis
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const ticker = searchParams.get('ticker') || undefined;
    
    const assignments = await getAssignedPositions({
      ticker,
    });
    
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments", detail: String(error) },
      { status: 500 }
    );
  }
}
