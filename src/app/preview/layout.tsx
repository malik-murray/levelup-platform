'use client';

import PreviewShell from './PreviewShellContext';

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewShell>{children}</PreviewShell>;
}
