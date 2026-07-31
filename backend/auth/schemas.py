from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class UserCreate(BaseModel):
    name: str = Field(..., example="John Doe")
    age: int = Field(..., example=30)
    email: EmailStr = Field(..., example="john@example.com")
    phone_number: str = Field(..., example="+1234567890")
    city: str = Field(..., example="New York")
    password: str = Field(..., min_length=6, example="secret123")

class UserLogin(BaseModel):
    # User can login with either email or phone_number
    login_id: str = Field(..., description="Email or phone number")
    password: str

class UserResponse(BaseModel):
    id: UUID
    name: str
    age: int
    email: str
    phone_number: str
    city: str
    created_at: datetime

    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str
