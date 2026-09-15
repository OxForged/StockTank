import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  // After OAuth callback, user lands here with a session cookie.
  // Check if they have interests set; if not, redirect to onboarding.
  const cookieStore = await cookies();
  const session = cookieStore.get('podcast_session');

  let hasInterests = true; // default: skip onboarding

  if (session) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Cookie: `podcast_session=${session.value}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const user = await res.json();
        hasInterests = Array.isArray(user.interests) && user.interests.length > 0;
      }
    } catch {
      // If API is unreachable, fall through to explore
    }
  }

  // redirect() throws internally — must be outside try-catch
  if (!hasInterests && session) {
    redirect('/onboarding');
  }
  redirect('/explore');
}
