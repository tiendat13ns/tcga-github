import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from supabase import Client, create_client

from app.core.auth import get_current_user, get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Danh sách email được cấp quyền admin — cấu hình qua env (phân tách bằng dấu phẩy), không
# hardcode trong logic. Mặc định giữ email admin hiện tại để không đổi hành vi nếu chưa set env.
ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "dat96133@gmail.com").split(",")
    if e.strip()
}


def _is_admin_email(email: str | None) -> bool:
    return bool(email) and email.lower() in ADMIN_EMAILS

# We only create the client if the env vars are present
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


class UserRegister(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register_user(user_in: UserRegister, db: Session = Depends(get_db)) -> Any:
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase credentials are not configured",
        )
    
    # Check if user already exists in public.users to avoid unnecessary calls
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    try:
        response = supabase.auth.sign_up({
            "email": user_in.email,
            "password": user_in.password,
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not response.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to register user",
        )

    # Insert into public.users
    user_role = "admin" if _is_admin_email(user_in.email) else "user"
    initial_credits = 3500 if user_role == "admin" else 300
    new_user = User(
        id=response.user.id,
        email=user_in.email,
        role=user_role,
        credit_balance=initial_credits
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created successfully",
        "user_id": new_user.id,
        "access_token": response.session.access_token if response.session else None
    }


@router.post("/login")
def login_user(user_in: UserLogin, db: Session = Depends(get_db)) -> Any:
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase credentials are not configured",
        )

    try:
        response = supabase.auth.sign_in_with_password({
            "email": user_in.email,
            "password": user_in.password,
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not response.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not retrieve session",
        )

    # Ensure user exists in our local DB as well
    user = db.query(User).filter(User.id == response.user.id).first()
    if not user:
        user_role = "admin" if _is_admin_email(response.user.email) else "user"
        initial_credits = 3500 if user_role == "admin" else 300
        # Fallback in case they were created in supabase but not synced here
        user = User(
            id=response.user.id,
            email=response.user.email,
            role=user_role,
            credit_balance=initial_credits
        )
        db.add(user)
        db.commit()
    elif _is_admin_email(user.email):
        if user.role != "admin":
            user.role = "admin"
        if user.credit_balance < 3500:
            user.credit_balance = 3500
        db.commit()

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "token_type": "bearer",
    }



@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "credit_balance": current_user.credit_balance,
        "created_at": current_user.created_at,
    }
