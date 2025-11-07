import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import type { Prompt, PromptDeliveryOptions, PromptUpdateRequest } from "@/types/prompts";
import { calculateNextExecution } from "@/lib/langchin-agent/scheduleCalculator";
import type { Database, Json } from "@/types/database";

type PromptData = Database["public"]["Tables"]["schedule_prompts_list"]["Row"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const promptId = parseInt((await params).id);
    if (isNaN(promptId)) {
      return NextResponse.json({ error: "Invalid prompt ID" }, { status: 400 });
    }

    const { data: prompt, error } = await postgrest
      .from("schedule_prompts_list")
      .select("*")
      .eq("id", promptId)
      .eq("created_by", session.user.user_catalog_id)
      .neq("status", "deleted")
      .single();

    if (error) {
      console.error("Error fetching prompt:", error);
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    // Map database fields to frontend interface
    const mappedPrompt = {
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
    };

    return NextResponse.json(mappedPrompt);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const promptId = parseInt((await params).id);
    if (isNaN(promptId)) {
      return NextResponse.json({ error: "Invalid prompt ID" }, { status: 400 });
    }

    const body: Partial<PromptUpdateRequest> = await req.json();

    // Check if prompt exists and belongs to user
    const { data: existingPrompt, error: fetchError } = await postgrest
      .from("schedule_prompts_list")
      .select("id")
      .eq("id", promptId)
      .eq("created_by", session.user.user_catalog_id)
      .single();

    if (fetchError || !existingPrompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const updateData: Partial<PromptData> = {
      updated_at: new Date().toISOString(),
    };

    // Map frontend fields to database fields
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.remarks !== undefined) updateData.remarks = body.remarks;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isScheduled !== undefined) updateData.is_scheduled = body.isScheduled;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.scheduleTime !== undefined) updateData.schedule_time = body.scheduleTime;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.startDate !== undefined) updateData.start_date = body.startDate && body.startDate.trim() !== "" ? body.startDate : null;
    if (body.endDate !== undefined) updateData.end_date = body.endDate && body.endDate.trim() !== "" ? body.endDate : null;
    if (body.hourlyInterval !== undefined) updateData.hourly_interval = body.hourlyInterval;
    if (body.selectedWeekdays !== undefined) updateData.selected_weekdays = body.selectedWeekdays;
    if (body.dayOfMonth !== undefined) updateData.day_of_month = body.dayOfMonth;
    if (body.startMonth !== undefined) updateData.start_month = body.startMonth;
    if (body.endMonth !== undefined) updateData.end_month = body.endMonth;
    if (body.selectedYear !== undefined) updateData.selected_year = body.selectedYear;
    if (body.selectedMonth !== undefined) updateData.selected_month = body.selectedMonth;
    if (body.selectedDay !== undefined) updateData.selected_day = body.selectedDay;
    if (body.specificDates !== undefined) updateData.specific_dates = body.specificDates;
    if (body.deliveryOptions !== undefined) updateData.delivery_options = body.deliveryOptions as unknown as Json | null;
    if (body.targetUserIds !== undefined) updateData.target_user_ids = body.targetUserIds;
    if (body.targetAllUsers !== undefined) updateData.target_all_users = body.targetAllUsers;
    if (body.promptGroup !== undefined) updateData.prompt_group = body.promptGroup;

    // Check if schedule-related fields were updated and recalculate next_execution
    const scheduleFieldsUpdated =
      body.isScheduled !== undefined ||
      body.frequency !== undefined ||
      body.scheduleTime !== undefined ||
      body.timezone !== undefined ||
      body.startDate !== undefined ||
      body.endDate !== undefined ||
      body.hourlyInterval !== undefined ||
      body.selectedWeekdays !== undefined ||
      body.dayOfMonth !== undefined ||
      body.startMonth !== undefined ||
      body.endMonth !== undefined ||
      body.selectedYear !== undefined ||
      body.specificDates !== undefined ||
      body.status !== undefined;

    if (scheduleFieldsUpdated) {
      // Fetch the current prompt to get all values
      const { data: currentPrompt } = await postgrest
        .from("schedule_prompts_list")
        .select("*")
        .eq("id", promptId)
        .single();

      if (currentPrompt) {
        // Merge current values with updates (with type coercion for database nulls)
        const mergedPrompt: Prompt = {
          id: currentPrompt.id,
          createdAt: currentPrompt.created_at || new Date().toISOString(),
          updatedAt: currentPrompt.updated_at || undefined,
          title: (body.title ?? currentPrompt.title) || '',
          description: (body.description ?? currentPrompt.description) || '',
          status: (body.status ?? currentPrompt.status) as 'active' | 'inactive' | 'deleted',
          remarks: (body.remarks ?? currentPrompt.remarks) || undefined,
          createdBy: currentPrompt.created_by || 0,
          isScheduled: body.isScheduled ?? currentPrompt.is_scheduled,
          frequency: ((body.frequency ?? currentPrompt.frequency) || 'daily') as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'special',
          scheduleTime: ((body.scheduleTime ?? currentPrompt.schedule_time) || '09:00'),
          timezone: (body.timezone ?? currentPrompt.timezone) || 'UTC',
          startDate: (body.startDate ?? currentPrompt.start_date) || undefined,
          endDate: (body.endDate ?? currentPrompt.end_date) || undefined,
          hourlyInterval: (body.hourlyInterval ?? currentPrompt.hourly_interval) || undefined,
          selectedWeekdays: ((body.selectedWeekdays ?? currentPrompt.selected_weekdays) as number[]) || undefined,
          dayOfMonth: (body.dayOfMonth ?? currentPrompt.day_of_month) || undefined,
          startMonth: (body.startMonth ?? currentPrompt.start_month) || undefined,
          endMonth: (body.endMonth ?? currentPrompt.end_month) || undefined,
          selectedYear: (body.selectedYear ?? currentPrompt.selected_year) || undefined,
          selectedMonth: (body.selectedMonth ?? currentPrompt.selected_month) || undefined,
          selectedDay: (body.selectedDay ?? currentPrompt.selected_day) || undefined,
          specificDates: ((body.specificDates ?? currentPrompt.specific_dates) as string[]) || undefined,
          deliveryOptions: (body.deliveryOptions ?? currentPrompt.delivery_options) as unknown as PromptDeliveryOptions || { aiChat: true, notifier: false, email: false, chat: false },
          targetUserIds: ((body.targetUserIds ?? currentPrompt.target_user_ids) as number[]) || undefined,
          targetAllUsers: (body.targetAllUsers ?? currentPrompt.target_all_users) || false,
          executionStatus: currentPrompt.execution_status as 'idle' | 'running' | 'completed' | 'failed',
          promptGroup: body.promptGroup ?? currentPrompt.prompt_group,
          businessNumber: currentPrompt.business_number || undefined,
          createdUserId: currentPrompt.created_user_id || undefined,
          createdUserName: (currentPrompt.created_user_name || undefined),
          forBusinessNumber: currentPrompt.for_business_number || undefined,
        };

        // Recalculate next_execution
        const nextExec = calculateNextExecution(mergedPrompt);
        updateData.next_execution = nextExec ? nextExec.toISOString() : null;

        // Reset execution status to idle if schedule changed
        updateData.execution_status = 'idle';
      }
    }

    console.log("updateData", updateData);
    console.log("Updating prompt ID:", promptId, "for user:", session.user.user_catalog_id);

    // Double-check that we're only updating one specific prompt
    if (!promptId || promptId <= 0) {
      console.error("Invalid prompt ID in update:", promptId);
      return NextResponse.json({ error: "Invalid prompt ID" }, { status: 400 });
    }

    const { data: updatedPrompt, error } = await postgrest
      .from("schedule_prompts_list")
      .update(updateData)
      .eq("id", promptId)
      .eq("created_by", session.user.user_catalog_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating prompt:", error);
      return NextResponse.json({ error: "Failed to update prompt" }, { status: 500 });
    }

    if (!updatedPrompt) {
      console.error("No prompt returned after update - prompt may not exist or belong to user");
      return NextResponse.json({ error: "Prompt not found or unauthorized" }, { status: 404 });
    }

    console.log("Successfully updated prompt:", updatedPrompt.id);

    // Map database fields to frontend interface
    const mappedPrompt = {
      id: updatedPrompt.id,
      createdAt: updatedPrompt.created_at,
      updatedAt: updatedPrompt.updated_at,
      title: updatedPrompt.title,
      description: updatedPrompt.description,
      status: updatedPrompt.status,
      remarks: updatedPrompt.remarks,
      createdBy: updatedPrompt.created_by,
      isScheduled: updatedPrompt.is_scheduled,
      frequency: updatedPrompt.frequency,
      scheduleTime: updatedPrompt.schedule_time,
      timezone: updatedPrompt.timezone,
      startDate: updatedPrompt.start_date,
      endDate: updatedPrompt.end_date,
      hourlyInterval: updatedPrompt.hourly_interval,
      selectedWeekdays: updatedPrompt.selected_weekdays,
      dayOfMonth: updatedPrompt.day_of_month,
      startMonth: updatedPrompt.start_month,
      endMonth: updatedPrompt.end_month,
      selectedYear: updatedPrompt.selected_year,
      selectedMonth: updatedPrompt.selected_month,
      selectedDay: updatedPrompt.selected_day,
      specificDates: updatedPrompt.specific_dates,
      deliveryOptions: updatedPrompt.delivery_options || { aiChat: true, notifier: false, email: false, chat: false },
      targetUserIds: updatedPrompt.target_user_ids,
      targetAllUsers: updatedPrompt.target_all_users,
      lastExecuted: updatedPrompt.last_executed,
      nextExecution: updatedPrompt.next_execution,
      executionStatus: updatedPrompt.execution_status,
      promptGroup: updatedPrompt.prompt_group,
      businessNumber: updatedPrompt.business_number,
      createdUserId: updatedPrompt.created_user_id,
      createdUserName: updatedPrompt.created_user_name,
      forBusinessNumber: updatedPrompt.for_business_number,
    };

    return NextResponse.json(mappedPrompt);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const promptId = parseInt((await params).id);
    if (isNaN(promptId)) {
      return NextResponse.json({ error: "Invalid prompt ID" }, { status: 400 });
    }

    // Soft delete by setting status to 'deleted'
    const { error } = await postgrest
      .from("schedule_prompts_list")
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq("id", promptId)
      .eq("created_by", session.user.user_catalog_id);

    if (error) {
      console.error("Error deleting prompt:", error);
      return NextResponse.json({ error: "Failed to delete prompt" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}


