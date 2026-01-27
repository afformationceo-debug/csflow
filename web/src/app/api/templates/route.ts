import { NextRequest, NextResponse } from "next/server";
import { serverTemplateService } from "@/services/templates";
import { TemplateCategory, TemplateStatus } from "@/services/templates";

/**
 * Get all templates with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const templates = await serverTemplateService.getTemplates({
      tenantId: searchParams.get("tenantId") || undefined,
      category: searchParams.get("category") as TemplateCategory | undefined,
      status: searchParams.get("status") as TemplateStatus | undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : undefined,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : undefined,
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Failed to get templates:", error);
    return NextResponse.json(
      { error: "Failed to get templates" },
      { status: 500 }
    );
  }
}

/**
 * Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tenantId,
      name,
      category,
      description,
      content,
      contentTranslations,
      variables,
      channelConfigs,
      status,
    } = body;

    if (!tenantId || !name || !category || !content) {
      return NextResponse.json(
        { error: "tenantId, name, category, and content are required" },
        { status: 400 }
      );
    }

    // Create template using client service (will use server client internally)
    const { templateService } = await import("@/services/templates");
    const template = await templateService.createTemplate({
      tenantId,
      name,
      category,
      description,
      content,
      contentTranslations,
      variables,
      channelConfigs,
      status,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
