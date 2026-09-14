# BreakDesk

A break request & tracking manager for teams. Employees request breaks, admins approve/reject them in real time, and everyone gets a 30‑day history with overtime tracking.

Built with React + [Vite](https://vitejs.dev/) and [lucide-react](https://lucide.dev/) icons.

## Project structure

```
breakdesk/
├── .github/workflows/deploy.yml   # auto-deploys to GitHub Pages on push to main
├── src/
│   ├── App.jsx                    # the whole app (auth, dashboard, admin views)
│   ├── supabase.js                # Supabase client, data access, and migration
│   ├── main.jsx                   # React entry point
│   └── index.css                  # global styles / font import
├── supabase/schema.sql             # tables and browser policies used by the app
├── index.html                     # Vite HTML entry point
├── package.json
├── vite.config.js
└── .gitignore
```

## Running locally

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Building for production

```bash
npm run build
npm run preview   # optional: preview the production build locally
```

The static site is output to `dist/`.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor before opening the app.
The browser client reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` when supplied; the configured project values
are safe browser fallbacks for GitHub Pages. Never put a `service_role` key in
this repository or in a Vite environment variable.

On its first load, the app inserts the `Mohamed Hatem` /
`Mohamed642002` admin account if absent and migrates legacy
`ebms:employees` and `ebms:requests` localStorage arrays once. Only the login
session remains in localStorage afterward; shared employees and requests are
loaded from Supabase and refreshed periodically for other devices.

## Deploying to GitHub Pages

This repo includes a ready-made GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys the site automatically on every push to `main`.

1. Push this project to a new GitHub repository.
2. In the repo, go to **Settings → Pages**, and under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab). The site will be published at `https://<your-username>.github.io/<repo-name>/`.

### Deploying elsewhere

The build output in `dist/` is a plain static site, so it also works as-is on Netlify, Vercel, Cloudflare Pages, or any static host — just point the host's build command at `npm run build` and its output directory at `dist`.

## Default admin login

On first run the app seeds one admin account:

- **Name:** `Mohamed Hatem`
- **Password:** `Mohamed642002`

## Data & security notes

Employees and break requests are shared through Supabase. The existing custom
login is intentionally preserved, including its SHA-256 client-side password
hashing and local session persistence. This is suitable for the current trusted
team workflow, but it is not a replacement for Supabase Auth: for a
security-sensitive deployment, use a proper authenticated backend and tighter
row-level policies than the anonymous policies in `supabase/schema.sql`.

## License

Feel free to use and modify this project for your own team.
