# BreakDesk

A break request & tracking manager for teams. Employees request breaks, admins approve/reject them in real time, and everyone gets a 30‑day history with overtime tracking.

Built with React + [Vite](https://vitejs.dev/) and [lucide-react](https://lucide.dev/) icons.

## Project structure

```
breakdesk/
├── .github/workflows/deploy.yml   # auto-deploys to GitHub Pages on push to main
├── src/
│   ├── App.jsx                    # the whole app (auth, dashboard, admin views)
│   ├── main.jsx                   # React entry point
│   └── index.css                  # global styles / font import
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

## Deploying to GitHub Pages

This repo includes a ready-made GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys the site automatically on every push to `main`.

1. Push this project to a new GitHub repository.
2. In the repo, go to **Settings → Pages**, and under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab). The site will be published at `https://<your-username>.github.io/<repo-name>/`.

### Deploying elsewhere

The build output in `dist/` is a plain static site, so it also works as-is on Netlify, Vercel, Cloudflare Pages, or any static host — just point the host's build command at `npm run build` and its output directory at `dist`.

## Default admin login

On first run the app seeds one admin account:

- **Name:** `admin`
- **Password:** `admin123`

Change or remove this before using the app for real — see "Data & security notes" below.

## Data & security notes

This app was adapted from a Claude.ai artifact that used Claude's built-in `window.storage` API. That API only exists inside claude.ai, so it's been replaced with the browser's `localStorage` (see `loadShared`/`saveShared` in `src/App.jsx`) so the app runs as a normal website.

**Important limitation:** `localStorage` is scoped to one browser on one device. That means:

- Two people using the app on *different* devices/browsers will **not** see each other's data — an admin on a laptop won't see a break request an employee submitted on their phone.
- Everything (including password hashes) lives in the visitor's own browser, unencrypted at rest.

This is fine for a demo, a kiosk-style single shared computer, or local testing. For real multi-user, multi-device use you'll want to swap `loadShared`/`saveShared` for a real backend, e.g.:

- [Supabase](https://supabase.com/) or [Firebase](https://firebase.google.com/) (managed database + auth, generous free tiers, minimal setup)
- Your own small API (Node/Express, etc.) backed by Postgres/SQLite

Because both helper functions are already `async` and centralized in one place near the top of `src/App.jsx`, swapping in a real backend later is a matter of rewriting those two functions — the rest of the app doesn't need to change.

Also note passwords are hashed with SHA-256 client-side with no salt — adequate for keeping honest people out, not a substitute for a real auth system if this is used outside a trusted team.

## License

Feel free to use and modify this project for your own team.
