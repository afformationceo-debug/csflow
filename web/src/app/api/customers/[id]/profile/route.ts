import { NextRequest, NextResponse } from "next/server";
import { serverCustomerService } from "@/services/customers";

/**
 * Get comprehensive customer profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const profile = await serverCustomerService.getCustomerProfile(id);

    if (!profile) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Failed to get customer profile:", error);
    return NextResponse.json(
      { error: "Failed to get customer profile" },
      { status: 500 }
    );
  }
}
