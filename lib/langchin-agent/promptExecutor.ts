import { postgrest } from "@/lib/postgrest";
import { streamResponse } from "@/services/langchin-agent/agentService";
import { calculateNextExecution } from "@/lib/langchin-agent/scheduleCalculator";
import type { Prompt, PromptDeliveryOptions, PromptExecutionResult, UserSearchResult } from "@/types/prompts";
import type { Database } from "@/types/database";

type SchedulePromptList = Database['public']['Tables']['schedule_prompts_list']['Row'];

interface AiConfig {
  provider: string;
  model: string;
  apiKey: string;
  defaultModel: boolean;
  status: 'active' | 'inactive';
}

interface WooConfig {
  apiName: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Execute a scheduled prompt for all target users
 * @param promptId The ID of the prompt to execute
 * @returns Execution result with success/failure counts
 */
export async function executeScheduledPrompt(promptId: number): Promise<PromptExecutionResult> {
  const result: PromptExecutionResult = {
    promptId,
    successCount: 0,
    failureCount: 0,
    errors: [],
    executedAt: new Date().toISOString(),
  };

  let logId: number | undefined;
  const logStartedAt = new Date();
  try {
    // Fetch the prompt
    const { data: promptRow, error: promptError } = await postgrest
      .asAdmin()
      .from("schedule_prompts_list")
      .select("*")
      .eq("id", promptId)
      .eq("status", "active")
      .single();

    if (promptError || !promptRow) {
      result.errors.push(`Prompt not found: ${promptError?.message || 'Unknown error'}`);
      return result;
    }

    // Insert execution log (running)
    const logInsertResult = await postgrest.asAdmin().from("prompt_execution_logs").insert({
      prompt_id: promptId,
      status: 'running',
      started_at: logStartedAt.toISOString(),
      trace_id: null,
      prompt_title: promptRow.title || null,
      prompt_description: promptRow.description || null,
    }).select().single();

    if (logInsertResult && logInsertResult.data && logInsertResult.data.id) {
      logId = logInsertResult.data.id;
    }

    // Update execution status to running
    await postgrest.asAdmin()
      .from("schedule_prompts_list")
      .update({ execution_status: 'running' })
      .eq("id", promptId);

    // Determine target users
    let targetUsers: UserSearchResult[] = [];

    if (promptRow.target_all_users) {
      // Get all users for the business
      const { data: allUsers, error: usersError } = await postgrest.asAdmin()
        .from("user_catalog")
        .select("user_catalog_id, first_name, last_name, user_email")
        .eq("business_number", String(promptRow.business_number || 0));

      if (usersError) {
        result.errors.push(`Failed to fetch all users: ${usersError.message}`);
        return result;
      }

      targetUsers = (allUsers || []).map(user => ({
        user_catalog_id: user.user_catalog_id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        user_email: user.user_email || '',
      }));
    } else if (promptRow.target_user_ids && Array.isArray(promptRow.target_user_ids) && promptRow.target_user_ids.length > 0) {
      // Get specific users
      const { data: specificUsers, error: specificUsersError } = await postgrest.asAdmin()
        .from("user_catalog")
        .select("user_catalog_id, first_name, last_name, user_email")
        .in("user_catalog_id", promptRow.target_user_ids as number[]);

      if (specificUsersError) {
        result.errors.push(`Failed to fetch specific users: ${specificUsersError.message}`);
        return result;
      }

      targetUsers = (specificUsers || []).map(user => ({
        user_catalog_id: user.user_catalog_id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        user_email: user.user_email || '',
      }));
    }

    if (targetUsers.length === 0) {
      result.errors.push("No target users found");
      return result;
    }

    // Execute prompt for each user
    const userExecutionPromises = targetUsers.map(async (user) => {
      try {
        await executePromptForUser(promptRow, user);
        return { success: true, user: user.user_email };
      } catch (error) {
        return { success: false, user: user.user_email, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Wait for all executions to complete
    const executionResults = await Promise.allSettled(userExecutionPromises);

    // Process results
    executionResults.forEach((executionResult) => {
      if (executionResult.status === 'fulfilled') {
        if (executionResult.value.success) {
          result.successCount++;
        } else {
          result.failureCount++;
          result.errors.push(`User ${executionResult.value.user}: ${executionResult.value.error}`);
        }
      } else {
        result.failureCount++;
        result.errors.push(`User execution failed: ${executionResult.reason}`);
      }
    });

    // Update prompt execution status and next execution time
    const nextExecution = calculateNextExecution({
      id: promptRow.id,
      createdAt: promptRow.created_at,
      updatedAt: promptRow.updated_at || undefined,
      title: promptRow.title || '',
      description: promptRow.description || '',
      status: promptRow.status as 'active' | 'inactive' | 'deleted',
      remarks: promptRow.remarks || undefined,
      createdBy: promptRow.created_by || 0,
      isScheduled: promptRow.is_scheduled,
      frequency: promptRow.frequency as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'special',
      scheduleTime: promptRow.schedule_time || undefined,
      timezone: promptRow.timezone || 'UTC',
      startDate: promptRow.start_date || undefined,
      endDate: promptRow.end_date || undefined,
      hourlyInterval: promptRow.hourly_interval || undefined,
      selectedWeekdays: promptRow.selected_weekdays as number[] || undefined,
      dayOfMonth: promptRow.day_of_month || undefined,
      startMonth: promptRow.start_month || undefined,
      endMonth: promptRow.end_month || undefined,
      selectedYear: promptRow.selected_year || undefined,
      selectedMonth: promptRow.selected_month || undefined,
      selectedDay: promptRow.selected_day || undefined,
      specificDates: promptRow.specific_dates as string[] || undefined,
      deliveryOptions: (promptRow.delivery_options as unknown as PromptDeliveryOptions) || { aiChat: true, notifier: false, email: false, chat: false },
      targetUserIds: promptRow.target_user_ids as number[] || undefined,
      targetAllUsers: promptRow.target_all_users || false,
      lastExecuted: promptRow.last_executed || undefined,
      nextExecution: promptRow.next_execution || undefined,
      executionStatus: (promptRow.execution_status) as 'idle' | 'running' | 'completed' | 'failed',
      promptGroup: promptRow.prompt_group || 'general_prompt',
      businessNumber: promptRow.business_number as number | string | undefined,
      createdUserId: promptRow.created_user_id || undefined,
      createdUserName: promptRow.created_user_name || undefined,
      forBusinessNumber: promptRow.for_business_number as number | string | undefined,
    });

    await postgrest.asAdmin()
      .from("schedule_prompts_list")
      .update({
        execution_status: 'idle',
        last_executed: result.executedAt,
        next_execution: nextExecution?.toISOString() || null,
      })
      .eq("id", promptId);

    // When capturing completion (success/failure) below:
    const completedAt = new Date();
    const duration = completedAt.getTime() - logStartedAt.getTime();
    if (logId) {
      await postgrest.asAdmin().from("prompt_execution_logs").update({
        status: result.failureCount ? 'failed' : 'completed',
        completed_at: completedAt.toISOString(),
        duration_ms: duration,
        error_message: result.errors.length ? result.errors.join(' | ') : null,
        error_stack: null,
        success_message: result.failureCount ? null : 'Task completed successfully',
      }).eq("id", logId);
    }

  } catch (error) {
    if (error instanceof Error) {
      result.errors.push(`Execution failed: ${error.message}`);
    } else {
      result.errors.push('Execution failed: Unknown error');
    }

    // Update execution status to idle after failure
    const completedAt = new Date();
    const duration = completedAt.getTime() - logStartedAt.getTime();

    await postgrest.asAdmin()
      .from("schedule_prompts_list")
      .update({ execution_status: 'idle' })
      .eq("id", promptId);

    // Final log update in error case
    if (logId) {
      await postgrest.asAdmin().from("prompt_execution_logs").update({
        status: 'failed',
        completed_at: completedAt.toISOString(),
        duration_ms: duration,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : null,
      }).eq("id", logId);
    }
  }

  return result;
}

/**
 * Execute a prompt for a specific user
 * @param prompt The prompt to execute
 * @param user The target user
 */
async function executePromptForUser(prompt: SchedulePromptList, user: UserSearchResult): Promise<void> {
  const { data: userData, error: userError } = await postgrest.asAdmin()
    .from("user_catalog")
    .select("ai_connection_json, api_connection_json")
    .eq("user_catalog_id", user.user_catalog_id)
    .single();

  if (userError || !userData) {
    throw new Error(`Failed to fetch user configuration: ${userError?.message || 'User not found'}`);
  }

  // Parse AI configurations
  const aiConfigs: AiConfig[] = Array.isArray(userData.ai_connection_json)
    ? (userData.ai_connection_json as unknown as AiConfig[])
    : [];

  const activeAiConfigs = aiConfigs.filter(config => config.status === 'active');
  const defaultAiConfig = activeAiConfigs.find(config => config.defaultModel) || activeAiConfigs[0];

  if (!defaultAiConfig) {
    throw new Error(`No active AI configuration found for user ${user.user_email}. Please configure an AI provider in user settings.`);
  }

  // Parse WooCommerce configurations
  const apiConfigs: WooConfig[] = Array.isArray(userData.api_connection_json)
    ? (userData.api_connection_json as unknown as WooConfig[])
    : [];

  const wooConfig = apiConfigs.find(config => config.apiName === 'woocommerce');

  if (!wooConfig) {
    throw new Error(`No WooCommerce configuration found for user ${user.user_email}. Please configure WooCommerce API credentials in user settings.`);
  }

  // Create a new thread for this execution
  const { data: newThread, error: threadError } = await postgrest.asAdmin()
    .from("Thread")
    .insert({
      title: `Scheduled: ${prompt.title}`,
      user_id: user.user_catalog_id,
      metadata: {
        scheduled_prompt_id: prompt.id,
        scheduled_execution: true,
        prompt_title: prompt.title,
      },
    })
    .select()
    .single();

  if (threadError || !newThread) {
    throw new Error(`Failed to create thread: ${threadError?.message || 'Unknown error'}`);
  }

  // Execute the prompt through the AI agent
  const stream = await streamResponse({
    threadId: newThread.id,
    userText: prompt.description || '',
    opts: {
      model: defaultAiConfig.model,
      provider: defaultAiConfig.provider,
      apiKey: defaultAiConfig.apiKey,
      approveAllTools: true,
      wooCommerceCredentials: {
        url: wooConfig.apiUrl,
        consumerKey: wooConfig.apiKey,
        consumerSecret: wooConfig.apiSecret,
      },
    },
  });

  // Consume the entire stream to complete execution
  for await (const chunk of stream) {
    console.log("received chunk", chunk.type);
    // Stream is consumed automatically - we just need to iterate through it
    // The actual execution happens in the streamResponse function
  }

  console.log(`Successfully executed prompt ${prompt.id} for user ${user.user_email} in thread ${newThread.id}`);

  // Parse delivery options from prompt
  const deliveryOptions: PromptDeliveryOptions = (prompt.delivery_options as unknown as PromptDeliveryOptions) || { 
    aiChat: true, 
    notifier: false, 
    email: false, 
    chat: false 
  };

  // Create notification for the user about the completed execution only if notifier is enabled
  if (deliveryOptions.notifier) {
    try {
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.user_email || 'User';
      const notificationContent = `Your scheduled prompt "${prompt.title || 'Untitled'}" has been executed successfully`;

      await postgrest.asAdmin().from("notifications").insert({
        user_id: user.user_catalog_id,
        user_name: userName,
        user_email: user.user_email || null,
        ref_chat_url: `/woo-langchin-agent/${newThread.id}`,
        ref_chatid: newThread.id,
        content: notificationContent,
        notification_group: "AI_CHAT_NOTIFICATION",
        read_status: false,
        archive_status: false,
        favorite: false,
        createdAt: new Date().toISOString(),
      });

      console.log(`Notification created for user ${user.user_email} for thread ${newThread.id}`);
    } catch (notificationError) {
      // Log error but don't fail the execution
      console.error(`Failed to create notification for user ${user.user_email}:`, notificationError);
    }
  } else {
    console.log(`Notification skipped for user ${user.user_email} - notifier is disabled for this prompt`);
  }
}

/**
 * Get all prompts that are due for execution
 * @returns Array of prompts that should be executed now
 */
export async function getDuePrompts(): Promise<Prompt[]> {
  const now = new Date().toISOString();

  const { data: duePrompts, error } = await postgrest.asAdmin()
    .from("schedule_prompts_list")
    .select("*")
    .eq("status", "active")
    .eq("is_scheduled", true)
    .or(`next_execution.is.null,next_execution.lte.${now}`)
    .neq("execution_status", "running");

  if (error) {
    console.error("Error fetching due prompts:", error);
    return [];
  }

  return (duePrompts || []).map((prompt: SchedulePromptList) => {
    return {
      id: prompt.id,
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at || undefined,
      title: prompt.title || '',
      description: prompt.description || '',
      status: prompt.status as 'active' | 'inactive' | 'deleted',
      remarks: prompt.remarks || undefined,
      createdBy: prompt.created_by || 0,
      isScheduled: prompt.is_scheduled,
      frequency: prompt.frequency as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'special',
      scheduleTime: prompt.schedule_time || undefined,
      timezone: prompt.timezone || 'UTC',
      startDate: prompt.start_date || undefined,
      endDate: prompt.end_date || undefined,
      hourlyInterval: prompt.hourly_interval || undefined,
      selectedWeekdays: prompt.selected_weekdays as number[] || undefined,
      dayOfMonth: prompt.day_of_month || undefined,
      startMonth: prompt.start_month || undefined,
      endMonth: prompt.end_month || undefined,
      selectedYear: prompt.selected_year || undefined,
      selectedMonth: prompt.selected_month || undefined,
      selectedDay: prompt.selected_day || undefined,
      specificDates: prompt.specific_dates as string[] || undefined,
      deliveryOptions: prompt.delivery_options as { aiChat: boolean; notifier: boolean; email: boolean; chat: boolean } || { aiChat: true, notifier: false, email: false, chat: false },
      targetUserIds: prompt.target_user_ids as number[] || undefined,
      targetAllUsers: prompt.target_all_users || false,
      lastExecuted: prompt.last_executed || undefined,
      nextExecution: prompt.next_execution || undefined,
      executionStatus: prompt.execution_status as 'idle' | 'running' | 'completed' | 'failed',
      promptGroup: prompt.prompt_group || 'general_prompt',
      businessNumber: prompt.business_number || undefined,
      createdUserId: prompt.created_user_id || undefined,
      createdUserName: prompt.created_user_name || undefined,
      forBusinessNumber: prompt.for_business_number || undefined,
    } as Prompt;
  });
}

/**
 * Orchestrate processing of all due prompts with duplicate-run guard
 * Processes prompts sequentially to avoid heavy load
 */
export async function processDuePrompts(): Promise<PromptExecutionResult[]> {
  const duePrompts = await getDuePrompts();
  const results: PromptExecutionResult[] = [];

  // Sequential execution avoids heavy load; switch to Promise.allSettled if desired
  for (const prompt of duePrompts) {
    try {
      const result = await executeScheduledPrompt(prompt.id);
      results.push(result);
    } catch (error) {
      if (error instanceof Error) {
        results.push({
          promptId: prompt.id,
          successCount: 0,
          failureCount: 1,
          errors: [`Failed to execute prompt: ${error.message}`],
          executedAt: new Date().toISOString(),
        });
      } else {
        results.push({
          promptId: prompt.id,
          successCount: 0,
          failureCount: 1,
          errors: ['Failed to execute prompt: Unknown error'],
          executedAt: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

/**
 * Process all due prompts in parallel for better performance
 * Use this when you want faster execution and can handle higher concurrent load
 */
export async function processDuePromptsParallel(): Promise<PromptExecutionResult[]> {
  const duePrompts = await getDuePrompts();
  
  // Process all prompts in parallel
  const executionPromises = duePrompts.map(async (prompt) => {
    try {
      return await executeScheduledPrompt(prompt.id);
    } catch (error) {
      if (error instanceof Error) {
        return {
          promptId: prompt.id,
          successCount: 0,
          failureCount: 1,
          errors: [`Failed to execute prompt: ${error.message}`],
          executedAt: new Date().toISOString(),
        } as PromptExecutionResult;
      } else {
        return {
          promptId: prompt.id,
          successCount: 0,
          failureCount: 1,
          errors: ['Failed to execute prompt: Unknown error'],
          executedAt: new Date().toISOString(),
        } as PromptExecutionResult;
      }
    }
  });

  // Wait for all executions to complete
  const results = await Promise.allSettled(executionPromises);

  // Extract results and handle any unexpected rejections
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // This shouldn't happen since we catch errors above, but handle it just in case
      return {
        promptId: duePrompts[index]?.id || 0,
        successCount: 0,
        failureCount: 1,
        errors: [`Unexpected error: ${result.reason}`],
        executedAt: new Date().toISOString(),
      } as PromptExecutionResult;
    }
  });
}

/**
 * Execute all due prompts (legacy)
 * @deprecated Use processDuePrompts instead
 */
export async function executeAllDuePrompts(): Promise<PromptExecutionResult[]> {
  return processDuePrompts();
}


