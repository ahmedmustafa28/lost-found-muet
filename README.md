# Lost & Found MUET

A website where people at MUET report lost and found items, search active
reports, and privately claim items. Built with Next.js and Supabase.

- Full specification: [`DEVELOPMENT.md`](DEVELOPMENT.md)
- Rules for AI coding agents: [`AGENTS.md`](AGENTS.md)

## Getting started

You need [Node.js](https://nodejs.org/) 20.9 or newer and access to the
development Supabase project.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up `.env.local`**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `.env.local` from the Supabase dashboard (**Project Settings →
   API Keys**, or the **Connect** dialog):

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | The project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key (`sb_publishable_...`) |
   | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local development |

   Never add a service-role or secret key, and never commit `.env.local`.

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

Before opening a pull request, check that these pass:

```bash
npm run lint
npm run build
```
