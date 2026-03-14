import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const code = typeof params?.code === "string" ? params.code : null;

    // Supabase may redirect to Site URL (/) with ?code= when emailRedirectTo isn't used or allowlisted.
    // Forward to auth callback so the code gets exchanged for a session.
    if (code) {
        const next = typeof params?.next === "string" ? params.next : "/dashboard";
        redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
    }

    // Must await cookies() on Next.js 16+
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (session) {
        redirect("/dashboard");
    }

    // No session: render client component to handle redirect. We can't redirect server-side
    // because the URL may have a hash (e.g. #error=otp_expired from Supabase) which the
    // server never sees; client must read it before redirecting.
    const { default: HomeClient } = await import("./HomeClient");
    return <HomeClient />;
}
