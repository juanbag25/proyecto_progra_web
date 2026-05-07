import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

/**
 * Root entry point. FitList doesn't (yet) have a marketing landing; the
 * sensible default is to drop the user where they need to go:
 *   - signed in  → /app (dashboard)
 *   - signed out → /login
 *
 * The design-system showcase still lives at /design-system and is
 * reachable by typing the URL directly — it's an internal demo, not a
 * navigation entry point, so we don't link to it from here.
 *
 * Server component + `redirect()` means the response is a 307 with no
 * HTML payload — no flash of landing UI before the redirect kicks in.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getUser();
  redirect(user ? '/app' : '/login');
}
