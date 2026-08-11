from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_db
from app.models import Project, Document, Requirement, TestCase, User
from app.schemas.project_schema import ProjectCreate, ProjectListResponse, ProjectResponse

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _project_to_response(project: Project, file_count: int = 0, req_count: int = 0, test_case_count: int = 0) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        created_at=project.created_at.isoformat(timespec="seconds") if project.created_at else "",
        updated_at=project.updated_at.isoformat(timespec="seconds") if project.updated_at else None,
        file_count=file_count,
        req_count=req_count,
        test_case_count=test_case_count
    )


def _get_project_stats(db: Session, project_id: UUID) -> tuple[int, int, int]:
    file_count = db.query(Document).filter(Document.project_id == project_id).count()
    req_count = db.query(Requirement).filter(Requirement.project_id == project_id).count()
    # Count how many requirements have test cases generated, instead of individual test case rows
    test_case_count = db.query(TestCase.requirement_id).join(Requirement, TestCase.requirement_id == Requirement.id).filter(Requirement.project_id == project_id).distinct().count()
    return file_count, req_count, test_case_count


def _get_bulk_project_stats(
    db: Session, project_ids: list[UUID]
) -> tuple[dict[UUID, int], dict[UUID, int], dict[UUID, int]]:
    """Đếm file/requirement/test-case cho NHIỀU project cùng lúc bằng GROUP BY — 3 query
    cố định thay vì 3*N query nếu gọi _get_project_stats() lặp lại cho từng project (N+1).
    Dùng cho list_projects() — nơi số lượng project có thể lớn."""
    if not project_ids:
        return {}, {}, {}

    file_counts = dict(
        db.query(Document.project_id, func.count(Document.id))
        .filter(Document.project_id.in_(project_ids))
        .group_by(Document.project_id)
        .all()
    )
    req_counts = dict(
        db.query(Requirement.project_id, func.count(Requirement.id))
        .filter(Requirement.project_id.in_(project_ids))
        .group_by(Requirement.project_id)
        .all()
    )
    test_case_counts = dict(
        db.query(Requirement.project_id, func.count(func.distinct(TestCase.requirement_id)))
        .join(TestCase, TestCase.requirement_id == Requirement.id)
        .filter(Requirement.project_id.in_(project_ids))
        .group_by(Requirement.project_id)
        .all()
    )
    return file_counts, req_counts, test_case_counts


def _get_owned_project(db: Session, project_id: str, user: User) -> Project:
    """Fetch a project by ID and verify it belongs to the current user.
    Returns 404 (not 403) to avoid leaking existence of other users' projects."""
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid project ID") from exc

    project = db.get(Project, project_uuid)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tạo project mới. Mỗi project đại diện cho một hệ thống/module riêng biệt."""
    try:
        project = Project(
            name=payload.name,
            description=payload.description,
            user_id=current_user.id,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return _project_to_response(project)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while creating project") from exc


@router.get("", response_model=ProjectListResponse)
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trả về danh sách projects của user hiện tại, sắp xếp theo thời gian tạo mới nhất."""
    try:
        projects = (
            db.query(Project)
            .filter(Project.user_id == current_user.id)
            .order_by(Project.created_at.desc())
            .all()
        )
        file_counts, req_counts, test_case_counts = _get_bulk_project_stats(db, [p.id for p in projects])
        result = [
            _project_to_response(
                p,
                file_counts.get(p.id, 0),
                req_counts.get(p.id, 0),
                test_case_counts.get(p.id, 0),
            )
            for p in projects
        ]
        return ProjectListResponse(
            total=len(result),
            projects=result,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while listing projects") from exc


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lấy thông tin chi tiết một project theo ID (chỉ project của user hiện tại)."""
    project = _get_owned_project(db, project_id, current_user)
    try:
        fc, rc, tcc = _get_project_stats(db, project.id)
        return _project_to_response(project, fc, rc, tcc)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while fetching project") from exc


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cập nhật tên và mô tả của project (chỉ chủ sở hữu mới có quyền)."""
    project = _get_owned_project(db, project_id, current_user)
    try:
        project.name = payload.name
        project.description = payload.description
        project.updated_at = datetime.now()
        db.commit()
        db.refresh(project)
        fc, rc, tcc = _get_project_stats(db, project.id)
        return _project_to_response(project, fc, rc, tcc)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while updating project") from exc


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Xóa project và toàn bộ dữ liệu liên quan (documents, chunks, requirements, test cases).
    Hành động này không thể hoàn tác. Chỉ chủ sở hữu mới có quyền xóa.

    Tự dọn test_case → requirement → document theo đúng thứ tự trước khi xoá project,
    vì Requirement.document_id và TestCase.requirement_id KHÔNG có ondelete=CASCADE
    (chỉ Requirement.project_id có SET NULL) — nếu chỉ db.delete(project) suông, Postgres
    sẽ chặn lại với IntegrityError ngay khi project có tài liệu đã sinh requirement."""
    project = _get_owned_project(db, project_id, current_user)
    try:
        document_ids = [
            d.id for d in db.query(Document.id).filter(Document.project_id == project.id).all()
        ]
        if document_ids:
            db.query(TestCase).filter(TestCase.requirement_id.in_(
                db.query(Requirement.id).filter(Requirement.document_id.in_(document_ids))
            )).delete(synchronize_session=False)
            db.query(Requirement).filter(Requirement.document_id.in_(document_ids)).delete(synchronize_session=False)
            db.query(Document).filter(Document.id.in_(document_ids)).delete(synchronize_session=False)
        db.delete(project)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error while deleting project") from exc
