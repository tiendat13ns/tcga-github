"""
Chạy các tác vụ sinh Requirement/Test Case ở NỀN (fire-and-forget) thay vì bắt request
HTTP chờ LLM chạy xong. Endpoint chỉ cần: đánh dấu trạng thái "generating" vào DB rồi
submit() coroutine vào đây và trả 202 ngay — người dùng rảnh tay làm việc khác, frontend
poll trạng thái từ DB.

Giới hạn đồng thời bằng một asyncio.Semaphore dùng chung: dù người dùng bấm generate nhiều
lần, số cuộc gọi LLM chạy song song tối đa = MAX_CONCURRENT_GENERATIONS, các cái còn lại xếp
hàng chờ — tránh làm quá tải/nghẽn nhà cung cấp AI ("AI chết").

Lưu ý phạm vi: backend chạy 1 worker uvicorn (xem Dockerfile), nên semaphore + task set trong
tiến trình là đủ và an toàn. Nếu sau này scale lên nhiều worker/nhiều tiến trình, cần chuyển
sang hàng đợi ngoài (Redis/DB job table + worker riêng) vì state in-memory không chia sẻ được.
"""

import asyncio
import logging
import os
from typing import Coroutine

logger = logging.getLogger(__name__)

MAX_CONCURRENT_GENERATIONS = int(os.getenv("MAX_CONCURRENT_GENERATIONS", "2"))

_semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)
# Giữ tham chiếu tới task đang chạy để chúng không bị garbage-collect giữa chừng
# (asyncio.create_task chỉ giữ weak reference).
_tasks: set[asyncio.Task] = set()


async def _guarded(coro: Coroutine) -> None:
    """Chạy coro dưới semaphore để giới hạn concurrency; nuốt mọi exception (background task
    không có ai await, exception phải được log tại đây, và bản thân coro đã tự cập nhật trạng
    thái 'failed' vào DB)."""
    async with _semaphore:
        try:
            await coro
        except Exception:  # noqa: BLE001 - background task, log & swallow
            logger.exception("Background generation job failed")


def submit(coro: Coroutine) -> None:
    """Lên lịch chạy coro ở nền. Trả về ngay, không chờ."""
    task = asyncio.create_task(_guarded(coro))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
