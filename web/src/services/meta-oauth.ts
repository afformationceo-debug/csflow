/**
 * Meta OAuth Service
 * Handles OAuth authentication flow for Facebook, Instagram, and WhatsApp
 */

import { createServiceClient } from "@/lib/supabase/server";

// Meta OAuth Types
interface MetaOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds (usually 60 days)
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: {
    data: {
      url: string;
    };
  };
  instagram_business_account?: {
    id: string;
    username?: string;
  };
}

interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

interface InstagramBusinessAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

interface WhatsAppBusinessAccount {
  id: string;
  name: string;
  phone_numbers?: {
    data: {
      id: string;
      display_phone_number: string;
      verified_name: string;
      quality_rating: string;
    }[];
  };
}

interface ConnectedChannel {
  channelType: "facebook" | "instagram" | "whatsapp";
  accountId: string;
  accountName: string;
  accessToken: string;
  profilePictureUrl?: string;
  metadata?: Record<string, unknown>;
}

const GRAPH_API_VERSION = "v18.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

class MetaOAuthService {
  private config: MetaOAuthConfig;

  constructor() {
    this.config = {
      appId: process.env.FACEBOOK_APP_ID || "",
      appSecret: process.env.FACEBOOK_APP_SECRET || "",
      redirectUri: process.env.META_OAUTH_REDIRECT_URI || "",
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(
    state: string,
    scopes: string[] = [
      "pages_show_list",
      "pages_messaging",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "whatsapp_business_management",
      "whatsapp_business_messaging",
    ]
  ): string {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: scopes.join(","),
      response_type: "code",
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      redirect_uri: this.config.redirectUri,
      code,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to exchange code: ${error.error?.message || response.status}`
      );
    }

    return response.json();
  }

  /**
   * Exchange short-lived token for long-lived token
   */
  async getLongLivedToken(
    shortLivedToken: string
  ): Promise<MetaLongLivedTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to get long-lived token: ${error.error?.message || response.status}`
      );
    }

    return response.json();
  }

  /**
   * Get Facebook pages the user has access to
   */
  async getFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,category,picture,instagram_business_account&access_token=${userAccessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to get pages: ${error.error?.message || response.status}`
      );
    }

    const data: FacebookPagesResponse = await response.json();
    return data.data;
  }

  /**
   * Get Instagram business accounts linked to Facebook pages
   */
  async getInstagramAccounts(
    userAccessToken: string
  ): Promise<InstagramBusinessAccount[]> {
    const pages = await this.getFacebookPages(userAccessToken);
    const instagramAccounts: InstagramBusinessAccount[] = [];

    for (const page of pages) {
      if (page.instagram_business_account) {
        try {
          const response = await fetch(
            `${GRAPH_API_BASE}/${page.instagram_business_account.id}?fields=id,username,name,profile_picture_url,followers_count&access_token=${page.access_token}`
          );

          if (response.ok) {
            const igAccount: InstagramBusinessAccount = await response.json();
            instagramAccounts.push(igAccount);
          }
        } catch (error) {
          console.error(
            `Failed to fetch Instagram account for page ${page.id}:`,
            error
          );
        }
      }
    }

    return instagramAccounts;
  }

  /**
   * Get WhatsApp Business accounts
   */
  async getWhatsAppBusinessAccounts(
    userAccessToken: string
  ): Promise<WhatsAppBusinessAccount[]> {
    // Get the user's business accounts
    const response = await fetch(
      `${GRAPH_API_BASE}/me/businesses?fields=id,name&access_token=${userAccessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to get businesses: ${error.error?.message || response.status}`
      );
    }

    const businesses = await response.json();
    const whatsAppAccounts: WhatsAppBusinessAccount[] = [];

    // For each business, get WhatsApp Business accounts
    for (const business of businesses.data || []) {
      try {
        const wabaResponse = await fetch(
          `${GRAPH_API_BASE}/${business.id}/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}&access_token=${userAccessToken}`
        );

        if (wabaResponse.ok) {
          const wabaData = await wabaResponse.json();
          whatsAppAccounts.push(...(wabaData.data || []));
        }
      } catch (error) {
        console.error(
          `Failed to fetch WhatsApp accounts for business ${business.id}:`,
          error
        );
      }
    }

    return whatsAppAccounts;
  }

  /**
   * Get all available channels for connection
   */
  async getAvailableChannels(userAccessToken: string): Promise<{
    facebook: FacebookPage[];
    instagram: InstagramBusinessAccount[];
    whatsapp: WhatsAppBusinessAccount[];
  }> {
    const [facebook, instagram, whatsapp] = await Promise.all([
      this.getFacebookPages(userAccessToken),
      this.getInstagramAccounts(userAccessToken),
      this.getWhatsAppBusinessAccounts(userAccessToken),
    ]);

    return { facebook, instagram, whatsapp };
  }

  /**
   * Connect a Facebook page as a channel
   */
  async connectFacebookPage(
    tenantId: string,
    page: FacebookPage
  ): Promise<ConnectedChannel> {
    const supabase = await createServiceClient();

    // Get long-lived page access token
    const longLivedToken = await this.getLongLivedToken(page.access_token);

    // Save channel account to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("channel_accounts").upsert(
      {
        tenant_id: tenantId,
        channel_type: "facebook",
        account_id: page.id,
        account_name: page.name,
        credentials: {
          page_access_token: longLivedToken.access_token,
          app_secret: this.config.appSecret,
          expires_at: new Date(
            Date.now() + longLivedToken.expires_in * 1000
          ).toISOString(),
        },
        is_active: true,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
      },
      {
        onConflict: "tenant_id,channel_type,account_id",
      }
    );

    if (error) throw error;

    return {
      channelType: "facebook",
      accountId: page.id,
      accountName: page.name,
      accessToken: longLivedToken.access_token,
      profilePictureUrl: page.picture?.data?.url,
    };
  }

  /**
   * Connect an Instagram account as a channel
   */
  async connectInstagramAccount(
    tenantId: string,
    account: InstagramBusinessAccount,
    pageAccessToken: string
  ): Promise<ConnectedChannel> {
    const supabase = await createServiceClient();

    // Get long-lived token
    const longLivedToken = await this.getLongLivedToken(pageAccessToken);

    // Save channel account to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("channel_accounts").upsert(
      {
        tenant_id: tenantId,
        channel_type: "instagram",
        account_id: account.id,
        account_name: account.username || account.name || account.id,
        credentials: {
          access_token: longLivedToken.access_token,
          app_secret: this.config.appSecret,
          expires_at: new Date(
            Date.now() + longLivedToken.expires_in * 1000
          ).toISOString(),
        },
        is_active: true,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
      },
      {
        onConflict: "tenant_id,channel_type,account_id",
      }
    );

    if (error) throw error;

    return {
      channelType: "instagram",
      accountId: account.id,
      accountName: account.username || account.id,
      accessToken: longLivedToken.access_token,
      profilePictureUrl: account.profile_picture_url,
    };
  }

  /**
   * Connect a WhatsApp Business account as a channel
   */
  async connectWhatsAppAccount(
    tenantId: string,
    account: WhatsAppBusinessAccount,
    phoneNumberId: string,
    systemUserAccessToken: string
  ): Promise<ConnectedChannel> {
    const supabase = await createServiceClient();

    const phoneNumber = account.phone_numbers?.data?.find(
      (p) => p.id === phoneNumberId
    );

    // Save channel account to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("channel_accounts").upsert(
      {
        tenant_id: tenantId,
        channel_type: "whatsapp",
        account_id: phoneNumberId,
        account_name:
          phoneNumber?.verified_name ||
          phoneNumber?.display_phone_number ||
          account.name,
        credentials: {
          system_user_access_token: systemUserAccessToken,
          waba_id: account.id,
          phone_number_id: phoneNumberId,
          app_secret: this.config.appSecret,
        },
        is_active: true,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
      },
      {
        onConflict: "tenant_id,channel_type,account_id",
      }
    );

    if (error) throw error;

    return {
      channelType: "whatsapp",
      accountId: phoneNumberId,
      accountName:
        phoneNumber?.display_phone_number || account.name || phoneNumberId,
      accessToken: systemUserAccessToken,
      metadata: {
        wabaId: account.id,
        verifiedName: phoneNumber?.verified_name,
        qualityRating: phoneNumber?.quality_rating,
      },
    };
  }

  /**
   * Subscribe a page to webhook events
   */
  async subscribeToWebhook(
    pageId: string,
    pageAccessToken: string,
    fields: string[] = ["messages", "messaging_postbacks", "message_reads"]
  ): Promise<boolean> {
    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscribed_fields: fields,
          access_token: pageAccessToken,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to subscribe to webhook:", error);
      return false;
    }

    return true;
  }

  /**
   * Disconnect a channel
   */
  async disconnectChannel(
    tenantId: string,
    channelType: "facebook" | "instagram" | "whatsapp",
    accountId: string
  ): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("channel_accounts")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .eq("channel_type", channelType)
      .eq("account_id", accountId);

    if (error) throw error;
  }

  /**
   * Get connected channels for a tenant
   */
  async getConnectedChannels(tenantId: string): Promise<
    {
      id: string;
      channelType: "facebook" | "instagram" | "whatsapp" | "line" | "kakao";
      accountId: string;
      accountName: string;
      isActive: boolean;
      createdAt: string;
    }[]
  > {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("channel_accounts")
      .select("id, channel_type, account_id, account_name, is_active, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((channel) => ({
      id: channel.id,
      channelType: channel.channel_type as "facebook" | "instagram" | "whatsapp" | "line" | "kakao",
      accountId: channel.account_id,
      accountName: channel.account_name,
      isActive: channel.is_active,
      createdAt: channel.created_at,
    }));
  }

  /**
   * Refresh access token before expiry
   */
  async refreshAccessToken(
    channelAccountId: string
  ): Promise<{ success: boolean; newExpiresAt?: string }> {
    const supabase = await createServiceClient();

    // Get current credentials
    const { data: channelData, error: fetchError } = await supabase
      .from("channel_accounts")
      .select("credentials, channel_type")
      .eq("id", channelAccountId)
      .single();

    if (fetchError || !channelData) {
      return { success: false };
    }

    // Type cast for channel data
    const channel = channelData as { credentials: Record<string, unknown>; channel_type: string };
    const credentials = channel.credentials as {
      page_access_token?: string;
      access_token?: string;
    };
    const currentToken =
      credentials.page_access_token || credentials.access_token;

    if (!currentToken) {
      return { success: false };
    }

    try {
      // Get new long-lived token
      const newToken = await this.getLongLivedToken(currentToken);

      // Update credentials
      const newCredentials = {
        ...credentials,
        [credentials.page_access_token
          ? "page_access_token"
          : "access_token"]: newToken.access_token,
        expires_at: new Date(
          Date.now() + newToken.expires_in * 1000
        ).toISOString(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("channel_accounts")
        .update({ credentials: newCredentials })
        .eq("id", channelAccountId);

      if (updateError) {
        return { success: false };
      }

      return {
        success: true,
        newExpiresAt: newCredentials.expires_at,
      };
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return { success: false };
    }
  }

  /**
   * Verify app configuration
   */
  async verifyConfiguration(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!this.config.appId) {
      errors.push("FACEBOOK_APP_ID is not configured");
    }
    if (!this.config.appSecret) {
      errors.push("FACEBOOK_APP_SECRET is not configured");
    }
    if (!this.config.redirectUri) {
      errors.push("META_OAUTH_REDIRECT_URI is not configured");
    }

    // Try to verify app access
    if (this.config.appId && this.config.appSecret) {
      try {
        const response = await fetch(
          `${GRAPH_API_BASE}/${this.config.appId}?access_token=${this.config.appId}|${this.config.appSecret}`
        );

        if (!response.ok) {
          errors.push("Invalid Facebook App ID or App Secret");
        }
      } catch {
        errors.push("Failed to connect to Meta Graph API");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const metaOAuthService = new MetaOAuthService();
