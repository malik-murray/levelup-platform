import { Suspense } from 'react';
import LoginPageClient from './LoginPageClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#010205] px-4 py-8 text-white">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-[#ffb020]/40 border-t-[#ffb020]"
            aria-hidden
          />
        </main>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
