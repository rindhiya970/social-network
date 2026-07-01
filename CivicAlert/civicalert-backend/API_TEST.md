# CivicAlert API Testing Guide

## Quick Start

### 1. Start the Server
```bash
cd civicalert-backend
npm run dev
```

Expected output:
```
✅ Server running on port 5000
📍 API available at http://localhost:5000
MongoDB Connected: cluster0.jkmi8r8.mongodb.net
```

### 2. Test Root Endpoint
```bash
curl http://localhost:5000
```

Expected response:
```json
{
  "message": "CivicAlert Backend API Running 🚀",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/api/auth",
    "test": "/api/test"
  }
}
```

## Test Scenarios

### Scenario 1: Register a Citizen User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John Citizen\",\"email\":\"john@citizen.com\",\"password\":\"password123\"}"
```

✅ **Expected:** Status 201, returns token and user with `role: "citizen"`

**Save the token** for next steps!

### Scenario 2: Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"john@citizen.com\",\"password\":\"password123\"}"
```

✅ **Expected:** Status 200, returns token and user object

### Scenario 3: Get Current User

Replace `YOUR_TOKEN` with the actual token from registration/login:

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

✅ **Expected:** Status 200, returns user details

### Scenario 4: Access Citizen Test Route

```bash
curl -X GET http://localhost:5000/api/test/citizen \
  -H "Authorization: Bearer YOUR_TOKEN"
```

✅ **Expected:** Status 200, success message

### Scenario 5: Try Accessing Official Route (Should Fail)

```bash
curl -X GET http://localhost:5000/api/test/official \
  -H "Authorization: Bearer YOUR_TOKEN"
```

❌ **Expected:** Status 403 Forbidden (citizen cannot access official route)

### Scenario 6: Create Admin User (Manual Database Update)

Since registration only creates citizens, manually promote a user to admin via MongoDB:

**Option A: MongoDB Compass**
1. Open MongoDB Compass
2. Connect to your database
3. Find the `users` collection
4. Edit a user document and change `role` to `"admin"`

**Option B: MongoDB Shell**
```javascript
use your_database_name

db.users.updateOne(
  { email: "john@citizen.com" },
  { $set: { role: "admin" } }
)
```

**Option C: Create a new admin registration**

First, register a new user:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Admin User\",\"email\":\"admin@civic.com\",\"password\":\"admin123\"}"
```

Then update in database to admin role.

### Scenario 7: Test Admin Access

Login as admin and get new token:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@civic.com\",\"password\":\"admin123\"}"
```

Test admin route:
```bash
curl -X GET http://localhost:5000/api/test/admin \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

✅ **Expected:** Status 200, success message

### Scenario 8: Test Security - Role Cannot Be Set During Registration

Try to register with admin role (should be ignored):
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Hacker\",\"email\":\"hacker@bad.com\",\"password\":\"password123\",\"role\":\"admin\"}"
```

✅ **Expected:** User is still created as `"citizen"`, role parameter is ignored

### Scenario 9: Test Validation

**Missing fields:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\"}"
```
❌ **Expected:** Status 400, "Please provide all required fields"

**Short password:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"email\":\"test@test.com\",\"password\":\"123\"}"
```
❌ **Expected:** Status 400, "Password must be at least 6 characters long"

**Duplicate email:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John Citizen\",\"email\":\"john@citizen.com\",\"password\":\"password123\"}"
```
❌ **Expected:** Status 400, "User with this email already exists"

### Scenario 10: Test Invalid Token

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer invalid_token_here"
```

❌ **Expected:** Status 401, "Unauthorized: Invalid or missing token"

### Scenario 11: Test No Token

```bash
curl -X GET http://localhost:5000/api/auth/me
```

❌ **Expected:** Status 401, "Unauthorized: Invalid or missing token"

## Postman Collection

You can also import these requests into Postman:

1. Create new collection "CivicAlert API"
2. Add requests:
   - POST `{{baseUrl}}/api/auth/register`
   - POST `{{baseUrl}}/api/auth/login`
   - GET `{{baseUrl}}/api/auth/me` (with Bearer Token)
   - GET `{{baseUrl}}/api/test/citizen` (with Bearer Token)
   - GET `{{baseUrl}}/api/test/official` (with Bearer Token)
   - GET `{{baseUrl}}/api/test/admin` (with Bearer Token)
3. Set environment variable: `baseUrl = http://localhost:5000`
4. After login, set token in environment or use Postman's auth tab

## Expected Results Summary

| Endpoint | Method | Auth | Expected Status |
|----------|--------|------|-----------------|
| `/` | GET | None | 200 |
| `/api/auth/register` | POST | None | 201 |
| `/api/auth/login` | POST | None | 200 |
| `/api/auth/me` | GET | JWT | 200 |
| `/api/test/citizen` | GET | JWT (citizen) | 200 |
| `/api/test/citizen` | GET | JWT (official) | 403 |
| `/api/test/official` | GET | JWT (official) | 200 |
| `/api/test/official` | GET | JWT (citizen) | 403 |
| `/api/test/admin` | GET | JWT (admin) | 200 |
| `/api/test/admin` | GET | JWT (citizen) | 403 |

## Troubleshooting

### Server won't start
- Check if MongoDB URI is correct in `.env`
- Ensure MongoDB Atlas cluster allows connections from your IP
- Check if port 5000 is already in use

### "User not found" errors
- Verify JWT token is not expired (7 days validity)
- Check if user exists in database
- Ensure proper Authorization header format: `Bearer TOKEN`

### Role access denied
- Verify user role in database matches required role
- Check if JWT token belongs to correct user
- Try logging in again to get fresh token

### CORS errors (when using frontend)
- CORS is already enabled in server.js
- Check if frontend origin is allowed

## Success Criteria ✅

Phase 1 is complete when:

- ✅ Users can register with automatic "citizen" role
- ✅ Users cannot self-assign "admin" or "official" roles
- ✅ Login returns valid JWT token
- ✅ Protected routes verify JWT correctly
- ✅ Role middleware blocks unauthorized access with 403
- ✅ Password is hashed and never returned in responses
- ✅ Email validation and uniqueness enforced
- ✅ All test routes work for their respective roles
- ✅ JWT strategy validates tokens properly
- ✅ Local strategy validates email/password correctly

---

**All tests passing = Phase 1 Complete! 🎉**
