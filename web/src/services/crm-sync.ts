/**
 * CRM Sync Service
 * Handles bidirectional synchronization between CS platform and CRM
 */

import { createServiceClient } from "@/lib/supabase/server";
import { crmService, CRMCustomer, CRMBooking, CRMNote } from "./crm";
import { enqueueJob } from "@/lib/upstash/qstash";

export interface SyncResult {
  success: boolean;
  action: "created" | "updated" | "skipped";
  crmId?: string;
  error?: string;
}

export interface CustomerSyncData {
  csCustomerId: string;
  name?: string;
  phone?: string;
  email?: string;
  country?: string;
  language?: string;
  consultationTag?: string;
  tags?: string[];
}

export interface BookingSyncData {
  crmCustomerId: string;
  csConversationId?: string;
  serviceType: string;
  bookingDate: string;
  bookingTime?: string;
  status?: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string;
}

/**
 * CRM Sync Service
 */
export const crmSyncService = {
  /**
   * Sync customer from CS platform to CRM
   */
  async syncCustomerToCRM(data: CustomerSyncData): Promise<SyncResult> {
    const supabase = await createServiceClient();

    try {
      // Check if customer already has CRM ID
      const { data: csCustomer } = await supabase
        .from("customers")
        .select("crm_external_id")
        .eq("id", data.csCustomerId)
        .single();

      const existingCrmId = (csCustomer as { crm_external_id?: string } | null)
        ?.crm_external_id;

      let crmCustomer: CRMCustomer;
      let action: "created" | "updated";

      if (existingCrmId) {
        // Update existing CRM customer
        crmCustomer = await crmService.updateCustomer(existingCrmId, {
          name: data.name,
          phone: data.phone,
          email: data.email,
          country: data.country,
          metadata: {
            csCustomerId: data.csCustomerId,
            language: data.language,
            consultationTag: data.consultationTag,
            tags: data.tags,
          },
        });
        action = "updated";
      } else {
        // Try to find existing by phone/email or create new
        crmCustomer = await crmService.syncCustomer({
          externalId: data.csCustomerId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          country: data.country,
        });
        action = "created";

        // Store CRM ID in CS platform
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("customers")
          .update({ crm_external_id: crmCustomer.id })
          .eq("id", data.csCustomerId);
      }

      return {
        success: true,
        action,
        crmId: crmCustomer.id,
      };
    } catch (error) {
      console.error("Customer sync to CRM failed:", error);
      return {
        success: false,
        action: "skipped",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Sync booking from CS platform to CRM
   */
  async syncBookingToCRM(data: BookingSyncData): Promise<SyncResult> {
    try {
      const booking = await crmService.createBooking({
        customerId: data.crmCustomerId,
        serviceType: data.serviceType,
        bookingDate: data.bookingDate,
        bookingTime: data.bookingTime,
        notes: data.notes
          ? `${data.notes}${data.csConversationId ? `\n\n[CS 대화 ID: ${data.csConversationId}]` : ""}`
          : data.csConversationId
            ? `[CS 대화 ID: ${data.csConversationId}]`
            : undefined,
      });

      return {
        success: true,
        action: "created",
        crmId: booking.id,
      };
    } catch (error) {
      console.error("Booking sync to CRM failed:", error);
      return {
        success: false,
        action: "skipped",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Sync conversation notes to CRM
   */
  async syncNotesToCRM(
    crmCustomerId: string,
    conversationId: string,
    notes: Array<{ content: string; author?: string; createdAt: string }>
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const note of notes) {
      try {
        const crmNote = await crmService.addNote(
          crmCustomerId,
          `[CS 대화 ${conversationId}] ${note.content}`,
          undefined,
          note.author
        );

        results.push({
          success: true,
          action: "created",
          crmId: crmNote.id,
        });
      } catch (error) {
        results.push({
          success: false,
          action: "skipped",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },

  /**
   * Pull customer data from CRM to CS platform
   */
  async pullCustomerFromCRM(crmCustomerId: string): Promise<{
    success: boolean;
    customer?: CRMCustomer;
    bookings?: CRMBooking[];
    notes?: CRMNote[];
    error?: string;
  }> {
    try {
      // Fetch all customer data from CRM
      const [customer, bookings, notes] = await Promise.all([
        crmService.getCustomer(crmCustomerId),
        crmService.getCustomerBookings(crmCustomerId),
        crmService.getCustomerNotes(crmCustomerId),
      ]);

      if (!customer) {
        return { success: false, error: "Customer not found in CRM" };
      }

      return {
        success: true,
        customer,
        bookings,
        notes,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Trigger sync on conversation resolution
   */
  async onConversationResolved(conversationId: string): Promise<void> {
    const supabase = await createServiceClient();

    // Get conversation with customer and notes
    const { data: conversation } = await supabase
      .from("conversations")
      .select(`
        *,
        customer:customers(*),
        internal_notes(*)
      `)
      .eq("id", conversationId)
      .single();

    if (!conversation) return;

    const conv = conversation as unknown as {
      tenant_id: string;
      customer: {
        id: string;
        name?: string;
        phone?: string;
        email?: string;
        country?: string;
        language?: string;
        consultation_tag?: string;
        tags?: string[];
        crm_external_id?: string;
      };
      internal_notes: Array<{
        content: string;
        created_by?: string;
        created_at: string;
      }>;
    };

    // Sync customer to CRM
    const customerResult = await this.syncCustomerToCRM({
      csCustomerId: conv.customer.id,
      name: conv.customer.name,
      phone: conv.customer.phone,
      email: conv.customer.email,
      country: conv.customer.country,
      language: conv.customer.language,
      consultationTag: conv.customer.consultation_tag,
      tags: conv.customer.tags,
    });

    // Sync notes if customer sync was successful
    if (customerResult.success && customerResult.crmId && conv.internal_notes.length > 0) {
      await this.syncNotesToCRM(
        customerResult.crmId,
        conversationId,
        conv.internal_notes.map((n) => ({
          content: n.content,
          author: n.created_by,
          createdAt: n.created_at,
        }))
      );
    }
  },

  /**
   * Trigger sync on booking confirmation
   */
  async onBookingConfirmed(
    csConversationId: string,
    crmCustomerId: string,
    bookingData: {
      serviceType: string;
      bookingDate: string;
      bookingTime?: string;
      notes?: string;
    }
  ): Promise<SyncResult> {
    return this.syncBookingToCRM({
      crmCustomerId,
      csConversationId,
      ...bookingData,
    });
  },

  /**
   * Schedule periodic full sync
   */
  async scheduleFullSync(tenantId: string): Promise<void> {
    await enqueueJob({
      type: "crm_full_sync",
      data: { tenantId },
      delay: 0,
    });
  },

  /**
   * Execute full sync for a tenant
   */
  async executeFullSync(tenantId: string): Promise<{
    customersProcessed: number;
    customersSynced: number;
    errors: number;
  }> {
    const supabase = await createServiceClient();

    // Get all customers without CRM ID
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("crm_external_id", null);

    let synced = 0;
    let errors = 0;

    for (const customer of (customers || []) as Array<{
      id: string;
      name?: string;
      phone?: string;
      email?: string;
      country?: string;
      language?: string;
      consultation_tag?: string;
      tags?: string[];
    }>) {
      const result = await this.syncCustomerToCRM({
        csCustomerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        country: customer.country,
        language: customer.language,
        consultationTag: customer.consultation_tag,
        tags: customer.tags,
      });

      if (result.success) {
        synced++;
      } else {
        errors++;
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      customersProcessed: (customers || []).length,
      customersSynced: synced,
      errors,
    };
  },

  /**
   * Get sync status for a customer
   */
  async getSyncStatus(csCustomerId: string): Promise<{
    isSynced: boolean;
    crmId?: string;
    lastSyncAt?: Date;
    crmData?: CRMCustomer | null;
  }> {
    const supabase = await createServiceClient();

    const { data: customer } = await supabase
      .from("customers")
      .select("crm_external_id, crm_synced_at")
      .eq("id", csCustomerId)
      .single();

    const custData = customer as {
      crm_external_id?: string;
      crm_synced_at?: string;
    } | null;

    if (!custData?.crm_external_id) {
      return { isSynced: false };
    }

    // Fetch current CRM data
    const crmData = await crmService.getCustomer(custData.crm_external_id);

    return {
      isSynced: true,
      crmId: custData.crm_external_id,
      lastSyncAt: custData.crm_synced_at
        ? new Date(custData.crm_synced_at)
        : undefined,
      crmData,
    };
  },

  /**
   * Handle CRM webhook (for bidirectional sync)
   */
  async handleCRMWebhook(
    event: "customer.updated" | "booking.created" | "booking.updated",
    data: unknown
  ): Promise<void> {
    const supabase = await createServiceClient();

    switch (event) {
      case "customer.updated": {
        const customer = data as CRMCustomer;

        // Find CS customer by CRM ID
        const { data: csCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("crm_external_id", customer.id)
          .single();

        if (csCustomer) {
          // Update CS customer with CRM data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("customers")
            .update({
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              country: customer.country,
              crm_synced_at: new Date().toISOString(),
            })
            .eq("id", (csCustomer as { id: string }).id);
        }
        break;
      }

      case "booking.created":
      case "booking.updated": {
        // Store booking reference in CS platform if needed
        // This could trigger automation rules for booking follow-ups
        const booking = data as CRMBooking;

        await enqueueJob({
          type: "process_crm_booking",
          data: {
            crmBookingId: booking.id,
            crmCustomerId: booking.customerId,
            status: booking.status,
            bookingDate: booking.bookingDate,
          },
        });
        break;
      }
    }
  },
};

export default crmSyncService;
