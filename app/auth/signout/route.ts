import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = createClient();
  await supabase.auth.signOut();
  // 303 forces the redirect to be a GET, which a browser following a POST
  // would otherwise refuse to convert.
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
