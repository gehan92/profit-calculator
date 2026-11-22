# Profit Calculator

A free, simple website that tells small business owners: **"Am I really making a profit?"**
First market: Sri Lanka (LKR; English, Sinhala and Tamil).

The single source of truth for what to build is
`../Profit-Calculator-Complete-Development-Document.pdf`. Section references in the
code (for example "Part D1") point to that document.

## Tech stack (Part F1)

| Part              | Choice                                                  |
| ----------------- | ------------------------------------------------------- |
| Framework         | Next.js 16 (App Router, Server Actions, Cache Components) |
| UI                | Tailwind CSS v4 + shadcn/ui (Radix)                     |
| Database + Auth   | Supabase (Postgres, Auth, Row Level Security)           |
| Languages         | next-intl — `en` (default), `si`, `ta`                  |
| Forms             | react-hook-form + zod                                   |
| Charts            | Recharts                                                |
| Tests             | Vitest (unit + database RLS tests on PGlite)            |
| Installable app   | Web app manifest + Serwist service worker (PWA)         |
| Hosting           | Vercel                                                  |

## Getting started

Requires **Node.js 22+**.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000 → redirects to /en
```

## Scripts

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Start the development server                              |
| `npm run build`     | Production build                                          |
| `npm run check`     | Lint + type check + all tests — run before every commit   |
| `npm test`          | Unit tests and database RLS tests                         |
| `npm run db:push`   | Apply `supabase/migrations` to the linked Supabase project |
| `npm run db:types`  | Regenerate `src/lib/supabase/types.ts` after a migration  |

### Trying the installable app (PWA)

The service worker (`src/app/sw.ts`, built by Serwist) runs **only in a production
build**, so development never shows old pages by mistake:

```bash
npm run build && npm start   # http://localhost:3000
```

Then open Chrome DevTools → Application → Service Workers (and Manifest), or tick
"Offline" in the Network tab to see the offline calculators and the offline page.
After an installed app has been tried, "Clear site data" in DevTools resets it.

## Project structure (Part F2)

```
src/
  app/[locale]/          Pages for /en, /si, /ta
    (public)/            Home, calculators, /try, login, about...
  components/
    ui/                  shadcn/ui building blocks
    layout/              Header, footer, logo, language switch
    calculators/         Calculator pages and shared pieces
  config/                Site settings and the list of calculators
  i18n/                  Languages: config, routing, request, navigation
  lib/                   Domain logic (Money, calculations) — framework-free
  messages/              en.json, si.json, ta.json (all user-facing text)
  proxy.ts               Runs first: language now; session + guards on Day 6
supabase/
  migrations/            Database schema, RLS policies, functions (Part F3)
  tests/                 RLS tests: each role sees only what Part B allows
```

## Coding standards

- **One place for each rule.** Languages in `src/i18n/config.ts`, calculators in
  `src/config/calculators.ts`, role rules in `src/lib/roles.ts` (Day 8).
- **Money is always cents.** Use the `Money` class (`src/lib/money.ts`); never do
  money maths with floating-point numbers.
- **No hard-coded words in components.** Every text goes in `src/messages/*.json`.
  English first; `npm test` fails if Sinhala or Tamil is missing a key.
- **Security is checked three times:** proxy/layout, every Server Action, and RLS
  in the database. Hiding a button is never security.
- **The secret key stays on the server.** Only `src/lib/supabase/admin.ts` may use it.
- **Native speakers review** `si.json` and `ta.json` before launch.

## Database

Create a Supabase project, then:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
npm run db:types
```

After your first login, make yourself admin in the Supabase SQL editor and turn on MFA:

```sql
update profiles set platform_role = 'admin' where id = '<your-user-id>';
```
