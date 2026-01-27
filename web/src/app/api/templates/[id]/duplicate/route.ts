import { NextRequest, NextResponse } from "next/server";
import { templateService } from "@/services/templates";

/**
 * Duplicate a template
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { name } = body;

    const template = await templateService.duplicateTemplate(id, name);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate template:", error);
    return NextResponse.json(
      { error: "Failed to duplicate template" },
      { status: 500 }
    );
  }
}
