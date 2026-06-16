import { useCallback, useRef, useState } from "react";
import { FlakySnapshot } from "../types";

interface Props {
  onFiles: (snapshots: FlakySnapshot[]) => void;
  noApps?: boolean;
}

export function FileDropZone({ onFiles, noApps }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const readFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const picked = Array.from(files).slice(0, 2);
      setParseError("");
      try {
        const snapshots = await Promise.all(
          picked.map(async (f) => {
            const text = await f.text();
            const json = JSON.parse(text);
            if (!json.tests || !json.summary) throw new Error(`${f.name} doesn't look like a snapshot file`);
            return json as FlakySnapshot;
          })
        );
        onFiles(snapshots);
      } catch (e) {
        setParseError(String((e as Error).message));
      }
    },
    [onFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      readFiles(e.dataTransfer.files);
    },
    [readFiles]
  );

  if (!noApps) return null;

  return (
    <div className="drop-outer">
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          style={{ display: "none" }}
          onChange={(e) => readFiles(e.target.files)}
        />
        <div className="drop-icon">⬇</div>
        <p className="drop-title">Drop snapshot JSON file{" "}<span className="drop-muted">(or two to compare)</span></p>
        <p className="drop-hint">Load a previously exported snapshot without configuring an app.</p>
        <button className="drop-btn" type="button">Browse files</button>
      </div>
      {parseError && <div className="error" style={{ marginTop: 12 }}>{parseError}</div>}
    </div>
  );
}
