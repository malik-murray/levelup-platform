import { ReactNode } from 'react';
import ResumeNav from './components/ResumeNav';

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
      <ResumeNav />
      <main className="pt-16">{children}</main>
    </div>
  );
}




