import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session and gate everything behind login (single-user app).
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense-in-depth: even if signups are enabled in Supabase, only the
  // allowlisted email may hold a session here.
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (
    user &&
    allowedEmail &&
    user.email?.toLowerCase() !== allowedEmail.toLowerCase()
  ) {
    await supabase.auth.signOut();
    user = null;
  }

  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and externally-authenticated API routes
    // (Telegram webhook + crons verify their own secrets).
    "/((?!_next/static|_next/image|favicon.ico|api/telegram|api/cron).*)",
  ],
};
