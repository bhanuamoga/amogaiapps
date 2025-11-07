import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import type { Prompt, PromptCreateRequest } from "@/types/prompts";
import { calculateNextExecution } from "@/lib/langchin-agent/scheduleCalculator";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: prompts, error } = await postgrest
      .from("schedule_prompts_list")
      .select("*")
      .eq("created_by", session.user.user_catalog_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching prompts:", error);
      return NextResponse.json({ error: "Failed to fetch prompts" }, { status: 500 });
    }
    
    // Map database fields to frontend interface
    const mappedPrompts = (prompts || []).map((prompt) => ({
      id: prompt.id,
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at,
      title: prompt.title,
      description: prompt.description,
      status: prompt.status,
      remarks: prompt.remarks,
      createdBy: prompt.created_by,
      isScheduled: prompt.is_scheduled,
      frequency: prompt.frequency,
      scheduleTime: prompt.schedule_time,
      timezone: prompt.timezone,
      startDate: prompt.start_date,
      endDate: prompt.end_date,
      hourlyInterval: prompt.hourly_interval,
      selectedWeekdays: prompt.selected_weekdays,
      dayOfMonth: prompt.day_of_month,
      startMonth: prompt.start_month,
      endMonth: prompt.end_month,
      selectedYear: prompt.selected_year,
      selectedMonth: prompt.selected_month,
      selectedDay: prompt.selected_day,
      specificDates: prompt.specific_dates,
      deliveryOptions: prompt.delivery_options || { aiChat: true, notifier: false, email: false, chat: false },
      targetUserIds: prompt.target_user_ids,
      targetAllUsers: prompt.target_all_users,
      lastExecuted: prompt.last_executed,
      nextExecution: prompt.next_execution,
      executionStatus: prompt.execution_status,
      promptGroup: prompt.prompt_group,
      businessNumber: prompt.business_number,
      createdUserId: prompt.created_user_id,
      createdUserName: prompt.created_user_name,
      forBusinessNumber: prompt.for_business_number,
    }));

    return NextResponse.json(mappedPrompts);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: PromptCreateRequest = await req.json();
    
    // Validate required fields
    if (!body.title || !body.description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    // Validate schedule fields if scheduled
    if (body.isScheduled) {
      if (!body.frequency || !['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'special'].includes(body.frequency)) {
        return NextResponse.json({ error: "Valid frequency is required for scheduled prompts" }, { status: 400 });
      }
      
      if (body.frequency === 'hourly' && (!body.hourlyInterval || body.hourlyInterval < 1 || body.hourlyInterval > 24)) {
        return NextResponse.json({ error: "Hourly interval must be between 1 and 24" }, { status: 400 });
      }
      
      if (body.frequency === 'weekly' && (!body.selectedWeekdays || body.selectedWeekdays.length === 0)) {
        return NextResponse.json({ error: "At least one weekday must be selected for weekly frequency" }, { status: 400 });
      }
      
      if (body.frequency === 'monthly' && (!body.dayOfMonth || body.dayOfMonth < 1 || body.dayOfMonth > 31)) {
        return NextResponse.json({ error: "Day of month must be between 1 and 31" }, { status: 400 });
      }
      
      if (body.frequency === 'yearly' && (!body.startMonth || body.startMonth < 1 || body.startMonth > 12)) {
        return NextResponse.json({ error: "Start month must be between 1 and 12" }, { status: 400 });
      }
      
      if (body.frequency === 'special' && (!body.specificDates || body.specificDates.length === 0)) {
        return NextResponse.json({ error: "At least one specific date must be provided for special frequency" }, { status: 400 });
      }
    }

    const promptData = {
      title: body.title,
      description: body.description,
      remarks: body.remarks || null,
      status: body.status || 'active',
      is_scheduled: body.isScheduled || false,
      frequency: body.frequency || 'daily',
      schedule_time: body.scheduleTime || '09:00:00',
      timezone: body.timezone || 'UTC',
      start_date: body.startDate && body.startDate.trim() !== "" ? body.startDate : null,
      end_date: body.endDate && body.endDate.trim() !== "" ? body.endDate : null,
      hourly_interval: body.hourlyInterval || null,
      selected_weekdays: body.selectedWeekdays || null,
      day_of_month: body.dayOfMonth || null,
      start_month: body.startMonth || null,
      end_month: body.endMonth || null,
      selected_year: body.selectedYear || null,
      selected_month: body.selectedMonth || null,
      selected_day: body.selectedDay || null,
      specific_dates: body.specificDates || null,
      delivery_options: (body.deliveryOptions || { aiChat: true, notifier: false, email: false, chat: false }),
      target_user_ids: (body.targetUserIds || null),
      target_all_users: body.targetAllUsers || false,
      prompt_group: body.promptGroup || 'general_prompt',
      created_by: session.user.user_catalog_id,
      created_user_id: session.user.user_catalog_id,
      created_user_name: session.user.first_name + ' ' + session.user.last_name,
      business_number: session.user.business_number && !isNaN(parseInt(session.user.business_number)) ? parseInt(session.user.business_number) : null,
      for_business_number: session.user.business_number && !isNaN(parseInt(session.user.business_number)) ? parseInt(session.user.business_number) : null,
      execution_status: 'idle',
      next_execution: null as string | null, // Will be calculated after if scheduled
    };

    // Calculate next_execution if scheduled
    if (body.isScheduled && body.status === 'active') {
      // Create a temporary Prompt object for calculation
      const tempPrompt: Prompt = {
        id: 0, // Temporary ID
        createdAt: new Date().toISOString(),
        title: body.title,
        description: body.description,
        status: body.status || 'active',
        remarks: body.remarks,
        createdBy: session.user.user_catalog_id,
        isScheduled: body.isScheduled,
        frequency: body.frequency || 'daily',
        scheduleTime: body.scheduleTime || '09:00',
        timezone: body.timezone || 'UTC',
        startDate: body.startDate,
        endDate: body.endDate,
        hourlyInterval: body.hourlyInterval,
        selectedWeekdays: body.selectedWeekdays,
        dayOfMonth: body.dayOfMonth,
        startMonth: body.startMonth,
        endMonth: body.endMonth,
        selectedYear: body.selectedYear,
        selectedMonth: body.selectedMonth,
        selectedDay: body.selectedDay,
        specificDates: body.specificDates,
        deliveryOptions: body.deliveryOptions || { aiChat: true, notifier: false, email: false, chat: false },
        targetUserIds: body.targetUserIds,
        targetAllUsers: body.targetAllUsers || false,
        executionStatus: 'idle',
        promptGroup: body.promptGroup || 'general_prompt',
      };

      const nextExec = calculateNextExecution(tempPrompt);
      if (nextExec) {
        promptData.next_execution = nextExec.toISOString() ;
      }
    }

    console.log("promptData", promptData);
    
    const { data: createdPrompt, error } = await postgrest
      .from("schedule_prompts_list")
      .insert(promptData)
      .select()
      .single();

    if (error) {
      console.error("Error creating prompt:", error);
      return NextResponse.json({ error: "Failed to create prompt" }, { status: 500 });
    }

    if (!createdPrompt) {
      console.error("No prompt returned after creation");
      return NextResponse.json({ error: "Failed to create prompt" }, { status: 500 });
    }

    // Map database fields to frontend interface for consistency
    const mappedPrompt = {
      id: createdPrompt.id,
      createdAt: createdPrompt.created_at,
      updatedAt: createdPrompt.updated_at,
      title: createdPrompt.title,
      description: createdPrompt.description,
      status: createdPrompt.status,
      remarks: createdPrompt.remarks,
      createdBy: createdPrompt.created_by,
      isScheduled: createdPrompt.is_scheduled,
      frequency: createdPrompt.frequency,
      scheduleTime: createdPrompt.schedule_time,
      timezone: createdPrompt.timezone,
      startDate: createdPrompt.start_date,
      endDate: createdPrompt.end_date,
      hourlyInterval: createdPrompt.hourly_interval,
      selectedWeekdays: createdPrompt.selected_weekdays,
      dayOfMonth: createdPrompt.day_of_month,
      startMonth: createdPrompt.start_month,
      endMonth: createdPrompt.end_month,
      selectedYear: createdPrompt.selected_year,
      selectedMonth: createdPrompt.selected_month,
      selectedDay: createdPrompt.selected_day,
      specificDates: createdPrompt.specific_dates,
      deliveryOptions: createdPrompt.delivery_options || { aiChat: true, notifier: false, email: false, chat: false },
      targetUserIds: createdPrompt.target_user_ids,
      targetAllUsers: createdPrompt.target_all_users,
      lastExecuted: createdPrompt.last_executed,
      nextExecution: createdPrompt.next_execution,
      executionStatus: createdPrompt.execution_status,
      promptGroup: createdPrompt.prompt_group,
      businessNumber: createdPrompt.business_number,
      createdUserId: createdPrompt.created_user_id,
      createdUserName: createdPrompt.created_user_name,
      forBusinessNumber: createdPrompt.for_business_number,
    };

    return NextResponse.json(mappedPrompt, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
