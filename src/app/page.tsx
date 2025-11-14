import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

export default async function Home() {
    // Get cookies (async in Next 16)
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

    // Get the current session
    const {
        data: { session },
    } = await supabase.auth.getSession();

    // If logged in → dashboard
    if (session) {
        redirect("/dashboard");
    }

    // If not logged in → login
    redirect("/login");
}
