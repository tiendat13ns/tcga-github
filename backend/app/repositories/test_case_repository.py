from uuid import UUID

from app.models import TestCase


class TestCaseRepository:
    def __init__(self, db):
        self.db = db

    def create_many(self, test_cases: list[TestCase]) -> list[TestCase]:
        # flush() gán PK (id) cho từng object mà CHƯA expire → đọc id ngay tốn 0 query. Sau
        # commit() mọi attribute bị expire, nên nạp lại TẤT CẢ trong MỘT query IN (populate_existing
        # cập nhật đúng các instance trong identity map) thay vì refresh từng cái (N+1). Cần nạp
        # sẵn vì caller còn đọc attribute SAU khi session đóng (tránh DetachedInstanceError).
        self.db.add_all(test_cases)
        self.db.flush()
        ids = [tc.id for tc in test_cases]
        self.db.commit()
        if ids:
            self.db.query(TestCase).filter(TestCase.id.in_(ids)).populate_existing().all()

        return test_cases

    def get_latest_version_by_requirement_id(self, requirement_id: UUID) -> int:
        latest = (
            self.db.query(TestCase.version)
            .filter(TestCase.requirement_id == requirement_id)
            .order_by(TestCase.version.desc())
            .first()
        )

        return latest[0] if latest else 0

    def list_by_requirement_id(self, requirement_id: UUID) -> list[TestCase]:
        return (
            self.db.query(TestCase)
            .filter(TestCase.requirement_id == requirement_id)
            .order_by(TestCase.created_at.asc(), TestCase.id.asc())
            .all()
        )
