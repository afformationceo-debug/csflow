import { NextRequest, NextResponse } from "next/server";
import { metaOAuthService } from "@/services/meta-oauth";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * Meta OAuth Callback Handler
 * Handles the OAuth redirect from Facebook/Meta
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("Meta OAuth error:", error, errorDescription);
    const redirectUrl = new URL("/settings/channels", request.url);
    redirectUrl.searchParams.set("error", error);
    redirectUrl.searchParams.set(
      "error_description",
      errorDescription || "OAuth authentication failed"
    );
    return NextResponse.redirect(redirectUrl);
  }

  // Validate state parameter
  if (!state) {
    return NextResponse.redirect(
      new URL("/settings/channels?error=invalid_state", request.url)
    );
  }

  // Parse state to get tenantId and action
  let stateData: { tenantId: string; nonce: string };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64").toString());
  } catch {
    return NextResponse.redirect(
      new URL("/settings/channels?error=invalid_state", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/channels?error=no_code", request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await metaOAuthService.exchangeCodeForToken(code);

    // Get long-lived token
    const longLivedToken = await metaOAuthService.getLongLivedToken(
      tokenResponse.access_token
    );

    // Store the token temporarily for channel selection
    const supabase = await createServiceClient();
    const sessionId = crypto.randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("oauth_sessions").insert({
      id: sessionId,
      tenant_id: stateData.tenantId,
      provider: "meta",
      access_token: longLivedToken.access_token,
      expires_at: new Date(
        Date.now() + longLivedToken.expires_in * 1000
      ).toISOString(),
      created_at: new Date().toISOString(),
    });

    // Redirect to channel selection page
    const redirectUrl = new URL("/settings/channels/connect", request.url);
    redirectUrl.searchParams.set("session", sessionId);
    redirectUrl.searchParams.set("provider", "meta");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Meta OAuth error:", error);
    return NextResponse.redirect(
      new URL("/settings/channels?error=token_exchange_failed", request.url)
    );
  }
}

/**
 * Start Meta OAuth flow
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, scopes } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // Generate state with nonce for security
    const state = Buffer.from(
      JSON.stringify({
        tenantId,
        nonce: crypto.randomUUID(),
      })
    ).toString("base64");

    // Generate OAuth URL
    const authUrl = metaOAuthService.generateAuthUrl(state, scopes);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Failed to start OAuth:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 500 }
    );
  }
}
