# Rog Rakshak 🏥

**An Area-Based Disease Surveillance and Reporting System**

Rog Rakshak is a web-based disease surveillance platform designed to help hospitals report disease cases and allow Medical Officers to review and verify those reports. It provides a public dashboard displaying aggregated statistics based only on verified reports.

The system aims to improve disease monitoring, reporting transparency, and access to reliable public health information.

## ✨ Key Features

- **Role-Based Access Control:** Separate access for Public Users, Hospitals, Medical Officers, and Admin.
- **Hospital Reporting:** Hospitals can submit disease reports with case counts and area information.
- **Report Verification:** Medical Officers can review, verify, or reject submitted reports.
- **Public Dashboard:** Displays aggregated disease statistics from verified reports only.
- **Area-Based Monitoring:** Supports filtering statistics by area and disease.
- **Secure Authentication:** JWT-based authentication and bcrypt password hashing.
- **Report History:** Hospitals can view their submitted reports, while Medical Officers can view review history.
- **Data Validation:** Backend validation and centralized error handling.

## 🛠️ Technology Stack

| Layer             | Technology           |
| ----------------- | -------------------- |
| Frontend          | React.js             |
| Build Tool        | Vite                 |
| Backend           | Node.js              |
| API Framework     | Express.js           |
| Database          | PostgreSQL           |
| ORM               | Prisma               |
| Authentication    | JSON Web Token (JWT) |
| Password Security | bcryptjs             |
| Testing           | Node.js Test Runner  |

## 🏗️ System Architecture

```text
          Users
            |
            v
     React + Vite Frontend
            |
            v
      Express.js REST API
            |
     Authentication &
     Authorization
            |
            v
        Prisma ORM
            |
            v
       PostgreSQL
```

The frontend communicates with the backend through REST APIs. The backend handles authentication, authorization, validation, report processing, and database operations through Prisma.

## 📁 Project Structure

```text
Rog_Rakshak/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   ├── seedDemoData.js
│   │   └── seedTestData.js
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── cors.js
│   │   │   ├── environment.js
│   │   │   └── prisma.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── healthController.js
│   │   │   └── reportController.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── authenticate.js
│   │   │   ├── authorizeRoles.js
│   │   │   ├── errorHandler.js
│   │   │   └── notFound.js
│   │   │
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── healthRoutes.js
│   │   │   ├── publicRoutes.js
│   │   │   └── reportRoutes.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── test/
│   │   ├── auth.test.js
│   │   ├── reports.test.js
│   │   ├── seedDemoData.test.js
│   │   └── seedTestSafety.test.js
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   │
│   │   ├── auth/
│   │   │   └── AuthContext.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── HospitalMinePage.jsx
│   │   │   ├── HospitalReportPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── MedicalOfficerHistoryPage.jsx
│   │   │   ├── MedicalOfficerPendingPage.jsx
│   │   │   ├── MedicalOfficerReviewPage.jsx
│   │   │   ├── PublicDashboard.jsx
│   │   │   └── RoleDashboard.jsx
│   │   │
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── .gitignore
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   └── vite.config.js
│
└── .gitignore
```

### Folder Description

- **backend/prisma:** Contains the Prisma database schema, migrations, and seed scripts.
- **backend/src/config:** Contains database, CORS, and environment configuration.
- **backend/src/controllers:** Handles application logic for authentication, health checks, and reports.
- **backend/src/middleware:** Contains authentication, role authorization, and error-handling middleware.
- **backend/src/routes:** Defines the backend API endpoints.
- **backend/test:** Contains automated backend tests.
- **frontend/src/api:** Handles communication with backend APIs.
- **frontend/src/auth:** Contains authentication context and user session management.
- **frontend/src/pages:** Contains the application's React pages.
- **frontend/src:** Also contains the main application components and CSS files.


## 👥 User Roles

### 1. Public User

- Access the public disease surveillance dashboard.
- View aggregated statistics of verified reports.
- Filter statistics by area and disease.
- Cannot access private hospital or patient-related report information.

### 2. Hospital

- Log in using hospital credentials.
- Submit disease reports.
- View reports submitted by their hospital.
- Track report verification status.

### 3. Medical Officer

- View pending reports assigned to their areas.
- Review submitted disease reports.
- Verify or reject reports.
- View previously reviewed reports.

### 4. Admin

- An ADMIN role is defined in the system.
- Initial administrator account creation is supported through database seeding.
- Full administrative management functionality is not yet implemented.

## 🔄 Report Workflow

```text
Hospital submits a report
          |
          v
    PENDING Status
          |
          v
 Medical Officer Review
          |
      +---+---+
      |       |
      v       v
  VERIFIED  REJECTED
      |
      v
Public Dashboard
(Verified Aggregated Data)
```

Only verified reports contribute to public dashboard statistics.

## 🗄️ Database Design

The project uses PostgreSQL with Prisma ORM.

The database includes models for:

- **User and Role:** User accounts and role management.
- **Hospital and HospitalUser:** Hospital information and user memberships.
- **State, District, and Area:** Geographical organization.
- **MedicalOffice and MedicalOfficeArea:** Medical Officer information and assigned areas.
- **Disease:** Supported diseases.
- **DiseaseReport:** Main disease report and its verification status.
- **DiseaseReportLine:** Disease-specific case counts within a report.
- **Alert and PublicNotification:** Database structures for alerts and public notifications.

A disease report can contain multiple disease entries, each with its own case count.

## 🔐 Security Features

- Passwords are stored as bcrypt hashes instead of plain text.
- JWT tokens are used for authenticated API requests.
- Authentication middleware validates incoming tokens.
- Backend authorization checks user roles against database records.
- Medical Officers are restricted to their assigned areas.
- Hospitals are restricted to their permitted reporting areas.
- Report submission uses database transactions.
- Report review prevents unauthorized or repeated review of already processed reports.
- Public statistics include only VERIFIED reports.

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

- Node.js 22.12 or later
- npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Ashmit-here/Rog_Rakshak.git
cd Rog_Rakshak
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Open `backend/.env` and configure the following variables:

```env
PORT=5001
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://postgres:your_password@localhost:5432/rog_rakshak?schema=public"

SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=your_secure_password

TEST_HOSPITAL_EMAIL=rr-test-hospital@rog-rakshak.test
TEST_HOSPITAL_PASSWORD=your_secure_test_password

TEST_MEDICAL_OFFICER_EMAIL=rr-test-officer@rog-rakshak.test
TEST_MEDICAL_OFFICER_PASSWORD=your_secure_test_password

JWT_SECRET=your_random_secret_at_least_32_characters
JWT_EXPIRES_IN=1h
```

Use your own secure passwords and JWT secret. Never commit your `.env` file.

### 3. Create the Database

Create a PostgreSQL database named:

```sql
CREATE DATABASE rog_rakshak;
```

### 4. Generate Prisma Client and Run Migrations

From the `backend` directory:

```bash
npm run db:generate
npm run db:migrate
```

### 5. Seed Initial Data

```bash
npm run db:seed
```

This initializes the system with roles, supported diseases, geographical reference data, and an initial administrator account.

### 6. Create Test Accounts

Configure the test account credentials in `backend/.env`, then run:

```bash
npm run db:seed:test
```

This creates the local test Hospital and Medical Officer accounts and their required assignments.

### 7. Start the Backend

```bash
npm run dev
```

Backend API:

```text
http://localhost:5001
```

### 8. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

The frontend uses the following default API URL:

```text
http://localhost:5001/api
```

To configure a different API URL, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5001/api
```

## 📡 API Endpoints

Base URL:

```text
http://localhost:5001/api
```

### Authentication

| Method | Endpoint      | Description                              |
| ------ | ------------- | ---------------------------------------- |
| POST   | `/auth/login` | Authenticate a user                      |
| GET    | `/auth/me`    | Get the authenticated user's information |

### Hospital

| Method | Endpoint        | Description                 |
| ------ | --------------- | --------------------------- |
| POST   | `/reports`      | Submit a disease report     |
| GET    | `/reports/mine` | View the hospital's reports |

### Medical Officer

| Method | Endpoint              | Description               |
| ------ | --------------------- | ------------------------- |
| GET    | `/reports/pending`    | View pending reports      |
| PATCH  | `/reports/:id/review` | Verify or reject a report |
| GET    | `/reports/history`    | View reviewed reports     |

### Public

| Method | Endpoint                 | Description                     |
| ------ | ------------------------ | ------------------------------- |
| GET    | `/public/statistics`     | Get verified disease statistics |
| GET    | `/public/reference-data` | Get reference data              |

The public statistics endpoint supports optional `areaId` and `diseaseId` filters.

### Health Check

| Method | Endpoint      | Description          |
| ------ | ------------- | -------------------- |
| GET    | `/health`     | Root health response |
| GET    | `/api/health` | API health check     |

## 🧪 Testing

Run backend tests:

```bash
cd backend
npm test
```

Check the frontend:

```bash
cd frontend
npm run lint
npm run build
```

## 🔮 Future Improvements

- Interactive geographical disease maps.
- Automated disease outbreak alerts and notifications.
- Predictive analytics for identifying potential outbreak patterns.
- Expanded administrative management functionality.
- Deployment and production monitoring.
- Additional reporting and data visualization features.

## 🎯 Project Objective

Rog Rakshak aims to provide a centralized and secure platform for disease reporting and surveillance. By combining hospital submissions, Medical Officer verification, and public statistical dashboards, the system helps make disease-related information more organized, reliable, and accessible.

---

**Developed as a college group project .**

**GitHub Repository:** [Ashmit-here/Rog_Rakshak](https://github.com/Ashmit-here/Rog_Rakshak)
