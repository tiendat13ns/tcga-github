"""
Credit Service — quản lý trừ credit và kiểm tra quota cho từng gói dịch vụ.

Chi phí theo tác vụ (đã cập nhật theo model occ/claude-sonnet-4-6 qua Vilao —
input 1.500đ/1M token, output 7.500đ/1M token, min 10đ/request):
  DOCUMENT_INGESTION      : 2 Credits  (~5đ API cost — chỉ embedding, không qua Sonnet)
  COPILOT_CHAT            : 10 Credits (~50đ API cost)
  REQUIREMENT_EXTRACTION  : 17 Credits (~120đ API cost)
  TEST_CASE_GENERATION    : 50 Credits (~200đ API cost)

Giới hạn FREE Plan:
  - Tối đa 5 tài liệu (documents)
  - Rate limit 20 AI calls/ngày (phòng chống bot spam)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import HTTPException
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from app.models import User

logger = logging.getLogger(__name__)

# ── Bảng định giá Credit ──────────────────────────────────────────────────────
CREDIT_COST = {
    "DOCUMENT_INGESTION": 2,
    "COPILOT_CHAT": 10,
    "REQUIREMENT_EXTRACTION": 17,
    "TEST_CASE_GENERATION": 50,
}

# ── Quota theo từng gói (khớp ngưỡng credit dùng để xác định plan ở frontend) ──
FREE_PLAN_MAX_DOCUMENTS = 5
LITE_PLAN_MAX_DOCUMENTS = 15
LITE_PLAN_CREDIT_THRESHOLD = 600
PRO_PLAN_CREDIT_THRESHOLD = 2000


def deduct_user_credits(
    db: Session,
    user: "User",
    operation: str,
    target_name: str | None = None,
) -> None:
    """
    Trừ Credit của user và ghi log vào usage_logs.
    Ném HTTPException 402 nếu không đủ Credit.
    Áp dụng cho MỌI user kể cả admin — không có bypass đặc quyền theo role, tránh tạo
    lỗ hổng. Admin chỉ khác user thường ở việc được cấp credit_balance cao (đủ ngưỡng
    Pro Plan) và có quyền truy cập Admin Dashboard, không phải ở logic trừ credit.
    """
    from app.models import UsageLog

    cost = CREDIT_COST.get(operation, 1)

    if user.credit_balance < cost:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Không đủ Credit. Cần {cost} Credits nhưng chỉ còn {user.credit_balance}. "
                "Vui lòng nâng cấp gói dịch vụ để tiếp tục."
            ),
        )

    # Trừ credit
    user.credit_balance -= cost

    # Ghi log
    log = UsageLog(
        user_id=user.id,
        operation=operation,
        target_name=target_name,
        credits_used=cost,
    )
    db.add(log)
    db.commit()
    logger.info(
        "Credit deducted: user=%s op=%s cost=%d remaining=%d",
        user.id, operation, cost, user.credit_balance,
    )


def resolve_user_plan(user: "User") -> tuple[str, int | None]:
    """
    Trả về (tên plan, giới hạn document) suy ra từ credit_balance hiện tại của user.
    None = không giới hạn (Pro). Áp dụng chung cho mọi user, kể cả admin — không có
    bypass theo role, đúng gói nào thì đúng quyền lợi/giới hạn của gói đó.
    """
    credit_balance = getattr(user, "credit_balance", 0) or 0
    if credit_balance >= PRO_PLAN_CREDIT_THRESHOLD:
        return "Pro", None
    if credit_balance >= LITE_PLAN_CREDIT_THRESHOLD:
        return "Lite", LITE_PLAN_MAX_DOCUMENTS
    return "Free", FREE_PLAN_MAX_DOCUMENTS


def check_document_upload_quota(db: Session, user: "User", num_new_files: int = 1) -> None:
    """
    Kiểm tra user có vượt quá giới hạn số tài liệu của gói (Free/Lite) không.
    Dùng documents_uploaded_total (đếm CỘNG DỒN, không giảm khi xóa) thay vì đếm số
    document đang tồn tại — tránh việc xóa tài liệu cũ rồi upload lại để lách quota.
    Ném HTTPException 403 nếu vượt giới hạn. Chỉ Pro Plan (bao gồm admin nếu credit_balance
    đủ ngưỡng Pro) mới không giới hạn — không có bypass riêng theo role.
    """
    plan_name, limit = resolve_user_plan(user)
    if limit is None:
        return

    uploaded_total = getattr(user, "documents_uploaded_total", 0) or 0
    if uploaded_total + num_new_files > limit:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Tài khoản {plan_name} chỉ được upload tối đa {limit} tài liệu (đã dùng {uploaded_total}). "
                "Việc xóa tài liệu cũ không hoàn lại quota. Vui lòng nâng cấp gói để tiếp tục — liên hệ admin."
            ),
        )

