/**
 * Whitelabel Service
 * Customizable branding and theming for tenants
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface WhitelabelConfig {
  id: string;
  tenantId: string;
  // Brand Identity
  branding: {
    companyName: string;
    logoUrl: string | null;
    logoLightUrl: string | null; // For dark backgrounds
    faviconUrl: string | null;
    tagline: string | null;
  };
  // Theme Configuration
  theme: ThemeConfig;
  // Custom Domain
  customDomain: {
    domain: string | null;
    sslEnabled: boolean;
    verificationStatus: "pending" | "verified" | "failed";
    verificationToken: string | null;
  };
  // Email Configuration
  emailConfig: {
    fromName: string;
    fromEmail: string | null;
    replyToEmail: string | null;
    customSMTP: {
      enabled: boolean;
      host: string | null;
      port: number | null;
      username: string | null;
      useSSL: boolean;
    };
    templates: {
      welcomeSubject: string;
      welcomeBody: string | null;
      footerText: string | null;
    };
  };
  // Widget/Chat Configuration
  widgetConfig: {
    enabled: boolean;
    position: "bottom-right" | "bottom-left";
    primaryColor: string;
    headerText: string;
    placeholderText: string;
    offlineMessage: string;
    showPoweredBy: boolean;
    customCSS: string | null;
  };
  // Feature Toggles
  features: {
    showBrandingInChat: boolean;
    customLoginPage: boolean;
    whitelabelReports: boolean;
    hideSystemBranding: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ThemeConfig {
  mode: "light" | "dark" | "system";
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    input: string;
    ring: string;
  };
  darkColors?: ThemeConfig["colors"];
  typography: {
    fontFamily: string;
    headingFontFamily: string | null;
    fontSize: "sm" | "base" | "lg";
    borderRadius: "none" | "sm" | "md" | "lg" | "full";
  };
}

export interface WidgetEmbed {
  tenantId: string;
  scriptUrl: string;
  iframeUrl: string;
  embedCode: string;
}

/**
 * Whitelabel Service
 */
export const whitelabelService = {
  /**
   * Get whitelabel configuration
   */
  async getConfig(tenantId: string): Promise<WhitelabelConfig | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("whitelabel_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (!data) {
      return this.getDefaultConfig(tenantId);
    }

    return this.mapConfig(data);
  },

  /**
   * Get whitelabel configuration by custom domain
   */
  async getConfigByDomain(domain: string): Promise<WhitelabelConfig | null> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("whitelabel_configs")
      .select("*")
      .eq("custom_domain->>domain", domain)
      .eq("custom_domain->>verificationStatus", "verified")
      .single();

    if (!data) return null;
    return this.mapConfig(data);
  },

  /**
   * Update whitelabel configuration
   */
  async updateConfig(
    tenantId: string,
    updates: Partial<Omit<WhitelabelConfig, "id" | "tenantId" | "createdAt" | "updatedAt">>
  ): Promise<WhitelabelConfig> {
    const supabase = await createServiceClient();

    const existing = await this.getConfig(tenantId);

    const payload = {
      tenant_id: tenantId,
      branding: updates.branding || existing?.branding || this.getDefaultConfig(tenantId).branding,
      theme: updates.theme || existing?.theme || this.getDefaultConfig(tenantId).theme,
      custom_domain: updates.customDomain || existing?.customDomain || this.getDefaultConfig(tenantId).customDomain,
      email_config: updates.emailConfig || existing?.emailConfig || this.getDefaultConfig(tenantId).emailConfig,
      widget_config: updates.widgetConfig || existing?.widgetConfig || this.getDefaultConfig(tenantId).widgetConfig,
      features: updates.features || existing?.features || this.getDefaultConfig(tenantId).features,
      updated_at: new Date().toISOString(),
    };

    if (existing && existing.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("whitelabel_configs")
        .update(payload)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update config: ${error.message}`);
      return this.mapConfig(data);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("whitelabel_configs")
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to create config: ${error.message}`);
    return this.mapConfig(data);
  },

  /**
   * Verify custom domain
   */
  async verifyDomain(tenantId: string): Promise<{
    verified: boolean;
    error?: string;
  }> {
    const config = await this.getConfig(tenantId);
    if (!config?.customDomain.domain) {
      return { verified: false, error: "No custom domain configured" };
    }

    const domain = config.customDomain.domain;
    const token = config.customDomain.verificationToken;

    // Check TXT record
    try {
      const dns = await import("dns").then((m) => m.promises);
      const records = await dns.resolveTxt(`_cs-verify.${domain}`);
      const verified = records.some((r) => r.includes(token || ""));

      if (verified) {
        await this.updateConfig(tenantId, {
          customDomain: {
            ...config.customDomain,
            verificationStatus: "verified",
          },
        });
        return { verified: true };
      }

      await this.updateConfig(tenantId, {
        customDomain: {
          ...config.customDomain,
          verificationStatus: "failed",
        },
      });
      return { verified: false, error: "DNS verification failed" };
    } catch (error) {
      await this.updateConfig(tenantId, {
        customDomain: {
          ...config.customDomain,
          verificationStatus: "failed",
        },
      });
      return {
        verified: false,
        error: error instanceof Error ? error.message : "DNS lookup failed",
      };
    }
  },

  /**
   * Generate CSS variables from theme
   */
  generateCSSVariables(theme: ThemeConfig): string {
    const { colors, typography } = theme;

    const cssVars = Object.entries(colors)
      .map(([key, value]) => {
        const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `  --${kebabKey}: ${value};`;
      })
      .join("\n");

    const darkCssVars = theme.darkColors
      ? Object.entries(theme.darkColors)
          .map(([key, value]) => {
            const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            return `  --${kebabKey}: ${value};`;
          })
          .join("\n")
      : "";

    const fontVars = `
  --font-sans: ${typography.fontFamily};
  --font-heading: ${typography.headingFontFamily || typography.fontFamily};
`;

    const radiusMap = {
      none: "0",
      sm: "0.25rem",
      md: "0.5rem",
      lg: "0.75rem",
      full: "9999px",
    };

    return `:root {
${cssVars}
${fontVars}
  --radius: ${radiusMap[typography.borderRadius]};
}

${
  darkCssVars
    ? `.dark {
${darkCssVars}
}`
    : ""
}`;
  },

  /**
   * Get widget embed code
   */
  getWidgetEmbed(tenantId: string): WidgetEmbed {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com";

    const scriptUrl = `${baseUrl}/widget/${tenantId}/loader.js`;
    const iframeUrl = `${baseUrl}/widget/${tenantId}`;

    const embedCode = `<!-- CS Automation Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['CSChat']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','cschat','${scriptUrl}'));
  cschat('init', { tenantId: '${tenantId}' });
</script>`;

    return {
      tenantId,
      scriptUrl,
      iframeUrl,
      embedCode,
    };
  },

  /**
   * Generate widget loader script
   */
  generateWidgetLoader(config: WhitelabelConfig): string {
    const { widgetConfig, branding, theme } = config;

    return `(function() {
  var w = window;
  var d = document;

  // Create widget container
  var container = d.createElement('div');
  container.id = 'cs-chat-widget';
  container.style.cssText = 'position:fixed;${
    widgetConfig.position === "bottom-right" ? "right:20px" : "left:20px"
  };bottom:20px;z-index:999999;';

  // Create toggle button
  var button = d.createElement('button');
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  button.style.cssText = 'width:56px;height:56px;border-radius:50%;border:none;background:${widgetConfig.primaryColor};color:white;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;';

  // Create iframe
  var iframe = d.createElement('iframe');
  iframe.src = '${process.env.NEXT_PUBLIC_APP_URL}/widget/${config.tenantId}';
  iframe.style.cssText = 'width:380px;height:520px;border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);display:none;';

  var isOpen = false;
  button.onclick = function() {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    button.style.display = isOpen ? 'none' : 'flex';
  };

  // Close button message handler
  w.addEventListener('message', function(e) {
    if (e.data === 'cs-widget-close') {
      isOpen = false;
      iframe.style.display = 'none';
      button.style.display = 'flex';
    }
  });

  container.appendChild(iframe);
  container.appendChild(button);
  d.body.appendChild(container);

  ${widgetConfig.customCSS ? `// Custom CSS\nvar style = d.createElement('style');style.textContent = ${JSON.stringify(widgetConfig.customCSS)};d.head.appendChild(style);` : ""}
})();`;
  },

  /**
   * Get email template with branding
   */
  getEmailTemplate(
    config: WhitelabelConfig,
    type: "welcome" | "notification" | "report"
  ): {
    subject: string;
    html: string;
    text: string;
  } {
    const { branding, emailConfig, theme } = config;

    const baseStyles = `
      body { font-family: ${theme.typography.fontFamily}, Arial, sans-serif; }
      .header { background: ${theme.colors.primary}; color: ${theme.colors.primaryForeground}; padding: 20px; text-align: center; }
      .content { padding: 20px; }
      .footer { padding: 20px; text-align: center; color: ${theme.colors.mutedForeground}; font-size: 12px; }
      .button { background: ${theme.colors.primary}; color: ${theme.colors.primaryForeground}; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
    `;

    const header = `
      <div class="header">
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.companyName}" style="max-height: 40px;">` : ""}
        <h1 style="margin: 10px 0 0 0; font-size: 20px;">${branding.companyName}</h1>
      </div>
    `;

    const footer = `
      <div class="footer">
        <p>${emailConfig.templates.footerText || `© ${new Date().getFullYear()} ${branding.companyName}. All rights reserved.`}</p>
      </div>
    `;

    const templates: Record<string, { subject: string; body: string }> = {
      welcome: {
        subject: emailConfig.templates.welcomeSubject || `Welcome to ${branding.companyName}`,
        body:
          emailConfig.templates.welcomeBody ||
          `
          <p>Welcome to ${branding.companyName}!</p>
          <p>We're excited to have you on board. Click the button below to get started.</p>
          <p><a href="{{loginUrl}}" class="button">Get Started</a></p>
        `,
      },
      notification: {
        subject: "New notification from {{companyName}}",
        body: `
          <p>You have a new notification:</p>
          <p>{{notificationContent}}</p>
          <p><a href="{{actionUrl}}" class="button">View Details</a></p>
        `,
      },
      report: {
        subject: "Your {{reportPeriod}} Report from {{companyName}}",
        body: `
          <p>Here's your report for {{reportPeriod}}:</p>
          <div>{{reportContent}}</div>
          <p><a href="{{reportUrl}}" class="button">View Full Report</a></p>
        `,
      },
    };

    const template = templates[type];

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${baseStyles}</style>
        </head>
        <body>
          ${header}
          <div class="content">
            ${template.body}
          </div>
          ${footer}
        </body>
      </html>
    `;

    // Generate plain text version
    const text = template.body
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return {
      subject: template.subject.replace("{{companyName}}", branding.companyName),
      html,
      text,
    };
  },

  /**
   * Get default configuration
   */
  getDefaultConfig(tenantId: string): WhitelabelConfig {
    return {
      id: "",
      tenantId,
      branding: {
        companyName: "CS Automation",
        logoUrl: null,
        logoLightUrl: null,
        faviconUrl: null,
        tagline: null,
      },
      theme: this.getDefaultTheme(),
      customDomain: {
        domain: null,
        sslEnabled: false,
        verificationStatus: "pending",
        verificationToken: crypto.randomUUID(),
      },
      emailConfig: {
        fromName: "CS Automation",
        fromEmail: null,
        replyToEmail: null,
        customSMTP: {
          enabled: false,
          host: null,
          port: null,
          username: null,
          useSSL: true,
        },
        templates: {
          welcomeSubject: "Welcome!",
          welcomeBody: null,
          footerText: null,
        },
      },
      widgetConfig: {
        enabled: true,
        position: "bottom-right",
        primaryColor: "#2563eb",
        headerText: "How can we help?",
        placeholderText: "Type your message...",
        offlineMessage: "We're currently offline. Leave a message and we'll get back to you.",
        showPoweredBy: true,
        customCSS: null,
      },
      features: {
        showBrandingInChat: true,
        customLoginPage: false,
        whitelabelReports: false,
        hideSystemBranding: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Get default theme
   */
  getDefaultTheme(): ThemeConfig {
    return {
      mode: "light",
      colors: {
        primary: "#2563eb",
        primaryForeground: "#ffffff",
        secondary: "#64748b",
        secondaryForeground: "#ffffff",
        accent: "#f1f5f9",
        accentForeground: "#0f172a",
        destructive: "#ef4444",
        destructiveForeground: "#ffffff",
        background: "#ffffff",
        foreground: "#0f172a",
        card: "#ffffff",
        cardForeground: "#0f172a",
        popover: "#ffffff",
        popoverForeground: "#0f172a",
        muted: "#f1f5f9",
        mutedForeground: "#64748b",
        border: "#e2e8f0",
        input: "#e2e8f0",
        ring: "#2563eb",
      },
      darkColors: {
        primary: "#3b82f6",
        primaryForeground: "#ffffff",
        secondary: "#475569",
        secondaryForeground: "#ffffff",
        accent: "#1e293b",
        accentForeground: "#f8fafc",
        destructive: "#ef4444",
        destructiveForeground: "#ffffff",
        background: "#0f172a",
        foreground: "#f8fafc",
        card: "#1e293b",
        cardForeground: "#f8fafc",
        popover: "#1e293b",
        popoverForeground: "#f8fafc",
        muted: "#1e293b",
        mutedForeground: "#94a3b8",
        border: "#334155",
        input: "#334155",
        ring: "#3b82f6",
      },
      typography: {
        fontFamily: "Inter, system-ui, sans-serif",
        headingFontFamily: null,
        fontSize: "base",
        borderRadius: "md",
      },
    };
  },

  /**
   * Map database row to config
   */
  mapConfig(data: unknown): WhitelabelConfig {
    const row = data as {
      id: string;
      tenant_id: string;
      branding: WhitelabelConfig["branding"];
      theme: ThemeConfig;
      custom_domain: WhitelabelConfig["customDomain"];
      email_config: WhitelabelConfig["emailConfig"];
      widget_config: WhitelabelConfig["widgetConfig"];
      features: WhitelabelConfig["features"];
      created_at: string;
      updated_at: string;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      branding: row.branding,
      theme: row.theme,
      customDomain: row.custom_domain,
      emailConfig: row.email_config,
      widgetConfig: row.widget_config,
      features: row.features,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },
};

export default whitelabelService;
