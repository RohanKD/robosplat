import { useState } from "react";
import { exportDataset } from "../api/client";

interface Props {
  projectId: string;
}

export function ExportPanel({ projectId }: Props) {
  const [numVariants, setNumVariants] = useState(10);
  const [posJitter, setPosJitter] = useState(0.1);
  const [colorJitter, setColorJitter] = useState(0.2);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string>("");

  const handleExport = async () => {
    setExporting(true);
    setResult("");
    try {
      const res = await exportDataset(projectId, numVariants, posJitter, colorJitter);
      setResult(`Exported ${res.num_variants} variants to ${res.export_path}`);
    } catch (err) {
      setResult(`Export failed: ${err}`);
    }
    setExporting(false);
  };

  return (
    <div className="export-panel">
      <h3>Export Training Data</h3>
      <div className="control-group">
        <label>Number of Variants</label>
        <input type="number" min={1} max={100} value={numVariants} onChange={(e) => setNumVariants(+e.target.value)} />
      </div>
      <div className="control-group">
        <label>Position Jitter</label>
        <input type="range" min={0} max={0.5} step={0.01} value={posJitter} onChange={(e) => setPosJitter(+e.target.value)} />
        <span>{posJitter.toFixed(2)}</span>
      </div>
      <div className="control-group">
        <label>Color Jitter</label>
        <input type="range" min={0} max={0.5} step={0.01} value={colorJitter} onChange={(e) => setColorJitter(+e.target.value)} />
        <span>{colorJitter.toFixed(2)}</span>
      </div>
      <button onClick={handleExport} disabled={exporting}>
        {exporting ? "Generating..." : "Generate Training Set"}
      </button>
      {result && <p className="export-result">{result}</p>}
    </div>
  );
}
