from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database.models import get_db, User
from .schemas import UserCreate, UserLogin, UserResponse, Token
from .utils import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, response: Response, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(
        or_(
            User.email == user_in.email,
            (User.phone_number == user_in.phone_number) if user_in.phone_number else False
        )
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or phone number already exists"
        )
        
    hashed_password = get_password_hash(user_in.password)
    
    new_user = User(
        name=user_in.name,
        age=user_in.age,
        email=user_in.email,
        phone_number=user_in.phone_number,
        city=user_in.city,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create token and set HTTP-only cookie
    access_token = create_access_token(data={"sub": str(new_user.id)})
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=1440 * 60, # 24 hours
        samesite="lax",
        secure=False, # Set to True in production with HTTPS
    )
    
    return new_user

@router.post("/login")
def login(user_credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    # Can login with either email or phone_number
    user = db.query(User).filter(
        or_(
            User.email == user_credentials.login_id,
            User.phone_number == user_credentials.login_id
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Credentials"
        )
        
    if not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Credentials"
        )
        
    access_token = create_access_token(data={"sub": str(user.id)})
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=1440 * 60, # 24 hours
        samesite="lax",
        secure=False, # Set to True in production with HTTPS
    )
    
    return {"message": "Logged in successfully"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
