import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { postgrest } from '@/lib/postgrest';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.user_catalog_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const promptId = searchParams.get('promptId');
  const status = searchParams.get('status');
  const timeFilter = searchParams.get('timeFilter') || 'all';

  // First, find all prompt IDs for this user
  const { data: prompts, error: promptError } = await postgrest
    .from('schedule_prompts_list')
    .select('id')
    .eq('created_by', session.user.user_catalog_id);

  if (promptError) {
    return NextResponse.json({ error: 'Failed to fetch user prompts' }, { status: 500 });
  }

  const userPromptIds = (prompts || []).map((p) => p.id);
  if (userPromptIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = postgrest
    .from('prompt_execution_logs' as any)
    .select('*')
    .in('prompt_id', userPromptIds);

  if (promptId) {
    const promptIdNum = parseInt(promptId, 10);
    if (!isNaN(promptIdNum)) {
      query = query.eq('prompt_id', promptIdNum);
    }
  }
  if (status) query = query.eq('status', status);

  // Apply time filter
  const now = new Date();
  let startDate: Date | null = null;

  switch (timeFilter) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      startDate = null;
      break;
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

