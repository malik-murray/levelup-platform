import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

export default async function Home() {
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

    redirect("/login");
}
