import { NextRequest, NextResponse } from "next/server";
import { knowledgeBaseService } from "@/services/ai/knowledge-base";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/knowledge/documents/[id]/embeddings
 * Regenerate embeddings for a document
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get document to get content
    const document = await knowledgeBaseService.getDocument(id);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Regenerate embeddings
    await knowledgeBaseService.regenerateEmbeddings(id, document.content);

    return NextResponse.json({
      success: true,
      message: "Embeddings regenerated successfully",
    });
  } catch (error) {
    console.error("Error regenerating embeddings:", error);
    return NextResponse.json(
      { error: "Failed to regenerate embeddings" },
      { status: 500 }
    );
  }
}
