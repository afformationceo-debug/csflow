/**
 * SSO/SAML Authentication Service
 * Handles enterprise single sign-on authentication
 */

import { createServiceClient } from "@/lib/supabase/server";
import { auditLogService } from "./audit-log";

export type SSOProvider = "saml" | "oidc" | "google" | "microsoft" | "okta";

export interface SSOConfig {
  id: string;
  tenantId: string;
  provider: SSOProvider;
  isEnabled: boolean;
  name: string;
  // SAML Configuration
  saml?: {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
    signatureAlgorithm: "sha256" | "sha512";
    digestAlgorithm: "sha256" | "sha512";
    wantAssertionsSigned: boolean;
    wantAuthnResponseSigned: boolean;
    nameIdFormat: string;
    attributeMapping: {
      email: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      groups?: string;
    };
  };
  // OIDC Configuration
  oidc?: {
    clientId: string;
    clientSecret: string;
    issuer: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scopes: string[];
    attributeMapping: {
      email: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      groups?: string;
    };
  };
  // Domain restrictions
  allowedDomains: string[];
  autoProvision: boolean;
  defaultRole: "admin" | "manager" | "agent";
  groupMapping: Record<string, "admin" | "manager" | "agent">;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOSession {
  id: string;
  userId: string;
  tenantId: string;
  provider: SSOProvider;
  sessionIndex?: string;
  nameId?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SSOAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
  session?: SSOSession;
  error?: string;
  isNewUser?: boolean;
}

export interface SAMLAssertion {
  nameId: string;
  nameIdFormat: string;
  sessionIndex?: string;
  attributes: Record<string, string | string[]>;
  issuer: string;
  audience: string;
  notBefore: Date;
  notOnOrAfter: Date;
}

/**
 * SSO Authentication Service
 */
export const ssoAuthService = {
  /**
   * Get SSO configuration for tenant
   */
  async getConfig(tenantId: string): Promise<SSOConfig | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("sso_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true)
      .single();

    if (!data) return null;

    return this.mapSSOConfig(data);
  },

  /**
   * Get SSO configuration by domain
   */
  async getConfigByDomain(emailDomain: string): Promise<SSOConfig | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("sso_configs")
      .select("*")
      .eq("is_enabled", true)
      .contains("allowed_domains", [emailDomain]);

    if (!data || data.length === 0) return null;

    return this.mapSSOConfig(data[0]);
  },

  /**
   * Create or update SSO configuration
   */
  async upsertConfig(
    tenantId: string,
    config: Partial<Omit<SSOConfig, "id" | "tenantId" | "createdAt" | "updatedAt">>
  ): Promise<SSOConfig> {
    const supabase = await createServiceClient();

    const existing = await this.getConfig(tenantId);

    const payload = {
      tenant_id: tenantId,
      provider: config.provider || "saml",
      is_enabled: config.isEnabled ?? true,
      name: config.name || "Enterprise SSO",
      saml_config: config.saml || null,
      oidc_config: config.oidc || null,
      allowed_domains: config.allowedDomains || [],
      auto_provision: config.autoProvision ?? true,
      default_role: config.defaultRole || "agent",
      group_mapping: config.groupMapping || {},
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("sso_configs")
        .update(payload)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update SSO config: ${error.message}`);

      await auditLogService.log({
        tenantId,
        action: "tenant.settings_changed",
        description: "SSO configuration updated",
        metadata: { provider: config.provider },
      });

      return this.mapSSOConfig(data);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("sso_configs")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to create SSO config: ${error.message}`);

    await auditLogService.log({
      tenantId,
      action: "tenant.settings_changed",
      description: "SSO configuration created",
      metadata: { provider: config.provider },
    });

    return this.mapSSOConfig(data);
  },

  /**
   * Delete SSO configuration
   */
  async deleteConfig(tenantId: string): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("sso_configs")
      .delete()
      .eq("tenant_id", tenantId);

    await auditLogService.log({
      tenantId,
      action: "tenant.settings_changed",
      description: "SSO configuration deleted",
    });
  },

  /**
   * Generate SAML metadata
   */
  generateSAMLMetadata(tenantId: string): string {
    const entityId = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/${tenantId}`;
    const acsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/${tenantId}/callback`;
    const sloUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/${tenantId}/logout`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  },

  /**
   * Generate SAML authentication request
   */
  generateSAMLAuthRequest(
    config: SSOConfig,
    relayState?: string
  ): { url: string; requestId: string } {
    if (!config.saml) {
      throw new Error("SAML configuration not found");
    }

    const requestId = `_${crypto.randomUUID().replace(/-/g, "")}`;
    const issueInstant = new Date().toISOString();
    const entityId = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/${config.tenantId}`;
    const acsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/${config.tenantId}/callback`;

    const authRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    ID="${requestId}"
                    Version="2.0"
                    IssueInstant="${issueInstant}"
                    Destination="${config.saml.ssoUrl}"
                    AssertionConsumerServiceURL="${acsUrl}"
                    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="${config.saml.nameIdFormat}" AllowCreate="true"/>
</samlp:AuthnRequest>`;

    // Encode the request
    const encoded = Buffer.from(authRequest).toString("base64");
    const encodedRelayState = relayState
      ? `&RelayState=${encodeURIComponent(relayState)}`
      : "";

    return {
      url: `${config.saml.ssoUrl}?SAMLRequest=${encodeURIComponent(encoded)}${encodedRelayState}`,
      requestId,
    };
  },

  /**
   * Process SAML assertion and authenticate user
   */
  async processSAMLAssertion(
    tenantId: string,
    assertion: SAMLAssertion
  ): Promise<SSOAuthResult> {
    const config = await this.getConfig(tenantId);
    if (!config || !config.saml) {
      return { success: false, error: "SSO not configured" };
    }

    // Validate assertion
    const validationError = this.validateSAMLAssertion(assertion, config);
    if (validationError) {
      await auditLogService.log({
        tenantId,
        action: "auth.login_failed",
        description: `SAML assertion validation failed: ${validationError}`,
        severity: "warning",
        metadata: { issuer: assertion.issuer },
      });
      return { success: false, error: validationError };
    }

    // Extract user attributes
    const mapping = config.saml.attributeMapping;
    const email = this.extractAttribute(assertion.attributes, mapping.email);

    if (!email) {
      return { success: false, error: "Email not found in SAML assertion" };
    }

    // Check domain restriction
    const emailDomain = email.split("@")[1];
    if (
      config.allowedDomains.length > 0 &&
      !config.allowedDomains.includes(emailDomain)
    ) {
      await auditLogService.log({
        tenantId,
        action: "auth.login_failed",
        description: `Domain ${emailDomain} not allowed for SSO`,
        severity: "warning",
        metadata: { email, domain: emailDomain },
      });
      return { success: false, error: "Domain not allowed" };
    }

    const firstName = mapping.firstName
      ? this.extractAttribute(assertion.attributes, mapping.firstName)
      : undefined;
    const lastName = mapping.lastName
      ? this.extractAttribute(assertion.attributes, mapping.lastName)
      : undefined;
    const displayName = mapping.displayName
      ? this.extractAttribute(assertion.attributes, mapping.displayName)
      : undefined;
    const groups = mapping.groups
      ? this.extractAttributes(assertion.attributes, mapping.groups)
      : [];

    const name =
      displayName ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    // Determine role based on group mapping
    let role = config.defaultRole;
    for (const group of groups) {
      if (config.groupMapping[group]) {
        role = config.groupMapping[group];
        break;
      }
    }

    // Find or create user
    const supabase = await createServiceClient();
    let isNewUser = false;

    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    let user: { id: string; email: string; name: string; role: string };

    if (existingUser) {
      user = existingUser as typeof user;

      // Ensure user is linked to this tenant
      const existingTenantIds = (existingUser as { tenant_ids: string[] }).tenant_ids || [];
      if (!existingTenantIds.includes(tenantId)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("users")
          .update({
            tenant_ids: [...existingTenantIds, tenantId],
            last_login_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    } else if (config.autoProvision) {
      // Create new user
      isNewUser = true;
      const userId = crypto.randomUUID();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: createError } = await (supabase as any).from("users").insert({
        id: userId,
        email,
        name,
        role,
        tenant_ids: [tenantId],
        is_active: true,
        last_login_at: new Date().toISOString(),
      });

      if (createError) {
        return { success: false, error: `Failed to create user: ${createError.message}` };
      }

      user = { id: userId, email, name, role };

      await auditLogService.log({
        tenantId,
        userId: userId,
        action: "user.created",
        description: `User auto-provisioned via SSO`,
        metadata: { email, provider: config.provider },
      });
    } else {
      return { success: false, error: "User not found and auto-provisioning is disabled" };
    }

    // Create SSO session
    const session = await this.createSession({
      userId: user.id,
      tenantId,
      provider: config.provider,
      sessionIndex: assertion.sessionIndex,
      nameId: assertion.nameId,
      expiresAt: assertion.notOnOrAfter,
    });

    await auditLogService.log({
      tenantId,
      userId: user.id,
      action: "auth.login",
      description: `User logged in via SSO (${config.provider})`,
      metadata: {
        provider: config.provider,
        isNewUser,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId,
      },
      session,
      isNewUser,
    };
  },

  /**
   * Generate OIDC authorization URL
   */
  generateOIDCAuthUrl(
    config: SSOConfig,
    state: string,
    nonce: string
  ): string {
    if (!config.oidc) {
      throw new Error("OIDC configuration not found");
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oidc/${config.tenantId}/callback`;

    const params = new URLSearchParams({
      client_id: config.oidc.clientId,
      response_type: "code",
      scope: config.oidc.scopes.join(" "),
      redirect_uri: redirectUri,
      state,
      nonce,
    });

    return `${config.oidc.authorizationUrl}?${params.toString()}`;
  },

  /**
   * Exchange OIDC authorization code for tokens
   */
  async exchangeOIDCCode(
    config: SSOConfig,
    code: string
  ): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken?: string;
  }> {
    if (!config.oidc) {
      throw new Error("OIDC configuration not found");
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oidc/${config.tenantId}/callback`;

    const response = await fetch(config.oidc.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.oidc.clientId,
        client_secret: config.oidc.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange OIDC code");
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  },

  /**
   * Create SSO session
   */
  async createSession(input: {
    userId: string;
    tenantId: string;
    provider: SSOProvider;
    sessionIndex?: string;
    nameId?: string;
    expiresAt?: Date;
  }): Promise<SSOSession> {
    const supabase = await createServiceClient();

    const sessionId = crypto.randomUUID();
    const expiresAt = input.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("sso_sessions").insert({
      id: sessionId,
      user_id: input.userId,
      tenant_id: input.tenantId,
      provider: input.provider,
      session_index: input.sessionIndex,
      name_id: input.nameId,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

    return {
      id: sessionId,
      userId: input.userId,
      tenantId: input.tenantId,
      provider: input.provider,
      sessionIndex: input.sessionIndex,
      nameId: input.nameId,
      expiresAt,
      createdAt: new Date(),
    };
  },

  /**
   * Validate SSO session
   */
  async validateSession(sessionId: string): Promise<SSOSession | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("sso_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!data) return null;

    const session = data as {
      id: string;
      user_id: string;
      tenant_id: string;
      provider: SSOProvider;
      session_index?: string;
      name_id?: string;
      expires_at: string;
      created_at: string;
    };

    if (new Date(session.expires_at) < new Date()) {
      // Session expired
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sso_sessions").delete().eq("id", sessionId);
      return null;
    }

    return {
      id: session.id,
      userId: session.user_id,
      tenantId: session.tenant_id,
      provider: session.provider,
      sessionIndex: session.session_index,
      nameId: session.name_id,
      expiresAt: new Date(session.expires_at),
      createdAt: new Date(session.created_at),
    };
  },

  /**
   * End SSO session (logout)
   */
  async endSession(sessionId: string): Promise<void> {
    const supabase = await createServiceClient();

    const session = await this.validateSession(sessionId);
    if (session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sso_sessions").delete().eq("id", sessionId);

      await auditLogService.log({
        tenantId: session.tenantId,
        userId: session.userId,
        action: "auth.logout",
        description: `User logged out from SSO session`,
        metadata: { provider: session.provider },
      });
    }
  },

  /**
   * Validate SAML assertion
   */
  validateSAMLAssertion(
    assertion: SAMLAssertion,
    config: SSOConfig
  ): string | null {
    const now = new Date();

    // Check time validity
    if (assertion.notBefore && now < assertion.notBefore) {
      return "Assertion not yet valid";
    }

    if (assertion.notOnOrAfter && now > assertion.notOnOrAfter) {
      return "Assertion has expired";
    }

    // Check issuer
    if (config.saml && assertion.issuer !== config.saml.entityId) {
      return "Invalid issuer";
    }

    // Check audience
    const expectedAudience = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/${config.tenantId}`;
    if (assertion.audience !== expectedAudience) {
      return "Invalid audience";
    }

    return null;
  },

  /**
   * Extract single attribute from SAML attributes
   */
  extractAttribute(
    attributes: Record<string, string | string[]>,
    key: string
  ): string | undefined {
    const value = attributes[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  },

  /**
   * Extract multiple attributes from SAML attributes
   */
  extractAttributes(
    attributes: Record<string, string | string[]>,
    key: string
  ): string[] {
    const value = attributes[key];
    if (Array.isArray(value)) {
      return value;
    }
    return value ? [value] : [];
  },

  /**
   * Map database row to SSOConfig
   */
  mapSSOConfig(data: unknown): SSOConfig {
    const config = data as {
      id: string;
      tenant_id: string;
      provider: SSOProvider;
      is_enabled: boolean;
      name: string;
      saml_config: SSOConfig["saml"] | null;
      oidc_config: SSOConfig["oidc"] | null;
      allowed_domains: string[];
      auto_provision: boolean;
      default_role: SSOConfig["defaultRole"];
      group_mapping: SSOConfig["groupMapping"];
      created_at: string;
      updated_at: string;
    };

    return {
      id: config.id,
      tenantId: config.tenant_id,
      provider: config.provider,
      isEnabled: config.is_enabled,
      name: config.name,
      saml: config.saml_config || undefined,
      oidc: config.oidc_config || undefined,
      allowedDomains: config.allowed_domains,
      autoProvision: config.auto_provision,
      defaultRole: config.default_role,
      groupMapping: config.group_mapping,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at),
    };
  },
};

export default ssoAuthService;
