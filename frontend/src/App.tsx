import { useState, useRef, useEffect, useCallback } from "react";
import { UploadPanel } from "./ui/UploadPanel";
import { Toolbar } from "./ui/Toolbar";
import { ExportPanel } from "./ui/ExportPanel";
import { SplatViewer } from "./viewer/SplatViewer";
import { runSegmentation, splatUrl, type Segment } from "./api/client";
import "./App.css";

type Stage = "upload" | "viewing" | "editing";

function App() {
  const [stage, setStage] = useState<Stage>("upload");
  const [projectId, setProjectId] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [segmenting, setSegmenting] = useState(false);
  const viewerRef = useRef<SplatViewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSplat = useCallback(async (pid: string) => {
    if (!containerRef.current) return;
    if (!viewerRef.current) {
      viewerRef.current = new SplatViewer(containerRef.current);
    }
    await viewerRef.current.loadSplat(splatUrl(pid));
  }, []);

  const handleProjectReady = useCallback(async (pid: string) => {
    setProjectId(pid);
    setStage("viewing");
    await loadSplat(pid);
  }, [loadSplat]);

  const handleSegment = async () => {
    setSegmenting(true);
    try {
      const res = await runSegmentation(projectId);
      setSegments(res.segments);
      setStage("editing");
      viewerRef.current?.addSegmentBoxes(res.segments);
      viewerRef.current?.setOnSegmentClick((id) => setSelectedSegment(id));
    } catch (err) {
      console.error("Segmentation failed:", err);
    }
    setSegmenting(false);
  };

  const handleSplatUpdated = async () => {
    await loadSplat(projectId);
    if (segments.length > 0) {
      viewerRef.current?.addSegmentBoxes(segments);
    }
  };

  useEffect(() => {
    return () => {
      viewerRef.current?.dispose();
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>RoboSplat Studio</h1>
        <span className="tagline">Photo to Simulation in Minutes</span>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          {stage === "upload" && (
            <UploadPanel onProjectReady={handleProjectReady} />
          )}

          {stage === "viewing" && (
            <div className="action-panel">
              <p>3D reconstruction complete.</p>
              <button onClick={handleSegment} disabled={segmenting}>
                {segmenting ? "Segmenting objects..." : "Segment Objects (SAM2)"}
              </button>
            </div>
          )}

          {stage === "editing" && (
            <>
              <Toolbar
                projectId={projectId}
                segments={segments}
                selectedSegment={selectedSegment}
                onSelectSegment={(id) => {
                  setSelectedSegment(id);
                  viewerRef.current?.highlightSegment(id);
                }}
                onSplatUpdated={handleSplatUpdated}
              />
              <ExportPanel projectId={projectId} />
            </>
          )}
        </aside>

        <div className="viewer-container" ref={containerRef}>
          {stage === "upload" && (
            <div className="viewer-placeholder">
              <p>Upload photos to begin 3D reconstruction</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
