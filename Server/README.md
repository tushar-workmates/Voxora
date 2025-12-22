# Voxora Server - Fastify MongoDB Authentication API

A Node.js authentication API built with Fastify framework and MongoDB database.

## Features

- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- MongoDB integration with Mongoose
- Clean error handling with custom error classes
- Modular project structure

## Project Structure

```
Server/
├── config/
│   └── db.js                 # MongoDB connection
├── controllers/
│   └── authController.js     # Authentication logic
├── middleware/
│   └── auth.js              # JWT verification middleware
├── models/
│   └── User.js              # User model with Mongoose
├── routes/
│   └── authRoutes.js        # Authentication routes
├── utils/
│   ├── ApiResponseHandle.js # Success response handler
│   └── ApiErrorHandle.js    # Error response handler
├── app.js                   # Main application file
├── .env                     # Environment variables
└── package.json
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/voxora
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=3000
```

3. Make sure MongoDB is running on your system

4. Start the server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

## API Endpoints

### Authentication Routes

#### POST /register
Register a new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "companyWebsite": "https://example.com",
  "changePassword": "optional"
}
```

#### POST /login
Login with existing credentials
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /logout
Logout (placeholder for token invalidation)

#### GET /protected
Protected route that requires JWT token in Authorization header
```
Authorization: Bearer <your-jwt-token>
```

## User Model

The User model includes:
- `email` (required, unique)
- `password` (required, hashed with bcrypt)
- `companyWebsite` (optional string)
- `changePassword` (optional string, default empty)

## Response Format

### Success Response
```json
{
  "statusCode": 200,
  "data": {...},
  "message": "Success message",
  "success": true
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error message",
  "success": false,
  "errors": []
}
```

## Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `PORT`: Server port (default: 3000)

## Development

For development with auto-reload:
```bash
npm run dev
```

This uses nodemon to automatically restart the server when files change.
