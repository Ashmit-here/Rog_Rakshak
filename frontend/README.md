# Rog_Rakshak

Rog_Rakshak is an area-based disease surveillance project. Its first development
stage includes a React landing page and an Express health-check API. The page
does not display disease statistics.

## Run locally

Start the backend in one terminal:

```sh
cd backend
cp .env.example .env
npm run dev
```

Start the frontend in another terminal:

```sh
cd frontend
npm run dev
```

The backend runs at `http://localhost:5001` and the Vite frontend at
`http://localhost:5173`. The frontend checks `GET /api/health` and displays the
connection status. Set `VITE_API_BASE_URL` if the API uses a different base URL.

## Backend configuration

`backend/.env.example` documents the supported settings:

- `PORT`: API port (defaults to `5001`)
- `FRONTEND_URL`: allowed frontend origin for CORS (defaults to
  `http://localhost:5173`)

## Backend API

- `GET /api/health` — returns the API status and current timestamp.
- Other paths return a JSON 404 response.
