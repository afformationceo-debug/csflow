/**
 * Calendar Sync Service
 * Integrates with Google Calendar and Naver Calendar for appointment management
 */

import { createServiceClient } from "@/lib/supabase/server";

// Types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: Array<{ email: string; name?: string }>;
  status: "confirmed" | "tentative" | "cancelled";
  reminders?: Array<{ method: "email" | "popup"; minutes: number }>;
  metadata?: Record<string, unknown>;
}

export interface CalendarSyncConfig {
  tenantId: string;
  provider: "google" | "naver";
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  syncEnabled: boolean;
  twoWaySync: boolean;
  defaultReminders: Array<{ method: "email" | "popup"; minutes: number }>;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: Array<{ bookingId: string; error: string }>;
}

// Google Calendar API integration
class GoogleCalendarClient {
  private accessToken: string;
  private calendarId: string;
  private baseUrl = "https://www.googleapis.com/calendar/v3";

  constructor(accessToken: string, calendarId: string = "primary") {
    this.accessToken = accessToken;
    this.calendarId = calendarId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Google Calendar API error");
    }

    return response.json();
  }

  async listEvents(
    timeMin: Date,
    timeMax: Date,
    maxResults: number = 100
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: maxResults.toString(),
      singleEvents: "true",
      orderBy: "startTime",
    });

    const data = await this.request<{
      items: Array<{
        id: string;
        summary: string;
        description?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
        attendees?: Array<{ email: string; displayName?: string }>;
        status: string;
      }>;
    }>(`/calendars/${this.calendarId}/events?${params}`);

    return data.items.map((item) => ({
      id: item.id,
      title: item.summary,
      description: item.description,
      startTime: new Date(item.start.dateTime || item.start.date || ""),
      endTime: new Date(item.end.dateTime || item.end.date || ""),
      location: item.location,
      attendees: item.attendees?.map((a) => ({
        email: a.email,
        name: a.displayName,
      })),
      status: item.status as CalendarEvent["status"],
    }));
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const body = {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
      location: event.location,
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.name,
      })),
      reminders: event.reminders
        ? {
            useDefault: false,
            overrides: event.reminders.map((r) => ({
              method: r.method,
              minutes: r.minutes,
            })),
          }
        : { useDefault: true },
    };

    const data = await this.request<{
      id: string;
      summary: string;
      start: { dateTime: string };
      end: { dateTime: string };
      status: string;
    }>(`/calendars/${this.calendarId}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      title: data.summary,
      startTime: new Date(data.start.dateTime),
      endTime: new Date(data.end.dateTime),
      status: data.status as CalendarEvent["status"],
    };
  }

  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {};
    if (event.title) body.summary = event.title;
    if (event.description) body.description = event.description;
    if (event.startTime) body.start = { dateTime: event.startTime.toISOString() };
    if (event.endTime) body.end = { dateTime: event.endTime.toISOString() };
    if (event.location) body.location = event.location;
    if (event.status) body.status = event.status;

    const data = await this.request<{
      id: string;
      summary: string;
      start: { dateTime: string };
      end: { dateTime: string };
      status: string;
    }>(`/calendars/${this.calendarId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      title: data.summary,
      startTime: new Date(data.start.dateTime),
      endTime: new Date(data.end.dateTime),
      status: data.status as CalendarEvent["status"],
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`/calendars/${this.calendarId}/events/${eventId}`, {
      method: "DELETE",
    });
  }
}

// Naver Calendar API integration (placeholder - requires OAuth setup)
class NaverCalendarClient {
  private accessToken: string;
  private calendarId: string;
  private baseUrl = "https://openapi.naver.com/calendar/v2";

  constructor(accessToken: string, calendarId: string) {
    this.accessToken = accessToken;
    this.calendarId = calendarId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error("Naver Calendar API error");
    }

    return response.json();
  }

  async listEvents(
    timeMin: Date,
    timeMax: Date,
    maxResults: number = 100
  ): Promise<CalendarEvent[]> {
    // Naver Calendar API implementation
    // This is a placeholder - actual implementation depends on Naver's API
    const params = new URLSearchParams({
      calendarId: this.calendarId,
      startDt: timeMin.toISOString().split("T")[0],
      endDt: timeMax.toISOString().split("T")[0],
    });

    try {
      const data = await this.request<{
        result: {
          returnValue: Array<{
            uid: string;
            summary: string;
            description?: string;
            startDt: string;
            endDt: string;
            location?: string;
          }>;
        };
      }>(`/schedule?${params}`);

      return data.result.returnValue.map((item) => ({
        id: item.uid,
        title: item.summary,
        description: item.description,
        startTime: new Date(item.startDt),
        endTime: new Date(item.endDt),
        location: item.location,
        status: "confirmed" as const,
      }));
    } catch {
      console.warn("Naver Calendar API not fully implemented");
      return [];
    }
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    // Placeholder implementation
    return {
      id: `naver-${Date.now()}`,
      ...event,
    };
  }

  async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    // Placeholder implementation
    return {
      id: eventId,
      title: event.title || "",
      startTime: event.startTime || new Date(),
      endTime: event.endTime || new Date(),
      status: event.status || "confirmed",
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    // Placeholder implementation
    console.log(`Delete Naver calendar event: ${eventId}`);
  }
}

/**
 * Calendar Sync Service
 */
export class CalendarSyncService {
  /**
   * Get calendar client based on provider
   */
  private getClient(config: CalendarSyncConfig) {
    switch (config.provider) {
      case "google":
        return new GoogleCalendarClient(config.accessToken, config.calendarId);
      case "naver":
        return new NaverCalendarClient(config.accessToken, config.calendarId);
      default:
        throw new Error(`Unsupported calendar provider: ${config.provider}`);
    }
  }

  /**
   * Sync bookings to external calendar
   */
  async syncBookingsToCalendar(
    tenantId: string,
    config: CalendarSyncConfig
  ): Promise<SyncResult> {
    const supabase = await createServiceClient();
    const client = this.getClient(config);
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

    // Get all bookings for tenant
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        *,
        customer:customers(name, language)
      `)
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", new Date().toISOString());

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`);
    }

    for (const booking of bookings || []) {
      try {
        const eventData: Omit<CalendarEvent, "id"> = {
          title: `${(booking.customer as { name?: string })?.name || "고객"} - ${booking.service_type || "상담"}`,
          description: booking.notes || "",
          startTime: new Date(booking.scheduled_at),
          endTime: new Date(
            new Date(booking.scheduled_at).getTime() + (booking.duration_minutes || 60) * 60 * 1000
          ),
          status: booking.status === "cancelled" ? "cancelled" : "confirmed",
          reminders: config.defaultReminders,
          metadata: {
            bookingId: booking.id,
            customerId: booking.customer_id,
          },
        };

        const calendarEventId = (booking.metadata as { calendar_event_id?: string })?.calendar_event_id;

        if (calendarEventId) {
          // Update existing event
          await client.updateEvent(calendarEventId, eventData);
          result.updated++;
        } else {
          // Create new event
          const event = await client.createEvent(eventData);

          // Store calendar event ID in booking metadata
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("bookings")
            .update({
              metadata: {
                ...(booking.metadata as object),
                calendar_event_id: event.id,
                calendar_provider: config.provider,
              },
            })
            .eq("id", booking.id);

          result.created++;
        }
      } catch (err) {
        result.errors.push({
          bookingId: booking.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Sync calendar events to bookings (two-way sync)
   */
  async syncCalendarToBookings(
    tenantId: string,
    config: CalendarSyncConfig
  ): Promise<SyncResult> {
    if (!config.twoWaySync) {
      return { created: 0, updated: 0, deleted: 0, errors: [] };
    }

    const supabase = await createServiceClient();
    const client = this.getClient(config);
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

    // Get calendar events
    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const events = await client.listEvents(now, threeMonthsLater);

    // Get existing bookings with calendar IDs
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("id, metadata")
      .eq("tenant_id", tenantId);

    // Type cast for bookings data
    const bookings = bookingsData as Array<{ id: string; metadata: { calendar_event_id?: string } | null }> | null;

    const existingEventIds = new Set(
      bookings
        ?.map((b) => b.metadata?.calendar_event_id)
        .filter(Boolean) || []
    );

    for (const event of events) {
      try {
        if (!existingEventIds.has(event.id)) {
          // Check if this looks like a booking (has our metadata pattern)
          // In a real implementation, you'd have better detection
          if (event.metadata?.bookingId) {
            // Update existing booking if modified in calendar
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("bookings")
              .update({
                scheduled_at: event.startTime.toISOString(),
                status: event.status === "cancelled" ? "cancelled" : "confirmed",
              })
              .eq("id", event.metadata.bookingId as string);
            result.updated++;
          }
        }
      } catch (err) {
        result.errors.push({
          bookingId: event.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Handle calendar conflict detection
   */
  async checkConflicts(
    config: CalendarSyncConfig,
    proposedTime: Date,
    durationMinutes: number
  ): Promise<{
    hasConflict: boolean;
    conflictingEvents: CalendarEvent[];
    suggestedTimes: Date[];
  }> {
    const client = this.getClient(config);

    // Check window around proposed time
    const windowStart = new Date(proposedTime.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(
      proposedTime.getTime() + (durationMinutes + 60) * 60 * 1000
    );

    const events = await client.listEvents(windowStart, windowEnd);

    const proposedEnd = new Date(
      proposedTime.getTime() + durationMinutes * 60 * 1000
    );

    const conflictingEvents = events.filter((event) => {
      // Check for overlap
      return (
        (proposedTime >= event.startTime && proposedTime < event.endTime) ||
        (proposedEnd > event.startTime && proposedEnd <= event.endTime) ||
        (proposedTime <= event.startTime && proposedEnd >= event.endTime)
      );
    });

    // Suggest alternative times
    const suggestedTimes: Date[] = [];
    if (conflictingEvents.length > 0) {
      // Suggest times after conflicting events
      for (const event of conflictingEvents) {
        const afterEvent = new Date(event.endTime.getTime() + 15 * 60 * 1000);
        suggestedTimes.push(afterEvent);
      }

      // Suggest same time next day
      const nextDay = new Date(proposedTime);
      nextDay.setDate(nextDay.getDate() + 1);
      suggestedTimes.push(nextDay);
    }

    return {
      hasConflict: conflictingEvents.length > 0,
      conflictingEvents,
      suggestedTimes: suggestedTimes.slice(0, 3),
    };
  }

  /**
   * Setup Google Calendar OAuth
   */
  getGoogleOAuthUrl(tenantId: string, redirectUri: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const params = new URLSearchParams({
      client_id: clientId || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: tenantId,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeGoogleCode(
    code: string,
    redirectUri: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Refresh access token
   */
  async refreshGoogleToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }
}

export const calendarSyncService = new CalendarSyncService();
