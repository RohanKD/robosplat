import { useState } from "react";
import { type Segment, editSplat } from "../api/client";

interface Props {
  projectId: string;
  segments: Segment[];
  selectedSegment: number | null;
  onSelectSegment: (id: number) => void;
  onSplatUpdated: () => void;
}

export function Toolbar({ projectId, segments, selectedSegment, onSelectSegment, onSplatUpdated }: Props) {
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [tz, setTz] = useState(0);
  const [rx, setRx] = useState(0);
  const [ry, setRy] = useState(0);
  const [rz, setRz] = useState(0);
  const [editing, setEditing] = useState(false);

  const applyEdit = async () => {
    if (selectedSegment === null) return;
    setEditing(true);
    try {
      await editSplat(projectId, selectedSegment, [tx, ty, tz], [rx, ry, rz], [1, 1, 1]);
      onSplatUpdated();
      // Reset
      setTx(0); setTy(0); setTz(0);
      setRx(0); setRy(0); setRz(0);
    } catch (err) {
      console.error("Edit failed:", err);
    }
    setEditing(false);
  };

  const applyRandomColor = async () => {
    if (selectedSegment === null) return;
    setEditing(true);
    const shift: [number, number, number] = [
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
    ];
    await editSplat(projectId, selectedSegment, [0, 0, 0], [0, 0, 0], [1, 1, 1], shift);
    onSplatUpdated();
    setEditing(false);
  };

  return (
    <div className="toolbar">
      <h3>Segments</h3>
      <div className="segment-list">
        {segments.map((seg) => (
          <button
            key={seg.segment_id}
            className={`segment-btn ${selectedSegment === seg.segment_id ? "selected" : ""}`}
            onClick={() => onSelectSegment(seg.segment_id)}
            style={{
              borderLeft: `4px solid rgb(${seg.color[0]}, ${seg.color[1]}, ${seg.color[2]})`,
            }}
          >
            Segment {seg.segment_id} ({seg.gaussian_count.toLocaleString()} pts)
          </button>
        ))}
      </div>

      {selectedSegment !== null && (
        <div className="edit-controls">
          <h3>Edit Segment {selectedSegment}</h3>
          <div className="control-group">
            <label>Translate</label>
            <div className="xyz-inputs">
              <input type="number" step="0.05" value={tx} onChange={(e) => setTx(+e.target.value)} placeholder="X" />
              <input type="number" step="0.05" value={ty} onChange={(e) => setTy(+e.target.value)} placeholder="Y" />
              <input type="number" step="0.05" value={tz} onChange={(e) => setTz(+e.target.value)} placeholder="Z" />
            </div>
          </div>
          <div className="control-group">
            <label>Rotate (deg)</label>
            <div className="xyz-inputs">
              <input type="number" step="5" value={rx} onChange={(e) => setRx(+e.target.value)} placeholder="X" />
              <input type="number" step="5" value={ry} onChange={(e) => setRy(+e.target.value)} placeholder="Y" />
              <input type="number" step="5" value={rz} onChange={(e) => setRz(+e.target.value)} placeholder="Z" />
            </div>
          </div>
          <div className="edit-buttons">
            <button onClick={applyEdit} disabled={editing}>
              {editing ? "Applying..." : "Apply Transform"}
            </button>
            <button onClick={applyRandomColor} disabled={editing}>
              Randomize Color
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
