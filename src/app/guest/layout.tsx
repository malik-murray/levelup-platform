import GuestShell from './GuestShellContext';

export default function GuestLayout({ children }: { children: React.ReactNode }) {
    return <GuestShell>{children}</GuestShell>;
}
