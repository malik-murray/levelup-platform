This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Storage Architecture

This project splits storage across two places:

- **Local (this repo / your Mac's SSD):** the codebase, git history, `node_modules`, `.venv`, package files, and the active Supabase database connection. GitHub is the source of truth for code.
- **iCloud Drive (`~/Library/Mobile Documents/com~apple~CloudDocs/LevelUpSolutions`):** large or generated content only - media assets, finished exports (shorts, blog images, ebook files), and **timestamped** database backups. This syncs across Macs without bloating the git repo or slowing down local dev.

The active development database is never moved to iCloud - only point-in-time backups of it are.

Paths are fully configurable via environment variables (all optional, with macOS-appropriate defaults):

| Variable | Default |
| --- | --- |
| `LEVELUP_STORAGE_DIR` | `~/Library/Mobile Documents/com~apple~CloudDocs/LevelUpSolutions` |
| `LEVELUP_ASSETS_DIR` | `$LEVELUP_STORAGE_DIR/assets` |
| `LEVELUP_EXPORTS_DIR` | `$LEVELUP_STORAGE_DIR/exports` |
| `LEVELUP_BACKUPS_DIR` | `$LEVELUP_STORAGE_DIR/backups` |
| `LEVELUP_DATABASE_BACKUP_DIR` | `$LEVELUP_BACKUPS_DIR/database-backups` |

Set these in `.env.local` (see `.env.example`) to store this content somewhere other than iCloud. The path config lives in [`src/lib/storage/paths.ts`](src/lib/storage/paths.ts) (used by the app, which creates the iCloud folder tree on server startup via `src/instrumentation.ts`) and [`scripts/storage_paths.py`](scripts/storage_paths.py) (used by local tooling scripts).

### Migrating existing local content to iCloud

If you have local assets/exports/backups you want moved into the new iCloud layout, put them in a local `./storage` folder (mirroring the `assets/`, `exports/`, `backups/`, `documents/` structure) and run:

```bash
# Preview what would be copied, without writing anything
python3 scripts/migrate_storage_to_icloud.py --dry-run

# Actually copy
python3 scripts/migrate_storage_to_icloud.py
```

The script only **copies** - it never deletes or moves local files, and it never touches `.git`, `node_modules`, `.venv`, caches, logs, or active database files. It also picks up loose, timestamped database dump files (e.g. `supabase_backup_2026-07-06.sql`) from the repo root or a local `./backups` folder.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
