# CivicAlert Backend API

## Phase 1: Authentication and Role-Based Access Control

Production-ready backend for CivicAlert civic issue reporting platform.

## Technology Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Passport.js** - Authentication (Local + JWT strategies)
- **JWT** - Token-based authentication
- **bcryptjs** - Password hashing

## Project Structure (MVC)

```
civicalert-backend/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── passport.js        # Passport Local & JWT strategies
│   ├── controllers/
│   │   └── auth.controller.js # Auth logic (register, login, getMe)
│   ├── middleware/
│   │   ├── auth.middleware.js # JWT verification
│   │   └── role.middleware.js # Role-based access control
│   ├── models/
│   │   └── User.model.js      # User schema
│   ├── routes/
│   │   ├── auth.routes.js     # Auth endpoints
│   │   └── test.routes.js     # Role testing endpoints
│   └── server.js              # Entry point
├── .env                       # Environment variables
└── package.json
```

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## User Model

```javascript
{
  name: String (required)
  email: String (required, unique, lowercase)
  passwordHash: String (required, min 6 chars, auto-hashed)
  role: String (enum: ["citizen", "official", "admin"], default: "citizen")
  wardId: String (optional)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

## API Endpoints

### Authentication Routes

#### 1. Register User (Citizen)
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "citizen",
    "wardId": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Notes:**
- Role is automatically set to `"citizen"`
- Users CANNOT choose `"admin"` or `"official"` during registration
- Password must be at least 6 characters
- Email must be unique

#### 2. Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "citizen",
    "wardId": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 3. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "citizen",
    "wardId": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Test Routes (Role-Based Access Control)

#### 1. Citizen Test Route
```http
GET /api/test/citizen
Authorization: Bearer <token>
```

**Access:** Only `citizen` role  
**Response (200):**
```json
{
  "message": "✅ Citizen route accessed successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "citizen"
  }
}
```

**Error (403):**
```json
{
  "message": "Forbidden: You do not have permission to access this resource",
  "requiredRole": ["citizen"],
  "yourRole": "official"
}
```

#### 2. Official Test Route
```http
GET /api/test/official
Authorization: Bearer <token>
```

**Access:** Only `official` role  
**Response:** Similar to citizen route

#### 3. Admin Test Route
```http
GET /api/test/admin
Authorization: Bearer <token>
```

**Access:** Only `admin` role  
**Response:** Similar to citizen route

## Security Features

✅ **Password Hashing:** bcrypt with salt rounds  
✅ **JWT Authentication:** 7-day token expiration  
✅ **Role-Based Access Control:** Enforced at middleware level  
✅ **Automatic Citizen Role:** Users cannot self-promote to admin/official  
✅ **Password Hiding:** Passwords never returned in responses  
✅ **Input Validation:** Email format, password length, required fields  
✅ **Unique Email Constraint:** Prevents duplicate accounts  

## Middleware

### `authenticateJWT`
Verifies JWT token from `Authorization: Bearer <token>` header and attaches user to `req.user`.

### `allowRoles(...roles)`
Checks if authenticated user has one of the specified roles. Returns 403 if unauthorized.

**Example Usage:**
```javascript
router.get("/admin-only", authenticateJWT, allowRoles("admin"), controller);
router.get("/staff", authenticateJWT, allowRoles("official", "admin"), controller);
```

## Passport Strategies

### Local Strategy
- Validates email and password
- Used by `/api/auth/login`

### JWT Strategy
- Extracts and validates JWT from Authorization header
- Used by protected routes via `authenticateJWT` middleware

## Error Responses

### 400 Bad Request
```json
{
  "message": "Please provide all required fields: name, email, password"
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthorized: Invalid or missing token"
}
```

### 403 Forbidden
```json
{
  "message": "Forbidden: You do not have permission to access this resource",
  "requiredRole": ["admin"],
  "yourRole": "citizen"
}
```

### 404 Not Found
```json
{
  "message": "Route not found"
}
```

### 500 Server Error
```json
{
  "message": "Server error during registration",
  "error": "Error details here"
}
```

## Testing the API

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Get Current User:**
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Test Citizen Route:**
```bash
curl -X GET http://localhost:5000/api/test/citizen \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Import the endpoints
2. Register a user → Save the token
3. Use the token in Authorization header as "Bearer Token"
4. Test protected routes

## Creating Admin/Official Users

Since registration automatically creates `citizen` users, you need to manually update the database to create admin or official users:

**MongoDB Shell:**
```javascript
use civicalert

// Create admin user
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)

// Create official user
db.users.updateOne(
  { email: "official@example.com" },
  { $set: { role: "official", wardId: "ward-123" } }
)
```

**Or use Mongoose script:**
```javascript
const User = require('./src/models/User.model');

// Update existing user to admin
await User.findOneAndUpdate(
  { email: "admin@example.com" },
  { role: "admin" }
);
```

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Use environment-specific MongoDB URI
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Add request logging
- [ ] Add MongoDB indexes for email field
- [ ] Set up proper CORS origins
- [ ] Add input sanitization
- [ ] Enable compression middleware
- [ ] Set up monitoring and error tracking

## Next Steps (Future Phases)

- Issue reporting CRUD
- Image uploads
- Ward management
- Status tracking
- Notifications
- Analytics dashboard

## License

MIT

---

**Phase 1 Complete ✅**  
Authentication and Role-Based Access Control fully implemented and ready for production use.
