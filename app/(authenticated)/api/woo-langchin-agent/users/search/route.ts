import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { postgrest } from "@/lib/postgrest";

export async function GET(req: NextRequest) {
  try {
    // Step 1: Authenticate the request
    const session = await auth();
    if (!session?.user?.user_catalog_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Get search parameters from the URL
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');
    const excludeIdsParam = searchParams.get('exclude');

    if (!query || query.length < 2) {
      return NextResponse.json([]); // Return empty array for short or empty queries
    }

    // Step 3: Build the Supabase query
    let request = postgrest
      .from('user_catalog')
      .select('user_catalog_id, first_name, last_name, user_email')
      // Use 'or' to search across multiple columns
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,user_email.ilike.%${query}%`)
      .limit(10); // Limit results to prevent large payloads

    // Step 4: Exclude already selected users
    if (excludeIdsParam) {
      const excludeIds = excludeIdsParam.split(',').map(id => parseInt(id, 10));
      if (excludeIds.length > 0) {
        request = request.not('user_catalog_id', 'in', `(${excludeIds.join(',')})`);
      }
    }

    // Step 5: Execute the query and return the data
    const { data, error } = await request;

    if (error) {
      console.error("Supabase user search error:", error);
      throw new Error("Failed to search for users.");
    }

    return NextResponse.json(data || []);

  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}


