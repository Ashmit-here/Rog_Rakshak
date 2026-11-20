# Rog_Rakshak

Rog_Rakshak is an area-based disease surveillance project. The React application
provides a public dashboard of verified aggregate statistics and role-based
workspace entry points.

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
connection status. Set `VITE_API_BASE_URL` to the API root (including `/api`) if
the backend uses a different base URL.

Sign-in uses `POST /api/auth/login` and validates the session with
`GET /api/auth/me`. The public dashboard uses
`GET /api/public/statistics`; only verified aggregate data is shown. The JWT is
kept in `sessionStorage` and is not displayed.

## Frontend configuration

- `VITE_API_BASE_URL`: API root including `/api` (defaults to
  `http://localhost:5001/api`)

## Frontend roles

- `PUBLIC`: public statistics dashboard
- `HOSPITAL`: hospital workspace navigation
- `MEDICAL_OFFICER`: review workspace navigation
- `ADMIN`: administration placeholder

Report submission, report review, and administration interfaces are intentionally
not part of this milestone.

## Backend API

- `GET /api/health` — returns the API status and current timestamp.
- `POST /api/auth/login` and `GET /api/auth/me` — authentication.
- `GET /api/public/statistics` — verified aggregate statistics.
