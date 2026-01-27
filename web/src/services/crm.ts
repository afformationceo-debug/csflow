/**
 * CRM API Integration Service
 *
 * This service integrates with the client's existing CRM system via REST API.
 * The actual API endpoints will be configured once the CRM API documentation is provided.
 */

// CRM Types
export interface CRMCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CRMBooking {
  id: string;
  customerId: string;
  serviceType: string;
  bookingDate: string;
  bookingTime?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMNote {
  id: string;
  customerId: string;
  content: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
}

// CRM API Client Configuration
interface CRMConfig {
  baseUrl: string;
  apiKey: string;
}

function getCRMConfig(): CRMConfig {
  return {
    baseUrl: process.env.CRM_API_BASE_URL || "",
    apiKey: process.env.CRM_API_KEY || "",
  };
}

async function crmFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getCRMConfig();

  if (!config.baseUrl) {
    throw new Error("CRM API base URL not configured");
  }

  const response = await fetch(`${config.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CRM API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * CRM API Service
 */
export const crmService = {
  // ============================================
  // Customer Management
  // ============================================

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<CRMCustomer | null> {
    try {
      return await crmFetch<CRMCustomer>(`/customers/${customerId}`);
    } catch (error) {
      console.error("Failed to get CRM customer:", error);
      return null;
    }
  },

  /**
   * Search customers
   */
  async searchCustomers(query: {
    phone?: string;
    email?: string;
    name?: string;
  }): Promise<CRMCustomer[]> {
    try {
      const params = new URLSearchParams();
      if (query.phone) params.append("phone", query.phone);
      if (query.email) params.append("email", query.email);
      if (query.name) params.append("name", query.name);

      return await crmFetch<CRMCustomer[]>(`/customers?${params.toString()}`);
    } catch (error) {
      console.error("Failed to search CRM customers:", error);
      return [];
    }
  },

  /**
   * Create a new customer
   */
  async createCustomer(data: {
    name: string;
    phone?: string;
    email?: string;
    country?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CRMCustomer> {
    return crmFetch<CRMCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<Omit<CRMCustomer, "id" | "createdAt" | "updatedAt">>
  ): Promise<CRMCustomer> {
    return crmFetch<CRMCustomer>(`/customers/${customerId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // ============================================
  // Booking Management
  // ============================================

  /**
   * Get bookings for a customer
   */
  async getCustomerBookings(customerId: string): Promise<CRMBooking[]> {
    try {
      return await crmFetch<CRMBooking[]>(`/customers/${customerId}/bookings`);
    } catch (error) {
      console.error("Failed to get customer bookings:", error);
      return [];
    }
  },

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string): Promise<CRMBooking | null> {
    try {
      return await crmFetch<CRMBooking>(`/bookings/${bookingId}`);
    } catch (error) {
      console.error("Failed to get booking:", error);
      return null;
    }
  },

  /**
   * Create a new booking
   */
  async createBooking(data: {
    customerId: string;
    serviceType: string;
    bookingDate: string;
    bookingTime?: string;
    notes?: string;
  }): Promise<CRMBooking> {
    return crmFetch<CRMBooking>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update booking
   */
  async updateBooking(
    bookingId: string,
    data: Partial<Omit<CRMBooking, "id" | "customerId" | "createdAt" | "updatedAt">>
  ): Promise<CRMBooking> {
    return crmFetch<CRMBooking>(`/bookings/${bookingId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    await crmFetch(`/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  // ============================================
  // Notes Management
  // ============================================

  /**
   * Get notes for a customer
   */
  async getCustomerNotes(customerId: string): Promise<CRMNote[]> {
    try {
      return await crmFetch<CRMNote[]>(`/customers/${customerId}/notes`);
    } catch (error) {
      console.error("Failed to get customer notes:", error);
      return [];
    }
  },

  /**
   * Add note to customer
   */
  async addNote(
    customerId: string,
    content: string,
    authorId?: string,
    authorName?: string
  ): Promise<CRMNote> {
    return crmFetch<CRMNote>(`/customers/${customerId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content, authorId, authorName }),
    });
  },

  // ============================================
  // Sync Helpers
  // ============================================

  /**
   * Sync customer from CS platform to CRM
   * Creates customer if doesn't exist, updates if exists
   */
  async syncCustomer(data: {
    externalId: string; // CS platform customer ID
    name?: string;
    phone?: string;
    email?: string;
    country?: string;
  }): Promise<CRMCustomer> {
    // First, try to find existing customer by phone or email
    if (data.phone || data.email) {
      const existing = await this.searchCustomers({
        phone: data.phone,
        email: data.email,
      });

      if (existing.length > 0) {
        // Update existing customer
        return this.updateCustomer(existing[0].id, {
          name: data.name,
          country: data.country,
          metadata: { csExternalId: data.externalId },
        });
      }
    }

    // Create new customer
    return this.createCustomer({
      name: data.name || "Unknown",
      phone: data.phone,
      email: data.email,
      country: data.country,
      metadata: { csExternalId: data.externalId },
    });
  },

  /**
   * Create booking from AI conversation
   */
  async createBookingFromConversation(data: {
    crmCustomerId: string;
    serviceType: string;
    preferredDate: string;
    preferredTime?: string;
    conversationId: string;
    notes?: string;
  }): Promise<CRMBooking> {
    const booking = await this.createBooking({
      customerId: data.crmCustomerId,
      serviceType: data.serviceType,
      bookingDate: data.preferredDate,
      bookingTime: data.preferredTime,
      notes: data.notes
        ? `${data.notes}\n\n[CS 자동화 플랫폼에서 생성 - 대화 ID: ${data.conversationId}]`
        : `[CS 자동화 플랫폼에서 생성 - 대화 ID: ${data.conversationId}]`,
    });

    return booking;
  },

  /**
   * Check API health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const config = getCRMConfig();
      if (!config.baseUrl) return false;

      const response = await fetch(`${config.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  },
};

export default crmService;
