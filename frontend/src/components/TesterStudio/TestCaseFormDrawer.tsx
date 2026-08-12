import type { Dispatch, SetStateAction } from "react";
import SideDrawer from "../SideDrawer";
import type { StudioTestCaseItem } from "./shared";

type TestCaseFormDrawerProps = {
  isOpen: boolean;
  title: string;
  draft: Partial<StudioTestCaseItem>;
  onDraftChange: Dispatch<SetStateAction<Partial<StudioTestCaseItem>>>;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "6px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: "8px", color: "var(--text)", fontSize: "13px", minHeight: "80px", resize: "vertical",
  lineHeight: 1.6, fontFamily: "inherit", transition: "border-color 0.2s",
};

// Drawer dùng chung cho cả Thêm mới và Sửa 1 test case — thay cho việc chỉnh trực tiếp
// trong ô bảng (textarea resize được làm lệch layout bảng khi sửa nhiều dòng cùng lúc).
export default function TestCaseFormDrawer({ isOpen, title, draft, onDraftChange, onClose, onSave, isSaving }: TestCaseFormDrawerProps) {
  const testStepsText = (draft.test_steps || []).join("\n");

  return (
    <SideDrawer isOpen={isOpen} onClose={onClose} title={title} width="480px">
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <div style={fieldLabelStyle}>Title <span style={{ color: "var(--danger)" }}>*</span></div>
          <textarea
            value={draft.title || ""}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, title: e.target.value }))}
            style={{ ...textareaStyle, minHeight: "56px" }}
            placeholder="Tên test case..."
          />
        </div>

        <div>
          <div style={fieldLabelStyle}>Preconditions</div>
          <textarea
            value={draft.preconditions || ""}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, preconditions: e.target.value }))}
            style={{ ...textareaStyle, minHeight: "56px" }}
            placeholder="Điều kiện tiên quyết..."
          />
        </div>

        <div>
          <div style={fieldLabelStyle}>Test Steps</div>
          <textarea
            value={testStepsText}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, test_steps: e.target.value.split("\n") }))}
            style={{ ...textareaStyle, minHeight: "110px" }}
            placeholder="Mỗi bước một dòng..."
          />
        </div>

        <div>
          <div style={fieldLabelStyle}>Test Data</div>
          <textarea
            value={draft.test_data || ""}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, test_data: e.target.value }))}
            style={{ ...textareaStyle, minHeight: "56px" }}
            placeholder="Dữ liệu test..."
          />
        </div>

        <div>
          <div style={fieldLabelStyle}>Expected Result</div>
          <textarea
            value={draft.expected_result || ""}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, expected_result: e.target.value }))}
            style={{ ...textareaStyle, minHeight: "56px" }}
            placeholder="Kết quả mong đợi..."
          />
        </div>

        <div>
          <div style={fieldLabelStyle}>Priority</div>
          <select
            value={draft.priority || "Medium"}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, priority: e.target.value }))}
            style={{ width: "100%", padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", fontSize: "13px", fontFamily: "inherit", cursor: "pointer" }}
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div>
          <div style={fieldLabelStyle}>Note</div>
          <textarea
            value={draft.note || ""}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, note: e.target.value }))}
            style={{ ...textareaStyle, minHeight: "56px" }}
            placeholder="Ghi chú thêm (tuỳ chọn)..."
          />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onSave}
            disabled={isSaving}
            style={{
              flex: 1, background: "var(--accent)", color: "white", border: "none", padding: "11px 16px", borderRadius: "8px",
              fontWeight: 600, fontSize: "13px", cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1,
              transition: "all 0.2s",
            }}>
            {isSaving ? "Đang lưu..." : "Save"}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              flex: 1, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)",
              padding: "11px 16px", borderRadius: "8px", fontWeight: 600, fontSize: "13px",
              cursor: isSaving ? "not-allowed" : "pointer", transition: "all 0.2s",
            }}>
            Cancel
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
