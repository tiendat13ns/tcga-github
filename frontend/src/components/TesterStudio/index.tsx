import { useEffect, useMemo, useState } from "react";
import { Project } from "../Projects/ProjectManager";
import { DocumentItem } from "../../App";
import { useProjects } from "../../hooks/useProjects";
import { useProjectDocuments } from "../../hooks/useDocuments";
import { useTestCases, useUpdateTestCase, useCreateTestCase } from "../../hooks/useTestCases";
import { downloadWithAuth } from "../../lib/api";
import BugReportDrawer from "./BugReportDrawer";
import ProjectSelectionView from "./ProjectSelectionView";
import ProjectWorkspaceView from "./ProjectWorkspaceView";
import TestCaseFormDrawer from "./TestCaseFormDrawer";
import TestCaseTableView from "./TestCaseTableView";
import { CheckIcon, DEFAULT_BUG_REPORT_FIELDS, computeExecutionSummary, parseBugReport, serializeBugReport } from "./shared";
import type { BugReportFields, StudioTestCaseItem, StudioView } from "./shared";

export type { StudioTestCaseItem, StudioView } from "./shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface TesterStudioProps {
  onNavigateToProjects?: () => void;
}

export default function TesterStudio({ onNavigateToProjects }: TesterStudioProps = {}) {
  const [view, setView] = useState<StudioView>("projects");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);

  // TC Filters
  const [filterPriority, setFilterPriority] = useState("");
  const [filterTestType, setFilterTestType] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Manual Row — scoped theo từng nhóm requirement; addingRequirementId là requirement
  // của nhóm đang thêm, để gắn khóa ngoại đúng cho test case mới.
  const [addingGroupKey, setAddingGroupKey] = useState<string | null>(null);
  const [addingRequirementId, setAddingRequirementId] = useState<string | null>(null);
  const [newRowDraft, setNewRowDraft] = useState<Partial<StudioTestCaseItem>>({ priority: "Medium", status: "draft", execution_status: "Untested", execution_type: "Manual" });

  // Edit 1 test case — mở drawer sửa riêng dòng đó (thay cho sửa hàng loạt trực tiếp trong bảng).
  const [editingTc, setEditingTc] = useState<StudioTestCaseItem | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<StudioTestCaseItem>>({});

  // Bug Report Drawer
  const [bugReportTc, setBugReportTc] = useState<StudioTestCaseItem | null>(null);
  const [bugReportFields, setBugReportFields] = useState<BugReportFields>(DEFAULT_BUG_REPORT_FIELDS);

  /* ── Hooks ── */
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  // Handle URL query parameters for direct navigation to a document/project test cases
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const docId = searchParams.get("document_id") || searchParams.get("doc_id");
    const projId = searchParams.get("project_id");
    const docName = searchParams.get("doc_name");

    if (docId) {
      setSelectedDocument({
        id: docId,
        original_filename: docName || "Document",
        stored_filename: "",
        file_type: "",
        file_size: 0,
        file_path: "",
        status: "completed",
        uploaded_at: "",
        project_id: projId || undefined,
      });
      if (projId && projects.length > 0) {
        const foundProj = projects.find((p) => p.id === projId);
        if (foundProj) setSelectedProject(foundProj);
      }
      setView("testcases");
    } else if (projId && projects.length > 0) {
      const foundProj = projects.find((p) => p.id === projId);
      if (foundProj) {
        setSelectedProject(foundProj);
        setView("documents");
      }
    }
  }, [projects]);

  const { data: documents = [], isLoading: isLoadingDocs } = useProjectDocuments(
    view === "documents" ? selectedProject?.id || null : null
  );

  const testCaseFilters = {
    project_id: selectedProject?.id,
    document_id: selectedDocument?.id,
    priority: filterPriority,
    test_type: filterTestType
  };

  const { data: testCaseData, isLoading: isLoadingTCs } = useTestCases(
    testCaseFilters,
    view === "testcases" // Only fetch if we're on the test case view
  );

  const testCases = testCaseData?.test_cases || [];
  const totalCount = testCaseData?.total_test_cases || 0;

  const executionSummary = useMemo(() => computeExecutionSummary(testCases), [testCases]);

  // Dữ liệu cấp project (toàn bộ document) — dùng cho Dashboard & Bug Reports ở màn hình Documents.
  const { data: projectTestCaseData, isLoading: isLoadingProjectTCs } = useTestCases(
    { project_id: selectedProject?.id },
    view === "documents" && !!selectedProject?.id
  );
  const projectTestCases = projectTestCaseData?.test_cases || [];
  const projectExecutionSummary = useMemo(() => computeExecutionSummary(projectTestCases), [projectTestCases]);
  const projectBugReports = useMemo(
    () => projectTestCases.filter((tc: StudioTestCaseItem) => tc.execution_status === "Fail"),
    [projectTestCases]
  );
  const projectUntestedCases = useMemo(
    () => projectTestCases.filter((tc: StudioTestCaseItem) => (tc.execution_status || "Untested") === "Untested"),
    [projectTestCases]
  );

  // Search riêng cho từng cột ở màn hình Documents
  const [docSearch, setDocSearch] = useState("");
  const [bugSearch, setBugSearch] = useState("");
  const [untestedSearch, setUntestedSearch] = useState("");

  const filteredDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d: DocumentItem) => d.original_filename.toLowerCase().includes(q));
  }, [documents, docSearch]);

  const filteredBugReports = useMemo(() => {
    const q = bugSearch.trim().toLowerCase();
    if (!q) return projectBugReports;
    return projectBugReports.filter((tc: StudioTestCaseItem) => tc.title.toLowerCase().includes(q));
  }, [projectBugReports, bugSearch]);

  const filteredUntestedCases = useMemo(() => {
    const q = untestedSearch.trim().toLowerCase();
    if (!q) return projectUntestedCases;
    return projectUntestedCases.filter((tc: StudioTestCaseItem) => tc.title.toLowerCase().includes(q));
  }, [projectUntestedCases, untestedSearch]);

  // TC-XX theo đúng thứ tự hiển thị trong bảng test case của từng document
  // (projectTestCases đã được backend order_by created_at/id nên đánh số theo thứ tự đó là khớp).
  const tcIdByCaseId = useMemo(() => {
    const map = new Map<string, string>();
    const perDocCounter = new Map<string, number>();
    for (const tc of projectTestCases as StudioTestCaseItem[]) {
      const docKey = tc.document_id || "unknown";
      const nextIdx = (perDocCounter.get(docKey) || 0) + 1;
      perDocCounter.set(docKey, nextIdx);
      map.set(tc.id, `TC-${String(nextIdx).padStart(2, "0")}`);
    }
    return map;
  }, [projectTestCases]);

  const updateTestCase = useUpdateTestCase();
  const createTestCase = useCreateTestCase();

  /* ── Navigation ── */
  const handleGoToProjects = () => {
    if (onNavigateToProjects) {
      onNavigateToProjects();
    } else {
      window.history.pushState(null, "", "/projects");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const goToDocuments = (project: Project) => {
    setSelectedProject(project);
    setSelectedDocument(null);
    setView("documents");
  };

  const goToTestCases = (doc: DocumentItem) => {
    setSelectedDocument(doc);
    setFilterPriority("");
    setFilterTestType("");
    setAddingGroupKey(null);
    setEditingTc(null);
    setView("testcases");
  };

  const goBackToProjects = () => {
    setSelectedProject(null);
    setSelectedDocument(null);
    setView("projects");
  };

  const goBackToDocuments = () => {
    setSelectedDocument(null);
    setAddingGroupKey(null);
    setEditingTc(null);
    setView("documents");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const startAddRow = (groupKey: string, requirementId: string) => {
    setEditingTc(null);             // không sửa và thêm cùng lúc
    setAddingGroupKey(groupKey);
    setAddingRequirementId(requirementId);
    setNewRowDraft({ priority: "Medium", status: "draft", execution_status: "Untested", execution_type: "Manual" });
  };

  const cancelAddRow = () => {
    setAddingGroupKey(null);
  };

  /* ── Edit 1 Test Case (Drawer) ── */
  const openEditDrawer = (tc: StudioTestCaseItem) => {
    setAddingGroupKey(null);        // không sửa và thêm cùng lúc
    setEditingTc(tc);
    setEditDraft({
      title: tc.title,
      preconditions: tc.preconditions,
      test_steps: tc.test_steps,
      test_data: tc.test_data,
      expected_result: tc.expected_result,
      priority: tc.priority,
    });
  };

  const closeEditDrawer = () => {
    setEditingTc(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTc) return;
    if (!editDraft.title) {
      alert("Title is required");
      return;
    }

    try {
      await updateTestCase.mutateAsync({
        id: editingTc.id,
        data: {
          title: editDraft.title,
          preconditions: editDraft.preconditions,
          test_steps: editDraft.test_steps,
          test_data: editDraft.test_data,
          expected_result: editDraft.expected_result,
          priority: editDraft.priority,
        },
      });
      showToast("Test case updated successfully!");
      setEditingTc(null);
    } catch (e) {
      alert("Failed to update test case");
    }
  };

  /* ── Add Manual Row ── */
  const handleAddNewRow = async () => {
    if (!newRowDraft.title) {
      alert("Title is required");
      return;
    }

    // Gắn test case mới vào ĐÚNG requirement của nhóm mà người dùng bấm "+ Thêm".
    const reqId = addingRequirementId;
    if (!reqId) {
      alert("Không xác định được requirement để thêm test case. Vui lòng thử lại.");
      return;
    }

    try {
      await createTestCase.mutateAsync({
        requirement_id: reqId,
        title: newRowDraft.title,
        preconditions: newRowDraft.preconditions,
        test_steps: newRowDraft.test_steps,
        test_data: newRowDraft.test_data,
        expected_result: newRowDraft.expected_result || "N/A",
        priority: newRowDraft.priority || "Medium",
        execution_status: newRowDraft.execution_status || "Untested",
        execution_type: "Manual",
        status: "draft"
      });
      showToast("Test case added successfully!");
      setAddingGroupKey(null);
      setNewRowDraft({ priority: "Medium", status: "draft", execution_status: "Untested", execution_type: "Manual" });
    } catch (e) {
      alert("Failed to add test case");
    }
  };

  /* ── Execution & Bug Report ── */
  const openBugReportDrawer = (tc: StudioTestCaseItem) => {
    setBugReportTc(tc);
    setBugReportFields(parseBugReport(tc.actual_result));
  };

  const handleExecutionStatusChange = async (tc: StudioTestCaseItem, newStatus: string) => {
    // Mở drawer ngay lập tức, không đợi API trả về, để cảm giác phản hồi tức thì.
    if (newStatus === "Fail") {
      openBugReportDrawer(tc);
    }
    try {
      await updateTestCase.mutateAsync({
        id: tc.id,
        data: { execution_status: newStatus }
      });
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const handleSaveBugReport = async () => {
    if (!bugReportTc) return;
    try {
      await updateTestCase.mutateAsync({
        id: bugReportTc.id,
        data: { actual_result: serializeBugReport(bugReportFields) }
      });
      showToast("Bug report saved successfully!");
      setBugReportTc(null);
    } catch (e) {
      alert("Failed to save bug report");
    }
  };

  const handleExport = () => {
    if (!selectedProject) return;
    const url = `${API_BASE}/api/v1/test-cases/export?project_id=${selectedProject.id}`;
    downloadWithAuth(url, `test_cases_${selectedProject.id.slice(0, 8)}.xlsx`).catch((e) => {
      alert(e instanceof Error ? e.message : "Could not export file.");
    });
  };

  return (
    <div className="tcs-container">
      {view === "projects" && (
        <ProjectSelectionView
          projects={projects}
          isLoadingProjects={isLoadingProjects}
          onSelectProject={goToDocuments}
          onGoToProjects={handleGoToProjects}
        />
      )}

      {view === "documents" && (
        <ProjectWorkspaceView
          selectedProject={selectedProject}
          documents={documents}
          isLoadingDocs={isLoadingDocs}
          filteredDocuments={filteredDocuments}
          docSearch={docSearch}
          onDocSearchChange={setDocSearch}
          projectExecutionSummary={projectExecutionSummary}
          isLoadingProjectTCs={isLoadingProjectTCs}
          projectBugReports={projectBugReports}
          filteredBugReports={filteredBugReports}
          bugSearch={bugSearch}
          onBugSearchChange={setBugSearch}
          projectUntestedCases={projectUntestedCases}
          filteredUntestedCases={filteredUntestedCases}
          untestedSearch={untestedSearch}
          onUntestedSearchChange={setUntestedSearch}
          tcIdByCaseId={tcIdByCaseId}
          onGoBackToProjects={goBackToProjects}
          onGoToTestCases={goToTestCases}
          onOpenBugReportDrawer={openBugReportDrawer}
        />
      )}

      {view === "testcases" && (
        <TestCaseTableView
          selectedProject={selectedProject}
          selectedDocument={selectedDocument}
          totalCount={totalCount}
          testCases={testCases}
          isLoadingTCs={isLoadingTCs}
          executionSummary={executionSummary}
          onExport={handleExport}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
          filterTestType={filterTestType}
          onFilterTestTypeChange={setFilterTestType}
          addingGroupKey={addingGroupKey}
          onAddRowClick={startAddRow}
          onEditRow={openEditDrawer}
          onExecutionStatusChange={handleExecutionStatusChange}
          onOpenBugReportDrawer={openBugReportDrawer}
          onGoBackToProjects={goBackToProjects}
          onGoBackToDocuments={goBackToDocuments}
        />
      )}

      {toastMessage && (
        <div className="tcs-toast">
          <CheckIcon /> {toastMessage}
        </div>
      )}

      <BugReportDrawer
        testCase={bugReportTc}
        fields={bugReportFields}
        onFieldsChange={setBugReportFields}
        onClose={() => setBugReportTc(null)}
        onSave={handleSaveBugReport}
        isSaving={updateTestCase.isPending}
      />

      <TestCaseFormDrawer
        isOpen={!!addingGroupKey}
        title="Thêm Test Case"
        draft={newRowDraft}
        onDraftChange={setNewRowDraft}
        onClose={cancelAddRow}
        onSave={handleAddNewRow}
        isSaving={createTestCase.isPending}
      />

      <TestCaseFormDrawer
        isOpen={!!editingTc}
        title="Sửa Test Case"
        draft={editDraft}
        onDraftChange={setEditDraft}
        onClose={closeEditDrawer}
        onSave={handleSaveEdit}
        isSaving={updateTestCase.isPending}
      />
    </div>
  );
}
