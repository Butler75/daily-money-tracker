# Daily Money Tracker

Daily Money Tracker is a mobile-first finance web app for recording income/expenses, tracking surplus, and managing staff access with Supabase-backed auth and role permissions.

## Tech Stack

- React + Vite
- Tailwind CSS
- Supabase (Auth, Postgres, RLS)

## Core Features

- Email/password auth
- Role-based access: owner, manager, staff
- Fast transaction entry (income/expense)
- Dashboard summaries (Dubai timezone)
- Reports with PDF/CSV export
- Categories management
- Savings goals and alerts
- Staff invite + activation/deactivation + reset password flow

## Timezone and Currency

- Business timezone: `Asia/Dubai`
- Currency formatting: `AED`

---

## 1) Supabase Setup

1. Create a new Supabase project.
2. In Supabase SQL Editor, run:
   - `supabase/schema.sql`
3. In Supabase dashboard, go to **Project Settings > API** and copy:
   - `Project URL`
   - `anon public key`
4. In Supabase dashboard, go to **Authentication > URL Configuration**:
   - Add your local URL (for dev): `http://localhost:5173`
   - Add your production URL (for Vercel): `https://YOUR_APP.vercel.app`

> Note: `supabase/schema.sql` is a full schema setup script. Review before running in production.

---

## 2) Environment Variables

Create `.env` in project root (or copy from `.env.example`):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

---

## 3) Run Locally

```bash
npm install
npm run dev
```

App will run at:

- `http://localhost:5173`

Production build locally:

```bash
npm run build
npm run preview
```

---

## 4) Deploy to Vercel

1. Push this project to GitHub.
2. In Vercel, click **New Project** and import your repo.
3. Vercel build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.
6. Copy your Vercel URL and add it in Supabase:
   - **Authentication > URL Configuration**
   - Site URL + redirect URLs

---

## 5) Security Notes

- Authorization is enforced in Supabase via RLS, not only UI.
- UI hides restricted pages/actions based on current role.
- If a user is deactivated, access is blocked with a user-friendly message.

---

## 6) Useful Scripts

```bash
npm run dev     # start local dev server
npm run lint    # run eslint
npm run build   # production build
npm run preview # preview built app
```
