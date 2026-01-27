import { NextRequest, NextResponse } from "next/server";
import { knowledgeBaseService } from "@/services/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/documents
 * List knowledge documents with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    const documents = await knowledgeBaseService.getDocuments(tenantId, {
      category: searchParams.get("category") || undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
      isActive: searchParams.get("isActive") === "true" ? true :
                searchParams.get("isActive") === "false" ? false : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/knowledge/documents
 * Create a new knowledge document
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, title, content, category, tags } = body;

    if (!tenantId || !title || !content) {
      return NextResponse.json(
        { error: "tenantId, title, and content are required" },
        { status: 400 }
      );
    }

    const document = await knowledgeBaseService.createDocument({
      tenantId,
      title,
      content,
      category,
      tags: tags || [],
      sourceType: "manual",
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
