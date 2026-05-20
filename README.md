# 🔐 Auth System Backend

Node.js + Express + MySQL authentication API with JWT, refresh tokens, email verification, and role-based access control.

## Live URLs

| Service | URL |
|---------|-----|
| **Backend API** | `https://auth-system-backend-j7xw.onrender.com` |
| **API Docs** | `https://auth-system-backend-j7xw.onrender.com/api-docs` |
| **Health Check** | `https://auth-system-backend-j7xw.onrender.com/health` |
| **Frontend** | `https://jolly-valkyrie-e7a535.netlify.app` |

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Set up MySQL database
- **Local**: Create a database named `auth_system_db`
- **Railway**: Use the provided connection details and set `DB_SSL=true`

### 4. Start the server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will:
1. Connect to MySQL
2. Auto-create the `users` table
3. Generate an Ethereal email test account
4. Start listening on port 4000

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /accounts/register | Public | Register + verification email |
| POST | /accounts/verify-email | Public | Verify email with token |
| POST | /accounts/authenticate | Public | Login → JWT + refresh cookie |
| POST | /accounts/refresh-token | Cookie | Rotate refresh token |
| POST | /accounts/revoke-token | JWT | Logout (revoke token) |
| POST | /accounts/forgot-password | Public | Send reset email |
| POST | /accounts/validate-reset-token | Public | Validate reset token |
| POST | /accounts/reset-password | Public | Reset password |
| GET | /accounts | Admin | List all users |
| GET | /accounts/:id | JWT | Get user by ID |
| POST | /accounts | Admin | Create user |
| PUT | /accounts/:id | JWT | Update user |
| DELETE | /accounts/:id | JWT | Delete user |

## Deployment (Render)

### Environment Variables (set in Render dashboard)
```
PORT=4000
NODE_ENV=production
MYSQLHOST=<mysql-host>
MYSQLPORT=<mysql-port>
MYSQLUSER=<mysql-user>
MYSQLPASSWORD=<mysql-password>
MYSQLDATABASE=<mysql-database>
JWT_SECRET=<strong-random-secret>
CORS_ORIGIN=https://YOUR-FRONTEND.netlify.app
```

### Render Settings
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`

## Project Structure

```
auth-system-backend/
├── server.js                       # Express entry point
├── package.json
├── .env / .env.example             # Environment variables
├── swagger.yaml                    # OpenAPI documentation
├── src/
│   ├── _helpers/
│   │   ├── db.js                   # MySQL2 connection + SSL
│   │   └── swagger.js              # Swagger UI setup
│   ├── controllers/
│   │   ├── auth.controller.js      # Auth logic
│   │   └── users.controller.js     # CRUD logic
│   ├── middleware/
│   │   ├── authorize.js            # JWT + RBAC
│   │   ├── validate-request.js     # Joi validation
│   │   └── error-handler.js        # Global errors
│   ├── routes/
│   │   ├── auth.routes.js          # Auth endpoints
│   │   └── users.routes.js         # User endpoints
│   └── services/
│       └── email.service.js        # Nodemailer + Ethereal
└── README.md
```
