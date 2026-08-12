from uuid import UUID

from app.models import Document, Requirement, TestCase


class RequirementRepository:
    def __init__(self, db):
        self.db = db

    def create_many(self, requirements: list[Requirement]) -> list[Requirement]:
        self.db.add_all(requirements)
        self.db.commit()

        for requirement in requirements:
            self.db.refresh(requirement)

        return requirements

    def delete_by_document_id(self, document_id: UUID) -> int:
        """Xóa toàn bộ requirements (và test cases liên quan) của document.
        Trả về số lượng requirements đã xóa."""
        # Lấy danh sách requirement IDs cần xóa
        req_ids = [
            r.id for r in
            self.db.query(Requirement.id)
            .filter(Requirement.document_id == document_id)
            .all()
        ]
        if not req_ids:
            return 0
        # Xóa test cases liên quan trước (tránh FK violation)
        self.db.query(TestCase).filter(TestCase.requirement_id.in_(req_ids)).delete(synchronize_session=False)
        # Xóa requirements
        deleted = self.db.query(Requirement).filter(Requirement.document_id == document_id).delete(synchronize_session=False)
        self.db.commit()
        return deleted

    def get_latest_version_by_document_id(self, document_id: UUID) -> int:
        latest = (
            self.db.query(Requirement.version)
            .filter(Requirement.document_id == document_id)
            .order_by(Requirement.version.desc())
            .first()
        )

        return latest[0] if latest else 0

    def list_by_document_id(self, document_id: UUID) -> list[Requirement]:
        return (
            self.db.query(Requirement)
            .filter(Requirement.document_id == document_id)
            .order_by(Requirement.created_at.desc())
            .all()
        )

    def list_latest_by_document_id(self, document_id: UUID) -> list[Requirement]:
        """Chỉ trả về requirements có version mới nhất (tránh trùng lặp khi tạo nhiều lần)."""
        from sqlalchemy import func as sqlfunc
        latest_version = (
            self.db.query(sqlfunc.max(Requirement.version))
            .filter(Requirement.document_id == document_id)
            .scalar()
        )
        if latest_version is None:
            return []
        return (
            self.db.query(Requirement)
            .filter(
                Requirement.document_id == document_id,
                Requirement.version == latest_version,
            )
            .all()
        )

    def list_latest_by_project_id(self, project_id: UUID) -> dict[UUID, list[Requirement]]:
        """Trả về requirements (chỉ version mới nhất) của TOÀN BỘ document trong project,
        gom nhóm theo document_id — 1 query duy nhất thay vì gọi list_latest_by_document_id()
        lặp lại cho từng document (N+1), dùng cho trang danh sách document.

        Lọc qua Document.project_id (JOIN) thay vì Requirement.project_id trực tiếp: cột
        Requirement.project_id nullable và có thể chưa được set ở các requirement tạo từ
        trước, trong khi Requirement.document_id luôn đáng tin cậy và Document.project_id
        là nguồn sự thật mà trang danh sách document đang dùng để lọc."""
        rows = (
            self.db.query(Requirement)
            .join(Document, Requirement.document_id == Document.id)
            .filter(Document.project_id == project_id)
            .order_by(Requirement.document_id, Requirement.version.desc())
            .all()
        )
        by_document: dict[UUID, list[Requirement]] = {}
        latest_version_seen: dict[UUID, int] = {}
        for req in rows:
            if req.document_id is None:
                continue
            seen_version = latest_version_seen.get(req.document_id)
            if seen_version is None:
                latest_version_seen[req.document_id] = req.version
                by_document[req.document_id] = [req]
            elif req.version == seen_version:
                by_document[req.document_id].append(req)
        return by_document
