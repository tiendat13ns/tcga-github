import os
import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Bắt buộc phải cấu hình — KHÔNG dùng giá trị mặc định. Trước đây có fallback về một chuỗi
# secret nổi tiếng của Supabase local-dev; nếu quên set env, app chạy với secret rởm và bất
# kỳ ai biết secret đó cũng giả mạo được token. Fail-fast ngay lúc khởi động để không bao giờ
# chạy với secret không an toàn.
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
if not SUPABASE_JWT_SECRET:
    raise RuntimeError(
        "SUPABASE_JWT_SECRET chưa được cấu hình — bắt buộc để xác minh chữ ký JWT. "
        "Đặt biến này trong .env trước khi khởi động backend."
    )
ALGORITHM = "HS256"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_from_token(token: str, db: Session) -> User:
    """
    Xác thực JWT token siêu tốc (0ms) bằng cách decode payload cục bộ.
    Fallback về Supabase SDK nếu local decode thất bại.
    """
    user_id: UUID | None = None

    # 1. Decode + XÁC MINH CHỮ KÝ JWT cục bộ (không tốn network call).
    #    verify_signature và verify_exp mặc định = True → token giả mạo hoặc hết hạn sẽ ném lỗi
    #    ở đây và rơi xuống fallback Supabase SDK (cũng xác thực server-side) → cuối cùng bị 401.
    #    Chỉ tắt verify_aud vì token Supabase có aud="authenticated" mà ta không truyền audience.
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            options={"verify_aud": False},
        )
        user_id_str = payload.get("sub")
        if user_id_str:
            user_id = UUID(user_id_str)
    except JWTError as e:
        # Chữ ký sai / token hết hạn / malformed → thử fallback (phòng trường hợp Supabase ký
        # bằng thuật toán bất đối xứng mà HS256 cục bộ không verify được).
        logger.debug("Local JWT verify failed, will try Supabase SDK fallback: %s", e)
    except Exception:
        pass

    # 2. Fallback sang Supabase SDK nếu decode local không được
    if not user_id:
        try:
            from app.routers.auth import supabase
            if supabase:
                user_resp = supabase.auth.get_user(token)
                if user_resp and user_resp.user:
                    user_id = UUID(user_resp.user.id)
        except Exception as e:
            logger.warning("Supabase SDK auth check failed: %s", e)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in database",
        )
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return get_current_user_from_token(token, db)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin privileges required",
        )
    return current_user

