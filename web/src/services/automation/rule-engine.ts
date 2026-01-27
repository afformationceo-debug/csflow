/**
 * Automation Rule Engine
 * Evaluates and executes automation rules based on triggers and conditions
 */

import { createServiceClient } from "@/lib/supabase/server";
import { enqueueJob } from "@/lib/upstash/qstash";
import {
  AutomationRule,
  AutomationTrigger,
  ExecutionContext,
  ExecutionResult,
  ConditionGroup,
  AutomationCondition,
  AutomationAction,
  ConditionOperator,
} from "./types";

/**
 * Rule Engine - Core automation processing
 */
class RuleEngine {
  /**
   * Process a trigger event and execute matching rules
   */
  async processTrigger(
    trigger: AutomationTrigger,
    context: Partial<ExecutionContext>
  ): Promise<ExecutionResult[]> {
    const supabase = await createServiceClient();
    const results: ExecutionResult[] = [];

    if (!context.tenantId) {
      console.error("Tenant ID required for automation processing");
      return results;
    }

    // Load matching rules
    const { data: rules, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("trigger", trigger)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (error) {
      console.error("Failed to load automation rules:", error);
      return results;
    }

    if (!rules || rules.length === 0) {
      return results;
    }

    // Enrich context with full data
    const fullContext = await this.enrichContext(context as ExecutionContext);

    // Process each rule
    for (const ruleData of rules) {
      const rule = this.parseRule(ruleData);

      try {
        // Check execution limits
        if (!(await this.canExecute(rule, fullContext))) {
          continue;
        }

        // Evaluate conditions
        if (!this.evaluateConditions(rule.conditions, fullContext)) {
          continue;
        }

        // Execute actions
        const result = await this.executeRule(rule, fullContext);
        results.push(result);

        // Update rule execution stats
        await this.updateRuleStats(rule.id);
      } catch (error) {
        console.error(`Error executing rule ${rule.id}:`, error);
        results.push({
          ruleId: rule.id,
          success: false,
          actionsExecuted: 0,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: 0,
          actionResults: [],
        });
      }
    }

    return results;
  }

  /**
   * Enrich context with full entity data
   */
  private async enrichContext(
    context: ExecutionContext
  ): Promise<ExecutionContext> {
    const supabase = await createServiceClient();

    // Load customer data
    if (context.customerId && !context.customer) {
      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", context.customerId)
        .single();

      // Type cast for customer data
      const customer = customerData as {
        id: string;
        name?: string;
        language?: string;
        country?: string;
        tags?: string[];
        consultation_tag?: string;
        email?: string;
        phone?: string;
      } | null;

      if (customer) {
        context.customer = {
          id: customer.id,
          name: customer.name,
          language: customer.language,
          country: customer.country,
          tags: customer.tags || [],
          consultationTag: customer.consultation_tag,
          email: customer.email,
          phone: customer.phone,
        };
      }
    }

    // Load conversation data
    if (context.conversationId && !context.conversation) {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("*, customer_channel:customer_channels(*)")
        .eq("id", context.conversationId)
        .single();

      if (conversation) {
        const conv = conversation as unknown as {
          id: string;
          status: string;
          assigned_to?: string;
          ai_enabled: boolean;
          customer_channel: {
            channel_type: string;
            channel_account_id: string;
            channel_user_id: string;
          };
        };
        context.conversation = {
          id: conv.id,
          status: conv.status,
          channelType: conv.customer_channel?.channel_type as ExecutionContext["conversation"] extends { channelType: infer T } ? T : never,
          assignedTo: conv.assigned_to,
          aiEnabled: conv.ai_enabled,
          channelAccountId: conv.customer_channel?.channel_account_id,
          channelUserId: conv.customer_channel?.channel_user_id,
        };
      }
    }

    // Load message data
    if (context.messageId && !context.message) {
      const { data: message } = await supabase
        .from("messages")
        .select("*")
        .eq("id", context.messageId)
        .single();

      if (message) {
        context.message = {
          id: (message as { id: string }).id,
          content: (message as { content?: string }).content,
          contentType: (message as { content_type: string }).content_type,
        };
      }
    }

    // Build variables for template interpolation
    context.variables = this.buildVariables(context);

    return context;
  }

  /**
   * Build template variables from context
   */
  private buildVariables(context: ExecutionContext): Record<string, unknown> {
    return {
      customer_name: context.customer?.name || "고객님",
      customer_language: context.customer?.language || "KO",
      customer_country: context.customer?.country || "",
      consultation_tag: context.customer?.consultationTag || "",
      conversation_status: context.conversation?.status || "",
      channel_type: context.conversation?.channelType || "",
      message_content: context.message?.content || "",
      booking_date: context.booking?.scheduledDate?.toLocaleDateString("ko-KR") || "",
      booking_type: context.booking?.type || "",
      current_date: new Date().toLocaleDateString("ko-KR"),
      current_time: new Date().toLocaleTimeString("ko-KR"),
    };
  }

  /**
   * Check if rule can be executed (limits, cooldown)
   */
  private async canExecute(
    rule: AutomationRule,
    context: ExecutionContext
  ): Promise<boolean> {
    if (!context.conversationId) return true;

    const supabase = await createServiceClient();

    // Check execution count for this conversation
    if (rule.maxExecutionsPerConversation) {
      const { count } = await supabase
        .from("automation_executions")
        .select("*", { count: "exact", head: true })
        .eq("rule_id", rule.id)
        .eq("conversation_id", context.conversationId);

      if (count && count >= rule.maxExecutionsPerConversation) {
        return false;
      }
    }

    // Check cooldown
    if (rule.cooldownMinutes) {
      const { data: lastExecution } = await supabase
        .from("automation_executions")
        .select("created_at")
        .eq("rule_id", rule.id)
        .eq("conversation_id", context.conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastExecution) {
        const lastTime = new Date((lastExecution as { created_at: string }).created_at);
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastTime.getTime() < cooldownMs) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate condition group
   */
  private evaluateConditions(
    conditions: ConditionGroup | undefined,
    context: ExecutionContext
  ): boolean {
    if (!conditions) return true;

    const results = conditions.conditions.map((cond) => {
      if ("logic" in cond) {
        return this.evaluateConditions(cond, context);
      }
      return this.evaluateSingleCondition(cond, context);
    });

    if (conditions.logic === "and") {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Evaluate single condition
   */
  private evaluateSingleCondition(
    condition: AutomationCondition,
    context: ExecutionContext
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);
    const compareValue = condition.value;

    return this.compare(fieldValue, condition.operator, compareValue);
  }

  /**
   * Get field value from context
   */
  private getFieldValue(
    field: string,
    context: ExecutionContext
  ): unknown {
    const [entity, property] = field.split(".");

    switch (entity) {
      case "customer":
        return context.customer?.[property as keyof typeof context.customer];
      case "conversation":
        return context.conversation?.[property as keyof typeof context.conversation];
      case "message":
        return context.message?.[property as keyof typeof context.message];
      case "booking":
        return context.booking?.[property as keyof typeof context.booking];
      case "time":
        return this.getTimeValue(property);
      default:
        return undefined;
    }
  }

  /**
   * Get time-related values
   */
  private getTimeValue(property: string): unknown {
    const now = new Date();

    switch (property) {
      case "hour":
        return now.getHours();
      case "day_of_week":
        return now.getDay();
      case "is_working_hours":
        const hour = now.getHours();
        const day = now.getDay();
        return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
      default:
        return undefined;
    }
  }

  /**
   * Compare values using operator
   */
  private compare(
    fieldValue: unknown,
    operator: ConditionOperator,
    compareValue: unknown
  ): boolean {
    switch (operator) {
      case "equals":
        return fieldValue === compareValue;

      case "not_equals":
        return fieldValue !== compareValue;

      case "contains":
        if (typeof fieldValue === "string" && typeof compareValue === "string") {
          return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(compareValue);
        }
        return false;

      case "not_contains":
        return !this.compare(fieldValue, "contains", compareValue);

      case "starts_with":
        return (
          typeof fieldValue === "string" &&
          typeof compareValue === "string" &&
          fieldValue.toLowerCase().startsWith(compareValue.toLowerCase())
        );

      case "ends_with":
        return (
          typeof fieldValue === "string" &&
          typeof compareValue === "string" &&
          fieldValue.toLowerCase().endsWith(compareValue.toLowerCase())
        );

      case "greater_than":
        return Number(fieldValue) > Number(compareValue);

      case "less_than":
        return Number(fieldValue) < Number(compareValue);

      case "in_list":
        if (Array.isArray(compareValue)) {
          return compareValue.includes(fieldValue);
        }
        return false;

      case "not_in_list":
        return !this.compare(fieldValue, "in_list", compareValue);

      case "is_empty":
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === "" ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );

      case "is_not_empty":
        return !this.compare(fieldValue, "is_empty", compareValue);

      case "regex_match":
        if (typeof fieldValue === "string" && typeof compareValue === "string") {
          try {
            return new RegExp(compareValue).test(fieldValue);
          } catch {
            return false;
          }
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Execute rule actions
   */
  private async executeRule(
    rule: AutomationRule,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const actionResults: ExecutionResult["actionResults"] = [];

    for (const action of rule.actions) {
      try {
        await this.executeAction(action, context);
        actionResults.push({
          actionType: action.type,
          success: true,
        });
      } catch (error) {
        actionResults.push({
          actionType: action.type,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log execution
    await this.logExecution(rule.id, context, actionResults);

    return {
      ruleId: rule.id,
      success: actionResults.every((r) => r.success),
      actionsExecuted: actionResults.filter((r) => r.success).length,
      duration: Date.now() - startTime,
      actionResults,
    };
  }

  /**
   * Execute single action
   */
  private async executeAction(
    action: AutomationAction,
    context: ExecutionContext
  ): Promise<void> {
    switch (action.type) {
      case "send_message":
        await this.executeSendMessage(action.config as { template: string; translateToCustomerLanguage?: boolean }, context);
        break;

      case "send_notification":
        await this.executeSendNotification(
          action.config as { channel: string; template: string; recipients: string[] | string },
          context
        );
        break;

      case "update_conversation_status":
        await this.executeUpdateConversationStatus(
          action.config as { status: string },
          context
        );
        break;

      case "add_customer_tag":
        await this.executeAddCustomerTag(
          action.config as { tag: string },
          context
        );
        break;

      case "update_consultation_tag":
        await this.executeUpdateConsultationTag(
          action.config as { tag: string },
          context
        );
        break;

      case "create_escalation":
        await this.executeCreateEscalation(
          action.config as { reason: string; priority: string },
          context
        );
        break;

      case "send_satisfaction_survey":
        await this.executeSendSatisfactionSurvey(
          action.config as { surveyTemplate: string; delayMinutes?: number },
          context
        );
        break;

      case "delay":
        await this.executeDelay(
          action.config as { duration: number; unit: string }
        );
        break;

      case "trigger_webhook":
        await this.executeTriggerWebhook(
          action.config as { url: string; method: string; headers?: Record<string, string>; body?: string },
          context
        );
        break;

      default:
        console.warn(`Unhandled action type: ${action.type}`);
    }
  }

  /**
   * Execute send_message action
   */
  private async executeSendMessage(
    config: { template: string; translateToCustomerLanguage?: boolean },
    context: ExecutionContext
  ): Promise<void> {
    if (!context.conversation) {
      throw new Error("Conversation required for send_message action");
    }

    const message = this.interpolateTemplate(config.template, context.variables);

    await enqueueJob({
      type: "send_message",
      data: {
        channelType: context.conversation.channelType,
        channelAccountId: context.conversation.channelAccountId,
        channelUserId: context.conversation.channelUserId,
        content: message,
        translateToCustomerLanguage: config.translateToCustomerLanguage,
        customerLanguage: context.customer?.language,
      },
    });
  }

  /**
   * Execute send_notification action
   */
  private async executeSendNotification(
    config: { channel: string; template: string; recipients: string[] | string },
    context: ExecutionContext
  ): Promise<void> {
    const message = this.interpolateTemplate(config.template, context.variables);

    await enqueueJob({
      type: "send_notification",
      data: {
        channel: config.channel,
        message,
        recipients: config.recipients,
        tenantId: context.tenantId,
        conversationId: context.conversationId,
      },
    });
  }

  /**
   * Execute update_conversation_status action
   */
  private async executeUpdateConversationStatus(
    config: { status: string },
    context: ExecutionContext
  ): Promise<void> {
    if (!context.conversationId) {
      throw new Error("Conversation ID required for update_conversation_status");
    }

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("conversations")
      .update({ status: config.status })
      .eq("id", context.conversationId);
  }

  /**
   * Execute add_customer_tag action
   */
  private async executeAddCustomerTag(
    config: { tag: string },
    context: ExecutionContext
  ): Promise<void> {
    if (!context.customerId) {
      throw new Error("Customer ID required for add_customer_tag");
    }

    const supabase = await createServiceClient();
    const currentTags = context.customer?.tags || [];

    if (!currentTags.includes(config.tag)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("customers")
        .update({ tags: [...currentTags, config.tag] })
        .eq("id", context.customerId);
    }
  }

  /**
   * Execute update_consultation_tag action
   */
  private async executeUpdateConsultationTag(
    config: { tag: string },
    context: ExecutionContext
  ): Promise<void> {
    if (!context.customerId) {
      throw new Error("Customer ID required for update_consultation_tag");
    }

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("customers")
      .update({ consultation_tag: config.tag })
      .eq("id", context.customerId);
  }

  /**
   * Execute create_escalation action
   */
  private async executeCreateEscalation(
    config: { reason: string; priority: string },
    context: ExecutionContext
  ): Promise<void> {
    if (!context.conversationId) {
      throw new Error("Conversation ID required for create_escalation");
    }

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("escalations").insert({
      tenant_id: context.tenantId,
      conversation_id: context.conversationId,
      message_id: context.messageId,
      reason: this.interpolateTemplate(config.reason, context.variables),
      priority: config.priority,
      status: "pending",
    });

    // Update conversation status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("conversations")
      .update({ status: "escalated" })
      .eq("id", context.conversationId);
  }

  /**
   * Execute send_satisfaction_survey action
   */
  private async executeSendSatisfactionSurvey(
    config: { surveyTemplate: string; delayMinutes?: number },
    context: ExecutionContext
  ): Promise<void> {
    const delay = config.delayMinutes || 0;

    await enqueueJob({
      type: "send_satisfaction_survey",
      data: {
        conversationId: context.conversationId,
        customerId: context.customerId,
        template: config.surveyTemplate,
        tenantId: context.tenantId,
      },
      delay: delay * 60 * 1000, // Convert to milliseconds
    });
  }

  /**
   * Execute delay action
   */
  private async executeDelay(
    config: { duration: number; unit: string }
  ): Promise<void> {
    let ms = config.duration;

    switch (config.unit) {
      case "minutes":
        ms *= 60 * 1000;
        break;
      case "hours":
        ms *= 60 * 60 * 1000;
        break;
      case "days":
        ms *= 24 * 60 * 60 * 1000;
        break;
      default:
        ms *= 1000;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute trigger_webhook action
   */
  private async executeTriggerWebhook(
    config: { url: string; method: string; headers?: Record<string, string>; body?: string },
    context: ExecutionContext
  ): Promise<void> {
    const body = config.body
      ? this.interpolateTemplate(config.body, context.variables)
      : undefined;

    await fetch(config.url, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: body ? JSON.stringify(JSON.parse(body)) : undefined,
    });
  }

  /**
   * Interpolate template with variables
   */
  private interpolateTemplate(
    template: string,
    variables: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Log execution to database
   */
  private async logExecution(
    ruleId: string,
    context: ExecutionContext,
    actionResults: ExecutionResult["actionResults"]
  ): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("automation_executions").insert({
      rule_id: ruleId,
      tenant_id: context.tenantId,
      conversation_id: context.conversationId,
      customer_id: context.customerId,
      success: actionResults.every((r) => r.success),
      actions_executed: actionResults.filter((r) => r.success).length,
      results: actionResults,
    });
  }

  /**
   * Update rule execution stats
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("increment_rule_execution", { rule_id: ruleId });
  }

  /**
   * Parse rule data from database
   */
  private parseRule(data: unknown): AutomationRule {
    const d = data as Record<string, unknown>;
    return {
      id: d.id as string,
      tenantId: d.tenant_id as string,
      name: d.name as string,
      description: d.description as string | undefined,
      isActive: d.is_active as boolean,
      priority: d.priority as number,
      trigger: d.trigger as AutomationTrigger,
      triggerConfig: d.trigger_config as AutomationRule["triggerConfig"],
      conditions: d.conditions as ConditionGroup | undefined,
      actions: d.actions as AutomationAction[],
      maxExecutionsPerConversation: d.max_executions_per_conversation as number | undefined,
      cooldownMinutes: d.cooldown_minutes as number | undefined,
      createdAt: new Date(d.created_at as string),
      updatedAt: new Date(d.updated_at as string),
      createdBy: d.created_by as string,
      lastExecutedAt: d.last_executed_at
        ? new Date(d.last_executed_at as string)
        : undefined,
      executionCount: d.execution_count as number,
    };
  }
}

// Export singleton instance
export const ruleEngine = new RuleEngine();
