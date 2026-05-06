import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Route by onboarding state so first-time confirmers land on the interview
  // and returning users go straight to the app shell.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  const target = profile?.onboarding_completed ? '/app' : '/onboarding';
  return NextResponse.redirect(`${origin}${target}`);
}
