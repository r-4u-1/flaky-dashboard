import { useState } from "react";
import { AppConfig, DEFAULT_WORKFLOW, loadApps, loadPat, loadWorkflow, saveApps, savePat, saveWorkflow } from "../config";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_APP: Omit<AppConfig, "key"> & { key: string } = {
  key: "", name: "", pipeline: "", org: "", project: "",
};

export function SettingsPanel({ onClose, onSaved }: Props) {
  const [apps, setApps] = useState<AppConfig[]>(() => loadApps());
  const [pat, setPat] = useState(() => loadPat());
  const [workflow, setWorkflow] = useState(() => loadWorkflow());
  const [newApp, setNewApp] = useState({ ...EMPTY_APP });
  const [addError, setAddError] = useState("");

  function addApp() {
    const { key, name, pipeline, org, project } = newApp;
    if (!key || !name || !pipeline || !org || !project) {
      setAddError("All fields are required.");
      return;
    }
    if (apps.some((a) => a.key === key)) {
      setAddError("App key already exists.");
      return;
    }
    setAddError("");
    setApps([...apps, { key, name, pipeline, org, project }]);
    setNewApp({ ...EMPTY_APP });
  }

  function removeApp(key: string) {
    setApps(apps.filter((a) => a.key !== key));
  }

  function save() {
    saveApps(apps);
    savePat(pat.trim());
    saveWorkflow(workflow.trim() || DEFAULT_WORKFLOW);
    onSaved();
    onClose();
  }

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <section>
          <h3>Azure DevOps</h3>
          <label>
            Personal Access Token (PAT)
            <input
              type="password"
              value={pat}
              placeholder="Leave blank for mock/demo data"
              onChange={(e) => setPat(e.target.value)}
            />
            <span className="hint">Needs <strong>Analytics: Read</strong> scope. Stored in browser localStorage.</span>
          </label>
          <label>
            Workflow
            <input
              type="text"
              value={workflow}
              placeholder={DEFAULT_WORKFLOW}
              onChange={(e) => setWorkflow(e.target.value)}
            />
          </label>
        </section>

        <section>
          <h3>Apps</h3>
          {apps.length > 0 && (
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Key</th><th>Name</th><th>Pipeline</th><th>Org</th><th>Project</th><th></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.key}>
                    <td><code>{a.key}</code></td>
                    <td>{a.name}</td>
                    <td>{a.pipeline}</td>
                    <td>{a.org}</td>
                    <td>{a.project}</td>
                    <td><button className="danger-btn" onClick={() => removeApp(a.key)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="add-app-form">
            <h4>Add app</h4>
            <div className="add-app-grid">
              {(["key", "name", "pipeline", "org", "project"] as const).map((f) => (
                <label key={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <input
                    type="text"
                    value={newApp[f]}
                    placeholder={f === "key" ? "e.g. myapp" : ""}
                    onChange={(e) => setNewApp({ ...newApp, [f]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {addError && <div className="error" style={{ marginBottom: 8 }}>{addError}</div>}
            <button className="primary" onClick={addApp}>Add app</button>
          </div>
        </section>

        <div className="settings-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
