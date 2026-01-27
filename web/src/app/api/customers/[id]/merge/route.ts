import { NextRequest, NextResponse } from "next/server";
import { serverCustomerService } from "@/services/customers";

/**
 * Merge two customers (move secondary customer data to primary)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: primaryCustomerId } = await params;
    const body = await request.json();
    const { secondaryCustomerId } = body;

    if (!secondaryCustomerId) {
      return NextResponse.json(
        { error: "secondaryCustomerId is required" },
        { status: 400 }
      );
    }

    if (primaryCustomerId === secondaryCustomerId) {
      return NextResponse.json(
        { error: "Cannot merge customer with itself" },
        { status: 400 }
      );
    }

    await serverCustomerService.mergeCustomers(primaryCustomerId, secondaryCustomerId);

    // Get updated profile
    const profile = await serverCustomerService.getCustomerProfile(primaryCustomerId);

    return NextResponse.json({
      success: true,
      customer: profile,
    });
  } catch (error) {
    console.error("Failed to merge customers:", error);
    return NextResponse.json(
      { error: "Failed to merge customers" },
      { status: 500 }
    );
  }
}
