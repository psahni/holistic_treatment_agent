# Implementation Plan: User Authentication & Neon DB Integration

This plan outlines the architecture for introducing user accounts, authentication (Login/Signup), and Neon PostgreSQL integration into the Holistic Treatment Agent.

## Goal Description
Implement secure user registration and login functionality backed by a relational PostgreSQL database (Neon DB). The User entity will store profile and account information (Name, age, email, phone number, city) which will lay the groundwork for saving historical consultation sessions and prescriptions.

## Approved Architectural Decisions
1. **Database Refactoring**: We will keep `PatientProfile` separate but link it to the `User` account via a `user_id` foreign key. This allows a user to have multiple profiles (e.g., for family members).
2. **Login Credentials**: Users can log in using either their **Email** OR their **Phone Number**.
3. **Token Storage**: JWT access tokens will be stored in **HTTP-only cookies** for enhanced frontend security.

## Proposed Changes

### Backend Dependencies
#### [MODIFY] backend/requirements.txt
- Add `passlib[bcrypt]` for secure password hashing.
- Add `PyJWT` for generating and verifying JSON Web Tokens.
- Add `bcrypt` as the underlying hashing algorithm.

### Database Models
#### [MODIFY] backend/memory/patient_profile.py (moved to database/models.py)
- Rename/Split this file into a dedicated `backend/database/models.py`.
- **[NEW] User Model**: Add the `User` SQLAlchemy model with fields:
  - `id`: UUID (Primary Key)
  - `name`: String
  - `age`: Integer
  - `email`: String (Unique, Indexed)
  - `phone_number`: String (Unique)
  - `city`: String
  - `hashed_password`: String
  - `created_at`: DateTime
- Link existing `ConsultationSession` and `PatientProfile` to the `User` model using a `user_id` foreign key.

### Authentication Logic
#### [NEW] `backend/auth/schemas.py`
- Create Pydantic models for `UserCreate` (Signup), `UserLogin` (accepts email or phone), and `UserResponse`.
#### [NEW] `backend/auth/utils.py`
- Implement password hashing and verification using `passlib`.
- Implement JWT token generation and decoding `create_access_token()`.
- Implement FastAPI dependency `get_current_user()` that reads the JWT from the HTTP-only cookie.
#### [NEW] `backend/auth/router.py`
- `POST /api/auth/signup`: Validates input, hashes password, saves to Neon DB, sets HTTP-only cookie.
- `POST /api/auth/login`: Authenticates user (email or phone), sets HTTP-only cookie.
- `POST /api/auth/logout`: Clears the HTTP-only cookie.
- `GET /api/auth/me`: Returns the current logged-in user details.

### Main Application
#### [MODIFY] backend/main.py
- Include the new authentication API router.
- Configure CORS to allow credentials (`allow_credentials=True`) since we are using cookies.
- Ensure the app mounts the routers correctly.
