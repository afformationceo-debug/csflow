import { NextRequest, NextResponse } from "next/server";
import { serverCustomerService } from "@/services/customers";

/**
 * Sync customer with CRM
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customer = await serverCustomerService.syncWithCRM(id);

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to sync customer with CRM:", error);
    return NextResponse.json(
      { error: "Failed to sync customer with CRM" },
      { status: 500 }
    );
  }
}
