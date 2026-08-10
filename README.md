# ED.APP Backend

ED.APP Backend is an Express + TypeScript API for staff registration, email verification, authentication, and password recovery. It uses Supabase as the data store and Nodemailer for email delivery.

## Features

- Role-based staff registration for nurses, doctors, and admins
- Email verification with a 6-digit code
- Login with either a work email or staff ID
- Password reset flow with secure reset links
- JWT-based authentication for protected routes

## Tech Stack

- Node.js 18+
- TypeScript
- Express
- Supabase JavaScript client
- JWT + bcrypt
- Nodemailer

## Project Structure

- `src/app.ts` - Express app entry point
- `src/routes/` - API route definitions
- `src/controllers/` - request handlers
- `src/services/` - email delivery helpers
- `src/config/` - external service configuration
- `src/middlewares/` - auth and authorization middleware

## Prerequisites

- Node.js 18 or newer
- npm
- A Supabase project
- SMTP credentials for sending emails

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update the values for your local environment.

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=5010
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

> Keep your `.env` file private and do not commit it to version control.

## Running the Server

Development mode:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run the compiled build:

```bash
npm start
```

## API Endpoints

### Health Check

- `GET /` - returns a simple health check response

### Authentication Routes

- `POST /api/v1/auth/register/nurse`
- `POST /api/v1/auth/register/doctor`
- `POST /api/v1/auth/register/admin`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

## Notes

The backend expects a Supabase `staff` table with the fields used by the auth flow, including:

- `first_name`
- `last_name`
- `work_email`
- `staff_id`
- `password_hash`
- `role`
- `is_verified`
- `verification_code`
- `verification_expires`
- `reset_token`
- `reset_expires`
