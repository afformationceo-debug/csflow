/**
 * Automation Rule Engine Types
 */

import { ChannelType } from "@/lib/supabase/types";

/**
 * Trigger events that can start an automation
 */
export type AutomationTrigger =
  | "message_received" // When a customer sends a message
  | "conversation_created" // When a new conversation starts
  | "conversation_status_changed" // When conversation status changes
  | "booking_confirmed" // When a booking is confirmed
  | "booking_cancelled" // When a booking is cancelled
  | "visit_day_before" // 1 day before scheduled visit
  | "visit_completed" // After visit/treatment completed
  | "no_response_24h" // No agent response for 24 hours
  | "no_response_48h" // No agent response for 48 hours
  | "customer_idle_7d" // Customer inactive for 7 days
  | "escalation_created" // When escalation is created
  | "escalation_resolved" // When escalation is resolved
  | "tag_added" // When a tag is added to customer
  | "schedule_cron"; // Scheduled cron job

/**
 * Condition operators for rule matching
 */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "in_list"
  | "not_in_list"
  | "is_empty"
  | "is_not_empty"
  | "regex_match";

/**
 * Fields that can be used in conditions
 */
export type ConditionField =
  | "customer.language"
  | "customer.country"
  | "customer.tags"
  | "customer.consultation_tag"
  | "customer.vip_status"
  | "conversation.status"
  | "conversation.channel_type"
  | "conversation.assigned_to"
  | "conversation.ai_enabled"
  | "message.content"
  | "message.content_type"
  | "message.sentiment"
  | "booking.status"
  | "booking.type"
  | "booking.date"
  | "time.hour"
  | "time.day_of_week"
  | "time.is_working_hours";

/**
 * Single condition for rule matching
 */
export interface AutomationCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
}

/**
 * Condition group with AND/OR logic
 */
export interface ConditionGroup {
  logic: "and" | "or";
  conditions: (AutomationCondition | ConditionGroup)[];
}

/**
 * Action types that can be executed
 */
export type ActionType =
  | "send_message" // Send message to customer
  | "send_internal_note" // Create internal note
  | "send_notification" // Send notification to team (Slack, KakaoTalk, etc.)
  | "assign_conversation" // Assign to specific agent
  | "update_conversation_status" // Change conversation status
  | "add_customer_tag" // Add tag to customer
  | "remove_customer_tag" // Remove tag from customer
  | "update_consultation_tag" // Update consultation tag
  | "create_crm_booking" // Create booking in CRM
  | "update_crm_customer" // Update customer in CRM
  | "add_crm_note" // Add note to CRM
  | "send_satisfaction_survey" // Send satisfaction survey
  | "create_escalation" // Create escalation
  | "trigger_webhook" // Call external webhook
  | "delay" // Wait before next action
  | "branch"; // Conditional branch

/**
 * Action configuration
 */
export interface AutomationAction {
  type: ActionType;
  config: ActionConfig;
}

/**
 * Action-specific configurations
 */
export type ActionConfig =
  | SendMessageConfig
  | SendInternalNoteConfig
  | SendNotificationConfig
  | AssignConversationConfig
  | UpdateConversationStatusConfig
  | AddCustomerTagConfig
  | RemoveCustomerTagConfig
  | UpdateConsultationTagConfig
  | CreateCRMBookingConfig
  | UpdateCRMCustomerConfig
  | AddCRMNoteConfig
  | SendSatisfactionSurveyConfig
  | CreateEscalationConfig
  | TriggerWebhookConfig
  | DelayConfig
  | BranchConfig;

export interface SendMessageConfig {
  type: "send_message";
  template: string; // Template with {{variables}}
  channel?: ChannelType; // Use original channel if not specified
  translateToCustomerLanguage?: boolean;
}

export interface SendInternalNoteConfig {
  type: "send_internal_note";
  content: string;
  mentionUsers?: string[]; // User IDs to mention
}

export interface SendNotificationConfig {
  type: "send_notification";
  channel: "slack" | "kakao_alimtalk" | "email" | "sms";
  template: string;
  recipients: string[] | "assigned_agent" | "all_agents";
}

export interface AssignConversationConfig {
  type: "assign_conversation";
  assignTo: string | "round_robin" | "least_busy" | "previous_agent";
}

export interface UpdateConversationStatusConfig {
  type: "update_conversation_status";
  status: "active" | "waiting" | "resolved" | "escalated";
}

export interface AddCustomerTagConfig {
  type: "add_customer_tag";
  tag: string;
}

export interface RemoveCustomerTagConfig {
  type: "remove_customer_tag";
  tag: string;
}

export interface UpdateConsultationTagConfig {
  type: "update_consultation_tag";
  tag: "prospect" | "potential" | "first_booking" | "confirmed" | "completed" | "cancelled";
}

export interface CreateCRMBookingConfig {
  type: "create_crm_booking";
  bookingType: string;
  scheduledDate?: string; // Template with variables
  notes?: string;
}

export interface UpdateCRMCustomerConfig {
  type: "update_crm_customer";
  fields: Record<string, string>;
}

export interface AddCRMNoteConfig {
  type: "add_crm_note";
  content: string;
}

export interface SendSatisfactionSurveyConfig {
  type: "send_satisfaction_survey";
  surveyTemplate: string;
  delayMinutes?: number;
}

export interface CreateEscalationConfig {
  type: "create_escalation";
  reason: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface TriggerWebhookConfig {
  type: "trigger_webhook";
  url: string;
  method: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: string; // Template with variables
}

export interface DelayConfig {
  type: "delay";
  duration: number;
  unit: "seconds" | "minutes" | "hours" | "days";
}

export interface BranchConfig {
  type: "branch";
  conditions: ConditionGroup;
  trueActions: AutomationAction[];
  falseActions: AutomationAction[];
}

/**
 * Automation Rule
 */
export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number; // Lower number = higher priority

  // Trigger configuration
  trigger: AutomationTrigger;
  triggerConfig?: {
    cron?: string; // For schedule_cron trigger
    statusFrom?: string; // For status_changed triggers
    statusTo?: string;
  };

  // Conditions (optional, all rules match if not specified)
  conditions?: ConditionGroup;

  // Actions to execute
  actions: AutomationAction[];

  // Execution limits
  maxExecutionsPerConversation?: number;
  cooldownMinutes?: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastExecutedAt?: Date;
  executionCount: number;
}

/**
 * Rule execution context
 */
export interface ExecutionContext {
  tenantId: string;
  trigger: AutomationTrigger;

  // Entity IDs
  conversationId?: string;
  customerId?: string;
  messageId?: string;
  bookingId?: string;
  escalationId?: string;

  // Loaded data (populated during execution)
  customer?: {
    id: string;
    name?: string;
    language?: string;
    country?: string;
    tags?: string[];
    consultationTag?: string;
    email?: string;
    phone?: string;
  };

  conversation?: {
    id: string;
    status: string;
    channelType: ChannelType;
    assignedTo?: string;
    aiEnabled: boolean;
    channelAccountId: string;
    channelUserId: string;
  };

  message?: {
    id: string;
    content?: string;
    contentType: string;
  };

  booking?: {
    id: string;
    status: string;
    type?: string;
    scheduledDate?: Date;
  };

  // Variables for template interpolation
  variables: Record<string, unknown>;
}

/**
 * Rule execution result
 */
export interface ExecutionResult {
  ruleId: string;
  success: boolean;
  actionsExecuted: number;
  error?: string;
  duration: number;
  actionResults: {
    actionType: ActionType;
    success: boolean;
    error?: string;
  }[];
}
