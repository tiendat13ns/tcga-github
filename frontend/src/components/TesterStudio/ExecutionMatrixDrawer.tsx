import { useMemo, useState } from "react";
import SideDrawer from "../SideDrawer";
import {
  useTestExecutions,
  useCreateExecution,
  useUpdateExecution,
  useDeleteExecution,
} from "../../hooks/useTestCases";
import { executionResultColor } from "./shared";
import type { TestExecutionItem } from "./shared";

type ExecutionMatrixDrawerProps = {
  // Chỉ cần id + title để mở — dữ liệu ma trận luôn được fetch tươi qua useTestExecutions,
  // không phụ thuộc snapshot cũ của StudioTestCaseItem (tránh lệch dữ liệu khi drawer mở lâu
  // và tester thêm/sửa nhiều ô liên tiếp).
  testCase: { id: string; title: string } | null;
  onClose: () => void;
};

const RESULT_OPTIONS = ["Untested", "Pass", "Fail", "Blocked"];

export default function ExecutionMatrixDrawer({ testCase, onClose }: ExecutionMatrixDrawerProps) {
  const testCaseId = testCase?.id || null;
  const { data: executions = [], isLoading } = useTestExecutions(testCaseId);
  const createExecution = useCreateExecution();
  const updateExecution = useUpdateExecution();
  const deleteExecution = useDeleteExecution();

  const [newEnvName, setNewEnvName] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, TestExecutionItem[]>();
    for (const ex of executions) {
      if (!map.has(ex.environment)) map.set(ex.environment, []);
      map.get(ex.environment)!.push(ex);
    }
    for (const list of map.values()) list.sort((a, b) => a.run_number - b.run_number);
    return Array.from(map.entries());
  }, [executions]);

  const handleAddEnvironment = async () => {
    const name = newEnvName.trim();
    if (!name || !testCaseId) return;
    try {
      await createExecution.mutateAsync({ testCaseId, environment: name });
      setNewEnvName("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add environment");
    }
  };

  const handleAddRun = async (environment: string) => {
    if (!testCaseId) return;
    try {
      await createExecution.mutateAsync({ testCaseId, environment });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add run");
    }
  };

  const handleResultChange = (execution: TestExecutionItem, result: string) => {
    updateExecution.mutate({ executionId: execution.id, data: { result } });
  };

  const handleDelete = (execution: TestExecutionItem) => {
    deleteExecution.mutate(execution.id);
  };

  return (
    <SideDrawer isOpen={!!testCase} onClose={onClose} title="Ma trận chạy thử" width="560px">
      {testCase && (
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "16px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "6px" }}>Test Case</div>
            <div style={{ fontWeight: 600, fontSize: "14px", lineHeight: 1.5, color: "var(--text-primary)" }}>{testCase.title}</div>
          </div>

          {isLoading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Đang tải...</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", border: "1px dashed var(--border)", borderRadius: "8px" }}>
              Chưa có môi trường/lần chạy nào. Thêm môi trường đầu tiên bên dưới.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {groups.map(([environment, runs]) => (
                <div key={environment} style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 600, fontSize: "13px" }}>{environment}</span>
                    <button
                      type="button"
                      onClick={() => handleAddRun(environment)}
                      disabled={createExecution.isPending}
                      className="btn btn-secondary"
                      style={{ fontSize: "11px", padding: "4px 10px", height: "26px" }}
                    >
                      + Lần chạy
                    </button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "10px 14px" }}>
                    {runs.map((execution) => (
                      <div
                        key={execution.id}
                        style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 4px 4px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }}
                      >
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Lần {execution.run_number}</span>
                        <select
                          value={execution.result}
                          onChange={(e) => handleResultChange(execution, e.target.value)}
                          style={{
                            fontWeight: 600, padding: "4px 6px", borderRadius: "5px", border: "1px solid var(--border)",
                            background: "var(--bg-elevated)", cursor: "pointer",
                            color: executionResultColor(execution.result), fontSize: "11px",
                          }}
                        >
                          {RESULT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDelete(execution)}
                          title="Xoá lần chạy này"
                          style={{ flexShrink: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px", fontSize: "14px", lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddEnvironment(); }}
              placeholder="Tên môi trường mới (VD: Desktop-Chrome, Mobile-Safari...)"
              style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", fontSize: "13px", color: "var(--text)" }}
            />
            <button
              type="button"
              onClick={handleAddEnvironment}
              disabled={!newEnvName.trim() || createExecution.isPending}
              className="btn btn-secondary"
              style={{ fontSize: "12px", padding: "8px 14px", whiteSpace: "nowrap" }}
            >
              + Môi trường
            </button>
          </div>
        </div>
      )}
    </SideDrawer>
  );
}
