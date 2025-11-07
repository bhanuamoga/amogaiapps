import type { Prompt } from "@/types/prompts";

/**
 * Calculate the next execution time for a scheduled prompt
 * @param prompt The prompt with scheduling configuration
 * @returns Next execution date or null if no valid schedule
 */
export function calculateNextExecution(prompt: Prompt): Date | null {
  if (!prompt.isScheduled || prompt.status !== 'active') {
    return null;
  }

  const now = new Date();
  const timezone = prompt.timezone || 'UTC';
  
  // Convert current time to the prompt's timezone
  const currentTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  
  try {
    switch (prompt.frequency) {
      case 'hourly':
        return calculateHourlyNextExecution(prompt, currentTime);
      
      case 'daily':
        return calculateDailyNextExecution(prompt, currentTime);
      
      case 'weekly':
        return calculateWeeklyNextExecution(prompt, currentTime);
      
      case 'monthly':
        return calculateMonthlyNextExecution(prompt, currentTime);
      
      case 'yearly':
        return calculateYearlyNextExecution(prompt, currentTime);
      
      case 'special':
        return calculateSpecialNextExecution(prompt, currentTime);
      
      default:
        console.warn(`Unknown frequency: ${prompt.frequency}`);
        return null;
    }
  } catch (error) {
    console.error('Error calculating next execution:', error);
    return null;
  }
}

function calculateHourlyNextExecution(prompt: Prompt, currentTime: Date): Date | null {
  const interval = prompt.hourlyInterval || 1;
  const nextExecution = new Date(currentTime);
  nextExecution.setHours(nextExecution.getHours() + interval);
  nextExecution.setMinutes(0);
  nextExecution.setSeconds(0);
  nextExecution.setMilliseconds(0);
  
  return nextExecution;
}

function calculateDailyNextExecution(prompt: Prompt, currentTime: Date): Date | null {
  const scheduleTime = prompt.scheduleTime || '09:00';
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  const nextExecution = new Date(currentTime);
  nextExecution.setHours(hours, minutes, 0, 0);
  
  // If the time has already passed today, schedule for tomorrow
  if (nextExecution <= currentTime) {
    nextExecution.setDate(nextExecution.getDate() + 1);
  }
  
  return nextExecution;
}

function calculateWeeklyNextExecution(prompt: Prompt, currentTime: Date): Date | null {
  const selectedWeekdays = prompt.selectedWeekdays || [1]; // Default to Monday
  const scheduleTime = prompt.scheduleTime || '09:00';
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  // const currentDayOfWeek = currentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Find the next occurrence of any selected weekday
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(currentTime);
    checkDate.setDate(checkDate.getDate() + i);
    const dayOfWeek = checkDate.getDay();
    
    if (selectedWeekdays.includes(dayOfWeek)) {
      checkDate.setHours(hours, minutes, 0, 0);
      
      // If it's today and the time hasn't passed, or it's a future day
      if (i === 0 && checkDate > currentTime) {
        return checkDate;
      } else if (i > 0) {
        return checkDate;
      }
    }
  }
  
  return null;
}

function calculateMonthlyNextExecution(prompt: Prompt, currentTime: Date): Date | null {
  const dayOfMonth = prompt.dayOfMonth || 1;
  const scheduleTime = prompt.scheduleTime || '09:00';
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  const nextExecution = new Date(currentTime);
  
  // Set the day of month, handling edge cases
  const currentMonth = nextExecution.getMonth();
  const currentYear = nextExecution.getFullYear();
  
  // Create a date for the target day in the current month
  const targetDate = new Date(currentYear, currentMonth, dayOfMonth);
  
  // If the target day doesn't exist in this month (e.g., Feb 31), 
  // use the last day of the month
  if (targetDate.getMonth() !== currentMonth) {
    targetDate.setDate(0); // Last day of previous month
  }
  
  nextExecution.setDate(targetDate.getDate());
  nextExecution.setHours(hours, minutes, 0, 0);
  
  // If the time has already passed this month, schedule for next month
  if (nextExecution <= currentTime) {
    nextExecution.setMonth(nextExecution.getMonth() + 1);
    
    // Recalculate the day for next month, handling edge cases again
    const nextMonth = nextExecution.getMonth();
    const nextYear = nextExecution.getFullYear();
    const nextTargetDate = new Date(nextYear, nextMonth, dayOfMonth);
    
    if (nextTargetDate.getMonth() !== nextMonth) {
      nextTargetDate.setDate(0); // Last day of previous month
    }
    
    nextExecution.setDate(nextTargetDate.getDate());
  }
  
  return nextExecution;
}

function calculateYearlyNextExecution(prompt: Prompt, currentTime: Date): Date | null {
  const startMonth = prompt.startMonth || 1;
  // const endMonth = prompt.endMonth || 12;
  const selectedYear = prompt.selectedYear || currentTime.getFullYear();
  const scheduleTime = prompt.scheduleTime || '09:00';
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  const nextExecution = new Date(selectedYear, startMonth - 1, 1);
  nextExecution.setHours(hours, minutes, 0, 0);
  
  // If the start month has already passed this year, schedule for next year
  if (nextExecution <= currentTime) {
    nextExecution.setFullYear(nextExecution.getFullYear() + 1);
  }
  
  return nextExecution;
}

function calculateSpecialNextExecution(prompt: Prompt, currentTime: Date): Date | null {
  const specificDates = prompt.specificDates || [];
  
  if (specificDates.length === 0) {
    return null;
  }
  
  // Find the next specific date that hasn't passed
  const futureDates = specificDates
    .map(dateStr => new Date(dateStr))
    .filter(date => date > currentTime)
    .sort((a, b) => a.getTime() - b.getTime());
  
  return futureDates.length > 0 ? futureDates[0] : null;
}

/**
 * Check if a prompt is due for execution
 * @param prompt The prompt to check
 * @returns True if the prompt should be executed now
 */
export function isPromptDue(prompt: Prompt): boolean {
  if (!prompt.isScheduled || prompt.status !== 'active') {
    return false;
  }
  
  const now = new Date();
  const nextExecution = prompt.nextExecution ? new Date(prompt.nextExecution) : null;
  
  // If no next execution is set, calculate it
  if (!nextExecution) {
    const calculated = calculateNextExecution(prompt);
    return calculated ? calculated <= now : false;
  }
  
  return nextExecution <= now;
}

/**
 * Get all prompts that are due for execution
 * @param prompts Array of prompts to check
 * @returns Array of prompts that are due for execution
 */
export function getDuePrompts(prompts: Prompt[]): Prompt[] {
  return prompts.filter(isPromptDue);
}


