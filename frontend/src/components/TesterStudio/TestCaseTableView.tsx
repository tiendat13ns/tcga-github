import { useState, useMemo, Fragment } from "react";
import { Sparkles, ChevronDown, Search, X } from "lucide-react";
import { Project } from "../Projects/ProjectManager";
import { DocumentItem } from "../../App";
import {
  ArrowLeftIcon, AlertCircleIcon, CheckIcon, ChevronRightIcon, DownloadIcon,
  EditIcon, ExecutionSummaryBar, FlaskIcon, PriorityBadge, SpinnerIcon, XIcon,
  computeExecutionSummary,
} from "./shared";
import type { ExecutionSummary, StudioTestCaseItem } from "./shared";

type TestCaseTableViewProps = {
  selectedProject: Project | null;
  selectedDocument: DocumentItem | null;
  totalCount: number;
  testCases: StudioTestCaseItem[];
  isLoadingTCs: boolean;
  executionSummary: ExecutionSummary;
  onExport: () => void;

  filterPriority: string;
  onFilterPriorityChange: (v: string) => void;
  filterTestType: string;
  onFilterTestTypeChange: (v: string) => void;

  editingGroupKey: string | null;
  draftTestCases: Record<string, Partial<StudioTestCaseItem>>;
  isBulkSaving: boolean;
  onStartGroupEditing: (groupKey: string) => void;
  onCancelGroupEditing: () => void;
  onSaveBulkEditing: () => void;
  onDraftChange: (id: string, field: keyof StudioTestCaseItem, value: any) => void;

  addingGroupKey: string | null;
  onAddRowClick: (groupKey: string, requirementId: string) => void;
  onCancelAddRow: () => void;
  newRowDraft: Partial<StudioTestCaseItem>;
  onNewRowDraftChange: (draft: Partial<StudioTestCaseItem>) => void;
  onAddNewRow: () => void;
  isCreatingRow: boolean;

  onExecutionStatusChange: (tc: StudioTestCaseItem, newStatus: string) => void;
  onOpenBugReportDrawer: (tc: StudioTestCaseItem) => void;

  onGoBackToProjects: () => void;
  onGoBackToDocuments: () => void;
};

export default function TestCaseTableView({
  selectedProject,
  selectedDocument,
  totalCount,
  testCases,
  isLoadingTCs,
  executionSummary,
  onExport,
  filterPriority,
  onFilterPriorityChange,
  filterTestType,
  onFilterTestTypeChange,
  editingGroupKey,
  draftTestCases,
  isBulkSaving,
  onStartGroupEditing,
  onCancelGroupEditing,
  onSaveBulkEditing,
  onDraftChange,
  addingGroupKey,
  onAddRowClick,
  onCancelAddRow,
  newRowDraft,
  onNewRowDraftChange,
  onAddNewRow,
  isCreatingRow,
  onExecutionStatusChange,
  onOpenBugReportDrawer,
  onGoBackToProjects,
  onGoBackToDocuments,
}: TestCaseTableViewProps) {
  // ── Tìm kiếm + nhóm theo Requirement ──────────────────────────────────────
  // File có thể có 100+ test case (do 1 tài liệu sinh nhiều requirement). Gom theo
  // requirement thành các nhóm gập/mở được + ô tìm kiếm text để quản lý cho gọn.
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (tc: StudioTestCaseItem) => {
      if (!q) return true;
      const hay = [
        tc.title, tc.test_data, tc.expected_result, tc.preconditions, tc.note,
        tc.feature_name, tc.requirement_title, tc.module_name,
        ...(tc.test_steps || []),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    };

    const order: string[] = [];
    const map = new Map<string, { key: string; label: string; items: StudioTestCaseItem[] }>();
    for (const tc of testCases) {
      if (!matches(tc)) continue;
      // Ưu tiên gộp theo requirement_id (mỗi requirement 1 nhóm); nhãn hiển thị lấy tên
      // requirement/feature dễ đọc.
      const key = tc.requirement_id || tc.feature_name || tc.requirement_title || "__ungrouped__";
      const label = tc.requirement_title || tc.feature_name || tc.module_name || "Chưa gắn requirement";
      if (!map.has(key)) {
        map.set(key, { key, label, items: [] });
        order.push(key);
      }
      map.get(key)!.items.push(tc);
    }
    return order.map((k) => map.get(k)!);
  }, [testCases, search]);

  const filteredCount = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsedGroups.has(g.key));

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  const toggleAll = () =>
    setCollapsedGroups(allCollapsed ? new Set() : new Set(groups.map((g) => g.key)));

  // Render 1 dòng test case. displayIdx = số thứ tự TC trong NHÓM (TC-01, TC-02... theo
  // từng requirement) — dễ đọc hơn đánh số chạy suốt cả file.
  const renderRow = (tc: StudioTestCaseItem, displayIdx: number, editing: boolean) => {
    const draft = draftTestCases[tc.id] || {};
    const currentTC = { ...tc, ...draft };

    return (
      <tr key={tc.id} className={editing ? "tcs-row-editing" : ""}>
        <td>
          <div title={currentTC.feature_name || currentTC.module_name || currentTC.requirement_title || "-"}>
            {currentTC.feature_name || currentTC.module_name || currentTC.requirement_title || "-"}
          </div>
        </td>
        <td>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)" }}>
            TC-{String(displayIdx).padStart(2, "0")}
          </span>
        </td>

        {/* Title */}
        <td>
          {editing ? (
            <textarea className="tcs-cell-seamless" value={currentTC.title || ""} rows={2}
              onChange={e => onDraftChange(tc.id, "title", e.target.value)} />
          ) : <span style={{ fontWeight: 500 }}>{currentTC.title}</span>}
        </td>

        {/* Preconditions */}
        <td>
          {editing ? (
            <textarea className="tcs-cell-seamless" value={currentTC.preconditions || ""} rows={2}
              onChange={e => onDraftChange(tc.id, "preconditions", e.target.value)} />
          ) : currentTC.preconditions || <span style={{ color: "var(--text-muted)" }}>-</span>}
        </td>

        {/* Test Steps */}
        <td>
          {editing ? (
            <textarea className="tcs-cell-seamless" value={(currentTC.test_steps || []).join("\n")} rows={4}
              onChange={e => onDraftChange(tc.id, "test_steps", e.target.value.split("\n"))}
              placeholder="One step per line" />
          ) : (currentTC.test_steps && currentTC.test_steps.length > 0) ? (
            <ol style={{ margin: 0, paddingLeft: "16px" }}>
              {currentTC.test_steps.map((s: string, si: number) => <li key={si}>{s}</li>)}
            </ol>
          ) : <span style={{ color: "var(--text-muted)" }}>-</span>}
        </td>

        {/* Test Data */}
        <td>
          {editing ? (
            <textarea className="tcs-cell-seamless" value={currentTC.test_data || ""} rows={2}
              onChange={e => onDraftChange(tc.id, "test_data", e.target.value)} />
          ) : currentTC.test_data || <span style={{ color: "var(--text-muted)" }}>-</span>}
        </td>

        {/* Expected Result */}
        <td>
          {editing ? (
            <textarea className="tcs-cell-seamless" value={currentTC.expected_result || ""} rows={2}
              onChange={e => onDraftChange(tc.id, "expected_result", e.target.value)} />
          ) : currentTC.expected_result || <span style={{ color: "var(--text-muted)" }}>-</span>}
        </td>

        {/* Priority */}
        <td>
          {editing ? (
            <select className="tcs-cell-seamless tcs-cell-seamless-select" value={currentTC.priority || "Medium"}
              onChange={e => onDraftChange(tc.id, "priority", e.target.value)}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          ) : <PriorityBadge priority={currentTC.priority} />}
        </td>

        {/* Execution */}
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              className="tcs-dropdown"
              value={currentTC.execution_status || "Untested"}
              onChange={(e) => onExecutionStatusChange(tc, e.target.value)}
              style={{
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                cursor: "pointer",
                color: currentTC.execution_status === "Pass" ? "var(--success)" :
                       currentTC.execution_status === "Fail" ? "var(--danger)" :
                       currentTC.execution_status === "Blocked" ? "var(--warning)" : "var(--text-muted)"
              }}
            >
              <option value="Untested">Untested</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Blocked">Blocked</option>
            </select>
            {currentTC.execution_status === "Fail" && (
              <button
                onClick={() => onOpenBugReportDrawer(currentTC as StudioTestCaseItem)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "26px", height: "26px", borderRadius: "6px",
                  border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                  color: "var(--danger)", cursor: "pointer"
                }}
                title="View/Edit Bug Report"
              >
                <AlertCircleIcon />
              </button>
            )}
          </div>
        </td>

        {/* Note */}
        <td>
          {editing ? (
            <textarea className="tcs-cell-seamless" value={currentTC.note || ""} rows={2}
              onChange={e => onDraftChange(tc.id, "note", e.target.value)}
              placeholder="Add a note..." />
          ) : (
            <span style={{ fontSize: "12px", color: currentTC.note ? "var(--text-secondary)" : "var(--text-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {currentTC.note || "—"}
            </span>
          )}
        </td>
      </tr>
    );
  };

  // Form thêm test case thủ công — render bên trong nhóm requirement đang được thêm.
  const renderAddRow = () => (
    <tr key="__add_row__" className="tcs-row-editing" style={{ background: "color-mix(in srgb, var(--accent) 5%, transparent)" }}>
      <td><div style={{ color: "var(--text-muted)", fontSize: "12px" }}>- Auto -</div></td>
      <td><div style={{ color: "var(--text-muted)", fontSize: "12px" }}>- New -</div></td>
      <td>
        <textarea className="tcs-cell-seamless" placeholder="Title" value={newRowDraft.title || ""}
          onChange={e => onNewRowDraftChange({ ...newRowDraft, title: e.target.value })} rows={2} />
      </td>
      <td>
        <textarea className="tcs-cell-seamless" placeholder="Preconditions" value={newRowDraft.preconditions || ""}
          onChange={e => onNewRowDraftChange({ ...newRowDraft, preconditions: e.target.value })} rows={2} />
      </td>
      <td>
        <textarea className="tcs-cell-seamless" placeholder="One step per line" value={(newRowDraft.test_steps || []).join("\n")}
          onChange={e => onNewRowDraftChange({ ...newRowDraft, test_steps: e.target.value.split("\n") })} rows={4} />
      </td>
      <td>
        <textarea className="tcs-cell-seamless" placeholder="Data" value={newRowDraft.test_data || ""}
          onChange={e => onNewRowDraftChange({ ...newRowDraft, test_data: e.target.value })} rows={2} />
      </td>
      <td>
        <textarea className="tcs-cell-seamless" placeholder="Expected Result" value={newRowDraft.expected_result || ""}
          onChange={e => onNewRowDraftChange({ ...newRowDraft, expected_result: e.target.value })} rows={2} />
      </td>
      <td>
        <select className="tcs-cell-seamless tcs-cell-seamless-select" value={newRowDraft.priority || "Medium"}
          onChange={e => onNewRowDraftChange({ ...newRowDraft, priority: e.target.value })}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </td>
      <td>-</td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button className="btn btn-primary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={onAddNewRow} disabled={isCreatingRow}>Save</button>
          <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={onCancelAddRow}>Cancel</button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="tcs-view">
      <div className="tcs-view-header">
        <div className="tcs-breadcrumb">
          <button className="tcs-breadcrumb-btn" onClick={onGoBackToProjects}>
            <ArrowLeftIcon /> All Projects
          </button>
          <ChevronRightIcon />
          <button className="tcs-breadcrumb-btn" onClick={onGoBackToDocuments}>
            {selectedProject?.name}
          </button>
          <ChevronRightIcon />
          <span className="tcs-breadcrumb-current">{selectedDocument?.original_filename}</span>
        </div>

        <div className="tcs-view-title-row" style={{ marginTop: "12px", alignItems: "flex-end" }}>
          {/* Left Side: Edit Mode Controls & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 600 }}>Test Cases</span>
              <span className="tc-count-badge">{totalCount}</span>
            </div>

          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}>
            {/* Filters */}
            <div className="tcs-filters">
              <div className="tcs-filter-group">
                <label className="tcs-filter-label">Tìm kiếm</label>
                <div style={{ position: "relative" }}>
                  <Search size={13} strokeWidth={1.75} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tiêu đề, dữ liệu, kết quả..."
                    style={{
                      height: "32px", width: "220px", padding: "6px 26px 6px 28px", boxSizing: "border-box",
                      borderRadius: "6px", background: "var(--bg-surface)", color: "var(--text-primary)",
                      border: "1px solid var(--border)", fontSize: "12px", outline: "none",
                    }}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")}
                      style={{ position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                      <X size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
              <div className="tcs-filter-group">
                <label className="tcs-filter-label">Priority</label>
                <select className="tcs-filter-select" value={filterPriority} onChange={e => onFilterPriorityChange(e.target.value)}>
                  <option value="">All</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="tcs-filter-group">
                <label className="tcs-filter-label">Type</label>
                <select className="tcs-filter-select" value={filterTestType} onChange={e => onFilterTestTypeChange(e.target.value)}>
                  <option value="">All</option>
                  <option value="Positive">Positive</option>
                  <option value="Negative">Negative</option>
                  <option value="Boundary">Boundary</option>
                  <option value="Validation">Validation</option>
                  <option value="Permission">Permission</option>
                  <option value="State Transition">State Transition</option>
                  <option value="Integration">Integration</option>
                </select>
              </div>
            </div>

            {groups.length > 1 && (
              <button className="btn btn-secondary" onClick={toggleAll}
                style={{ fontSize: "12px", padding: "6px 12px", height: "32px", whiteSpace: "nowrap" }}>
                {allCollapsed ? "Mở tất cả" : "Thu gọn tất cả"}
              </button>
            )}

            {totalCount > 0 && (
              <button type="button" onClick={onExport} className="btn btn-secondary"
                 style={{ gap: "6px", textDecoration: "none", fontSize: "12px", padding: "6px 14px", height: "32px", marginLeft: "4px" }}>
                <DownloadIcon /> Export Excel
              </button>
            )}
          </div>
        </div>

        {executionSummary.total > 0 && (
          <div style={{ marginTop: "14px" }}>
            <ExecutionSummaryBar summary={executionSummary} />
          </div>
        )}
      </div>

      <div className="tcs-view-body">
        {isLoadingTCs ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "64px 20px", color: "var(--text-muted)" }}>
            <Sparkles className="animate-spin" size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "14px", fontWeight: 500 }}>Đang tải danh sách Test Cases...</span>
          </div>
        ) : testCases.length === 0 ? (
          <div className="tcs-empty">
            <div className="tcs-empty-icon"><FlaskIcon /></div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-secondary)" }}>No test cases</div>
            <div style={{ fontSize: "13px", maxWidth: "360px", textAlign: "center", lineHeight: 1.6 }}>
              No test cases have been generated for this document yet. Go to the project dashboard to generate them.
            </div>
          </div>
        ) : (
          <div className="tcs-table-wrap">
            <table className="tc-table">
              <thead>
                <tr>
                  <th className="tcs-sticky-header" style={{ width: "9%" }}>Feature</th>
                  <th className="tcs-sticky-header" style={{ width: "5%" }}>TC ID</th>
                  <th className="tcs-sticky-header" style={{ width: "13%" }}>Title</th>
                  <th className="tcs-sticky-header" style={{ width: "11%" }}>Preconditions</th>
                  <th className="tcs-sticky-header" style={{ width: "16%" }}>Test Steps</th>
                  <th className="tcs-sticky-header" style={{ width: "9%" }}>Test Data</th>
                  <th className="tcs-sticky-header" style={{ width: "12%" }}>Expected Result</th>
                  <th className="tcs-sticky-header" style={{ width: "6%" }}>Priority</th>
                  <th className="tcs-sticky-header" style={{ width: "10%" }}>Execution</th>
                  <th className="tcs-sticky-header" style={{ width: "9%" }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredCount === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontSize: "13px" }}>
                      {search ? `Không tìm thấy test case khớp "${search}".` : "Không có test case."}
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => {
                    const summary = computeExecutionSummary(g.items);
                    const isEditingThisGroup = editingGroupKey === g.key;
                    const isAddingThisGroup = addingGroupKey === g.key;
                    // Nhóm đang sửa/thêm luôn được mở để thao tác.
                    const isCollapsed = collapsedGroups.has(g.key) && !isEditingThisGroup && !isAddingThisGroup;
                    const groupReqId = g.items[0]?.requirement_id;
                    return (
                      <Fragment key={g.key}>
                        {/* Header nhóm requirement — bấm để gập/mở, hiện tên + số lượng + tóm tắt pass/fail. */}
                        <tr className="tcs-group-row" onClick={() => toggleGroup(g.key)} style={{ cursor: "pointer" }}>
                          {/* Sticky ngay dưới thead (top ≈ chiều cao header cột) để khi cuộn qua
                              các test case dài, người dùng luôn thấy đang ở nhóm requirement nào.
                              z-index < thead (10) để nhãn cột vẫn nằm trên; > dòng dữ liệu để che chúng. */}
                          <td colSpan={10} style={{ background: "var(--accent-dim)", borderTop: "2px solid var(--border)", padding: "9px 14px", position: "sticky", top: "34px", zIndex: 9 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <ChevronDown size={15} strokeWidth={2}
                                style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0, color: "var(--text-secondary)" }} />
                              <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>{g.label}</span>
                              <span className="tc-count-badge">{g.items.length}</span>
                              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>
                                {summary.Pass > 0 && (
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--success)" }} /> {summary.Pass}
                                  </span>
                                )}
                                {summary.Fail > 0 && (
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--danger)" }} /> {summary.Fail}
                                  </span>
                                )}
                                {summary.Blocked > 0 && (
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--warning)" }} /> {summary.Blocked}
                                  </span>
                                )}
                                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-muted)" }}>
                                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--text-muted)" }} /> {summary.Untested}
                                </span>
                              </span>
                              {/* Nút thao tác theo nhóm — stopPropagation để bấm không làm gập/mở nhóm. */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                                {isEditingThisGroup ? (
                                  <>
                                    <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: "11px", gap: "4px" }} onClick={onSaveBulkEditing} disabled={isBulkSaving}>
                                      {isBulkSaving ? <SpinnerIcon /> : <CheckIcon />} {isBulkSaving ? "Đang lưu..." : "Lưu"}
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "11px", gap: "4px" }} onClick={onCancelGroupEditing} disabled={isBulkSaving}>
                                      <XIcon /> Huỷ
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {groupReqId && (
                                      <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "11px", gap: "4px" }} onClick={() => onAddRowClick(g.key, groupReqId)}>
                                        + Thêm
                                      </button>
                                    )}
                                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "11px", gap: "4px" }} onClick={() => onStartGroupEditing(g.key)}>
                                      <EditIcon /> Sửa
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && g.items.map((tc, i) => renderRow(tc, i + 1, isEditingThisGroup))}
                        {isAddingThisGroup && renderAddRow()}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Edit Bar (always visible at bottom when editing) */}
      {editingGroupKey !== null && (
        <div className="tcs-edit-floating-bar">
          <div className="tcs-edit-floating-left">
            <div className="tcs-edit-banner-dot" />
            <span style={{ fontWeight: 600, fontSize: "13px" }}>Editing</span>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {Object.keys(draftTestCases).length > 0
                ? `${Object.keys(draftTestCases).length} modified`
                : "No changes yet"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="tcs-edit-btn-cancel" onClick={onCancelGroupEditing} disabled={isBulkSaving}>
              <XIcon /> Discard
            </button>
            <button className="tcs-edit-btn-save" onClick={onSaveBulkEditing} disabled={isBulkSaving}>
              {isBulkSaving ? <SpinnerIcon /> : <CheckIcon />}
              {isBulkSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
