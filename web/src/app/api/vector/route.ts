import { NextRequest, NextResponse } from "next/server";
import { upstashVectorService } from "@/services/upstash-vector";

// POST /api/vector/search - 벡터 검색
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, tenantId, topK = 5, filter, searchType = "hybrid" } = body;

    if (!query || !tenantId) {
      return NextResponse.json(
        { error: "query and tenantId are required" },
        { status: 400 }
      );
    }

    let results;

    const searchOptions = { topK, filter };

    if (searchType === "hybrid") {
      results = await upstashVectorService.hybridSearch(
        query,
        tenantId,
        searchOptions
      );
    } else {
      results = await upstashVectorService.search(
        query,
        tenantId,
        searchOptions
      );
    }

    return NextResponse.json({
      success: true,
      results,
      searchType,
      count: results.length,
    });
  } catch (error) {
    console.error("Vector search error:", error);
    return NextResponse.json(
      { error: "Failed to perform vector search" },
      { status: 500 }
    );
  }
}

// PUT /api/vector - 문서 인덱싱
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, content, tenantId, metadata } = body;

    if (!documentId || !content || !tenantId) {
      return NextResponse.json(
        { error: "documentId, content, and tenantId are required" },
        { status: 400 }
      );
    }

    await upstashVectorService.indexDocument(
      tenantId,
      documentId,
      content,
      metadata || {}
    );

    return NextResponse.json({
      success: true,
      documentId,
      message: "Document indexed successfully",
    });
  } catch (error) {
    console.error("Vector index error:", error);
    return NextResponse.json(
      { error: "Failed to index document" },
      { status: 500 }
    );
  }
}

// DELETE /api/vector - 문서 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const tenantId = searchParams.get("tenantId");

    if (!documentId || !tenantId) {
      return NextResponse.json(
        { error: "documentId and tenantId are required" },
        { status: 400 }
      );
    }

    // 벡터 ID는 tenantId_documentId 형식
    await upstashVectorService.deleteVector(`${tenantId}_${documentId}`);

    return NextResponse.json({
      success: true,
      documentId,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Vector delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
