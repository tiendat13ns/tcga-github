import io
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging

from app.core.auth import get_current_user, get_db
from app.core.ownership import verify_requirement_owner
from app.models import Document, Project, TestCase, TestExecution, Requirement, User
from app.schemas.test_case_schema import (
    StudioTestCaseItem,
    StudioTestCaseListResponse,
    TestCaseUpdatePayload,
    TestCaseCreatePayload,
    TestExecutionItem,
    TestExecutionListResponse,
    TestExecutionCreatePayload,
    TestExecutionUpdatePayload,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/test-cases", tags=["test-case-studio"])


def _get_owned_project_id(db: Session, project_id: str, user: User) -> UUID:
    """Verify project_id hợp lệ và thuộc về user hiện tại — trả 404 để tránh lộ sự tồn tại
    của project cho user khác."""
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid project_id format") from exc

    project = db.get(Project, project_uuid)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_uuid


def _verify_test_case_owner(db: Session, test_case_id: str, user: User) -> TestCase:
    """Đảm bảo test case thuộc project của chính user đang đăng nhập (qua requirement -> project)."""
    try:
        tc_uuid = UUID(test_case_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid test_case_id format") from exc

    tc = db.query(TestCase).filter(TestCase.id == tc_uuid).first()
    if tc is None:
        raise HTTPException(status_code=404, detail="Test case not found")

    try:
        verify_requirement_owner(db, str(tc.requirement_id), user)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Test case not found")
    return tc


def _to_execution_item(ex: TestExecution) -> TestExecutionItem:
    return TestExecutionItem(
        id=str(ex.id),
        test_case_id=str(ex.test_case_id),
        environment=ex.environment,
        run_number=ex.run_number,
        result=ex.result,
        executed_by=str(ex.executed_by) if ex.executed_by else None,
        executed_at=ex.executed_at.isoformat() if ex.executed_at else None,
    )


def _to_studio_item(tc: TestCase, req: Requirement, executions: list[TestExecution] | None = None) -> StudioTestCaseItem:
    return StudioTestCaseItem(
        id=str(tc.id),
        requirement_id=str(tc.requirement_id),
        document_id=str(tc.document_id) if tc.document_id else None,
        title=tc.title,
        scenario=tc.scenario,
        preconditions=tc.preconditions,
        test_steps=tc.test_steps,
        test_data=tc.test_data,
        expected_result=tc.expected_result,
        actual_result=tc.actual_result,
        priority=tc.priority,
        severity=tc.severity,
        test_type=tc.test_type,
        automation_candidate=tc.automation_candidate,
        execution_type=tc.execution_type,
        execution_status=tc.execution_status,
        status=tc.status,
        note=tc.note,
        bug_reference=tc.bug_reference,
        version=tc.version,
        feature_name=req.feature_name,
        requirement_title=req.title,
        project_id=str(req.project_id) if req.project_id else None,
        module_name=req.module_name,
        executions=[_to_execution_item(e) for e in (executions or [])],
    )


# Thứ tự ưu tiên khi suy ra execution_status TỔNG của 1 test case từ các ô trong ma trận
# Environment × Lần chạy: còn ô nào Fail → tổng Fail (dù ô khác đã Pass); hết Fail nhưng còn
# Blocked → Blocked; hết cả hai nhưng còn ô chưa chạy → Untested; chỉ khi TẤT CẢ đều Pass thì
# tổng mới là Pass. Test case CHƯA có ô nào trong ma trận thì giữ nguyên execution_status hiện
# tại (tương thích ngược với các test case tạo trước khi có tính năng ma trận).
_RESULT_PRIORITY = ["Fail", "Blocked", "Untested", "Pass"]


def _recompute_execution_status(db: Session, test_case_id: UUID) -> str | None:
    results = {
        r for (r,) in db.query(TestExecution.result).filter(TestExecution.test_case_id == test_case_id).all()
    }
    if not results:
        return None
    for candidate in _RESULT_PRIORITY:
        if candidate in results:
            return candidate
    return "Untested"


def _apply_execution_rollup(db: Session, test_case_id: UUID) -> None:
    """Tính lại execution_status tổng và ghi đè vào TestCase — gọi sau mỗi lần tạo/sửa/xoá
    1 ô trong ma trận (xem _recompute_execution_status)."""
    new_status = _recompute_execution_status(db, test_case_id)
    if new_status is None:
        return
    tc = db.get(TestCase, test_case_id)
    if tc is not None and tc.execution_status != new_status:
        tc.execution_status = new_status

@router.get("/export",
    responses={
        200: {
            "content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}},
            "description": "Exported Excel file containing test cases.",
        }
    },
)
def export_test_cases_studio(
    project_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id is required")
    project_uuid = _get_owned_project_id(db, project_id, current_user)

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill

        query = db.query(TestCase, Requirement).join(Requirement, TestCase.requirement_id == Requirement.id)
        query = query.filter(Requirement.project_id == project_uuid)
        query = query.order_by(TestCase.created_at.asc(), TestCase.id.asc())
        results = query.all()

        wb = Workbook()
        ws = wb.active
        ws.title = "Test Cases"
        headers = ["Feature", "Test Case ID", "Title", "Precondition", "Test Steps", "Test Data", "Expected Output", "Priority", "Note", "Test Type"]
        ws.append(headers)

        header_font = Font(bold=True)
        header_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill

        for idx, (tc, req) in enumerate(results):
            feature_name = req.feature_name or req.module_name or req.title or "Unknown Feature"
            steps_text = "\n".join([f"{i+1}. {s}" for i, s in enumerate(tc.test_steps)]) if tc.test_steps else ""

            ws.append([
                feature_name,
                f"TC-{str(idx+1).zfill(2)}",
                tc.title,
                tc.preconditions or "",
                steps_text,
                tc.test_data or "",
                tc.expected_result,
                tc.priority,
                tc.note or "",
                tc.test_type or ""
            ])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        filename = f"test_cases_{project_id[:8]}.xlsx"

        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("", response_model=StudioTestCaseListResponse)
def get_studio_test_cases(
    project_id: str | None = Query(None),
    document_id: str | None = Query(None),
    priority: str | None = Query(None),
    status: str | None = Query(None),
    test_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        query = db.query(TestCase, Requirement).join(Requirement, TestCase.requirement_id == Requirement.id)

        if project_id:
            project_uuid = _get_owned_project_id(db, project_id, current_user)
            query = query.filter(Requirement.project_id == project_uuid)
        else:
            # Không truyền project_id: chỉ trả về test case thuộc các project của user hiện tại.
            query = query.join(Project, Requirement.project_id == Project.id).filter(Project.user_id == current_user.id)

        if document_id:
            try:
                query = query.filter(TestCase.document_id == UUID(document_id))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid document_id format")
        if priority:
            query = query.filter(TestCase.priority == priority)
        if status:
            query = query.filter(TestCase.status == status)
        if test_type:
            query = query.filter(TestCase.test_type == test_type)

        query = query.order_by(TestCase.created_at.asc(), TestCase.id.asc())
        results = query.all()

        # Batch load toàn bộ execution của các test case đang trả về, tránh N+1 query.
        tc_ids = [tc.id for tc, _ in results]
        executions_by_tc: dict[UUID, list[TestExecution]] = {}
        if tc_ids:
            all_executions = (
                db.query(TestExecution)
                .filter(TestExecution.test_case_id.in_(tc_ids))
                .order_by(TestExecution.environment.asc(), TestExecution.run_number.asc())
                .all()
            )
            for ex in all_executions:
                executions_by_tc.setdefault(ex.test_case_id, []).append(ex)

        items = [_to_studio_item(tc, req, executions_by_tc.get(tc.id)) for tc, req in results]

        return StudioTestCaseListResponse(
            total_test_cases=len(items),
            test_cases=items
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database error while fetching test cases") from exc


@router.put("/{test_case_id}", response_model=StudioTestCaseItem)
def update_studio_test_case(
    test_case_id: str,
    payload: TestCaseUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tc = _verify_test_case_owner(db, test_case_id, current_user)
    try:
        update_data = payload.model_dump(exclude_unset=True)
        if update_data:
            for key, value in update_data.items():
                setattr(tc, key, value)
            tc.updated_at = datetime.now(timezone.utc)
            tc.version += 1

            db.commit()
            db.refresh(tc)

        req = db.query(Requirement).filter(Requirement.id == tc.requirement_id).first()
        if not req:
            raise HTTPException(status_code=500, detail="Requirement not found for test case")

        executions = db.query(TestExecution).filter(TestExecution.test_case_id == tc.id).order_by(
            TestExecution.environment.asc(), TestExecution.run_number.asc()
        ).all()
        return _to_studio_item(tc, req, executions)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database error while updating test case") from exc

@router.post("", response_model=StudioTestCaseItem)
def create_studio_test_case(
    payload: TestCaseCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = verify_requirement_owner(db, payload.requirement_id, current_user)
    req_uuid = req.id

    try:
        tc = TestCase(
            requirement_id=req_uuid,
            document_id=req.document_id,
            title=payload.title,
            scenario=payload.scenario,
            preconditions=payload.preconditions,
            test_steps=payload.test_steps,
            test_data=payload.test_data,
            expected_result=payload.expected_result,
            actual_result=payload.actual_result,
            priority=payload.priority,
            severity=payload.severity,
            test_type=payload.test_type,
            automation_candidate=payload.automation_candidate,
            execution_type=payload.execution_type,
            execution_status=payload.execution_status,
            status=payload.status,
            note=payload.note,
            bug_reference=payload.bug_reference,
        )
        db.add(tc)
        db.commit()
        db.refresh(tc)

        return _to_studio_item(tc, req)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database error while creating test case") from exc


# ── Ma trận chạy thử Environment × Lần chạy (Tester Studio) ──────────────────────────────
# Mỗi TestCase có 0..n ô TestExecution, tester tự thêm environment/lần chạy khi cần (không có
# danh sách cố định). execution_status TỔNG trên TestCase được suy ra tự động từ các ô này
# (xem _recompute_execution_status) — tester không còn set trạng thái tổng thủ công một khi
# đã có ít nhất 1 ô trong ma trận.

@router.get("/{test_case_id}/executions", response_model=TestExecutionListResponse)
def list_test_executions(
    test_case_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tc = _verify_test_case_owner(db, test_case_id, current_user)
    executions = db.query(TestExecution).filter(TestExecution.test_case_id == tc.id).order_by(
        TestExecution.environment.asc(), TestExecution.run_number.asc()
    ).all()
    return TestExecutionListResponse(
        test_case_id=str(tc.id),
        executions=[_to_execution_item(e) for e in executions],
    )


@router.post("/{test_case_id}/executions", response_model=TestExecutionItem)
def create_test_execution(
    test_case_id: str,
    payload: TestExecutionCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tc = _verify_test_case_owner(db, test_case_id, current_user)
    environment = payload.environment.strip()
    if not environment:
        raise HTTPException(status_code=400, detail="environment is required")

    try:
        run_number = payload.run_number
        if run_number is None:
            # Tự gán = lần chạy kế tiếp cho ĐÚNG environment này (không đụng environment khác).
            max_run = db.query(TestExecution.run_number).filter(
                TestExecution.test_case_id == tc.id,
                TestExecution.environment == environment,
            ).order_by(TestExecution.run_number.desc()).first()
            run_number = (max_run[0] + 1) if max_run else 1

        execution = TestExecution(
            test_case_id=tc.id,
            environment=environment,
            run_number=run_number,
            result="Untested",
        )
        db.add(execution)
        db.flush()  # cần execution.id trước khi rollup đọc lại bảng
        _apply_execution_rollup(db, tc.id)
        db.commit()
        db.refresh(execution)

        return _to_execution_item(execution)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database error while creating execution") from exc


def _verify_execution_owner(db: Session, execution_id: str, user: User) -> TestExecution:
    try:
        ex_uuid = UUID(execution_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid execution_id format") from exc

    execution = db.query(TestExecution).filter(TestExecution.id == ex_uuid).first()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")

    # Sở hữu suy ra qua test_case -> requirement -> project, tái dùng check đã có.
    _verify_test_case_owner(db, str(execution.test_case_id), user)
    return execution


@router.put("/executions/{execution_id}", response_model=TestExecutionItem)
def update_test_execution(
    execution_id: str,
    payload: TestExecutionUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    execution = _verify_execution_owner(db, execution_id, current_user)
    try:
        update_data = payload.model_dump(exclude_unset=True)
        if update_data:
            for key, value in update_data.items():
                setattr(execution, key, value)
            if "result" in update_data:
                execution.executed_by = current_user.id
                execution.executed_at = datetime.now(timezone.utc)
            execution.updated_at = datetime.now(timezone.utc)

            _apply_execution_rollup(db, execution.test_case_id)
            db.commit()
            db.refresh(execution)

        return _to_execution_item(execution)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database error while updating execution") from exc


@router.delete("/executions/{execution_id}")
def delete_test_execution(
    execution_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    execution = _verify_execution_owner(db, execution_id, current_user)
    try:
        test_case_id = execution.test_case_id
        db.delete(execution)
        db.flush()
        _apply_execution_rollup(db, test_case_id)
        db.commit()
        return {"status": "deleted"}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"DB Error: {exc}")
        raise HTTPException(status_code=500, detail="Database error while deleting execution") from exc


from pydantic import BaseModel
class BugReportPayload(BaseModel):
    actual_result: str

@router.post("/{test_case_id}/bug-report")
def generate_auto_bug_report(
    test_case_id: str,
    payload: BugReportPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tc = _verify_test_case_owner(db, test_case_id, current_user)
    try:
        tc_data = {
            "title": tc.title,
            "preconditions": tc.preconditions,
            "test_steps": tc.test_steps,
            "expected_result": tc.expected_result
        }

        from app.services.agent.bug_report_service import generate_bug_report
        report_content = generate_bug_report(tc_data, payload.actual_result)

        return {"report": report_content}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating bug report: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
