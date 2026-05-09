# HouseBilling

HouseBilling is an open-source rental billing platform with:
- a Cloudflare Workers backend API (`backend/`)
- a Next.js frontend (`frontend/`)

It helps landlords manage monthly rent, electricity meter billing, other charges (Moylar Bill), payments, and outstanding dues.

## Project Structure

- `backend/` - Hono + Cloudflare Workers API, D1 database, R2 storage, Workers AI meter scan support
- `frontend/` - Next.js 16 app for admin and tenant billing UI

## Features

- Tenant management
- Monthly invoice generation
- Electricity billing from meter readings
- Manual and AI-assisted meter scan flows
- Payment tracking and due calculations
- Public/tenant-friendly monthly billing board
- Printable monthly reports

## Tech Stack

### Backend
- Cloudflare Workers + Hono
- Cloudflare D1 (SQLite)
- Cloudflare R2
- Cloudflare Workers AI
- Wrangler + TypeScript

### Frontend
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS
- Radix UI + CVA

## Prerequisites

- Node.js 20+
- npm
- Cloudflare account (for deploy and cloud resources)
- Wrangler CLI (available through backend dependencies)

## Local Setup

### 1) Clone and install

```bash
git clone https://github.com/adnansamirswe/HouseBilling.git
cd HouseBilling
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

### 2) Configure environment

Frontend:

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8787
```

Backend:
- Configure Cloudflare bindings in `backend/wrangler.jsonc` for:
  - D1 (`DB`)
  - R2 (`BUCKET`)
  - AI (`AI`)

### 3) Initialize database

From `backend/`:

```bash
npm run db:migrate:local
```

### 4) Run development servers

Backend (from `backend/`):

```bash
npm run dev
```

Frontend (from `frontend/`):

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`, backend on Wrangler local URL (typically `http://localhost:8787`).

## Deployment

### Backend

From `backend/`:

```bash
npm run deploy
```

### Frontend

Deploy with your preferred platform (Vercel/Cloudflare Pages/etc.), and set:

```env
NEXT_PUBLIC_API_URL=<your-deployed-backend-url>
```

## Scripts

### Backend (`backend/package.json`)
- `npm run dev`
- `npm run deploy`
- `npm run test`
- `npm run db:migrate`
- `npm run db:migrate:local`

### Frontend (`frontend/package.json`)
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Contributing

Contributions are welcome.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push your branch
5. Open a Pull Request

Please keep PRs focused and include screenshots for UI changes.

## Security Notes

- Do not commit secrets or production credentials.
- Use `.env.local` for local-only frontend env values.
- Rotate leaked credentials immediately.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

