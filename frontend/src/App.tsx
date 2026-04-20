import { useState, useRef, useEffect, useCallback } from "react";
import { UploadPanel } from "./ui/UploadPanel";
import { Toolbar } from "./ui/Toolbar";
import { ExportPanel } from "./ui/ExportPanel";
import { SplatViewer } from "./viewer/SplatViewer";
import { runSegmentation, splatUrl, type Segment } from "./api/client";
import "./App.css";

// Demo splat files hosted publicly (Gaussian Splat .ply/.splat files)
const DEMO_SCENES = [
  {
    name: "Bonsai",
    url: "https://huggingface.co/cakewalk/splat-data/resolve/main/bonsai.splat",
  },
  {
    name: "Train",
    url: "https://huggingface.co/cakewalk/splat-data/resolve/main/train.splat",
  },
  {
    name: "Truck",
    url: "https://huggingface.co/cakewalk/splat-data/resolve/main/truck.splat",
  },
];

type Stage = "upload" | "viewing" | "editing";

function App() {
  const [stage, setStage] = useState<Stage>("upload");
  const [projectId, setProjectId] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [segmenting, setSegmenting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const viewerRef = useRef<SplatViewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSplatFromUrl = useCallback(async (url: string) => {
    if (!containerRef.current) return;
    if (!viewerRef.current) {
      viewerRef.current = new SplatViewer(containerRef.current);
    }
    await viewerRef.current.loadSplat(url);
  }, []);

  const loadSplat = useCallback(async (pid: string) => {
    await loadSplatFromUrl(splatUrl(pid));
  }, [loadSplatFromUrl]);

  const handleProjectReady = useCallback(async (pid: string) => {
    setProjectId(pid);
    setDemoMode(false);
    setStage("viewing");
    await loadSplat(pid);
  }, [loadSplat]);

  const handleDemoScene = async (url: string) => {
    setLoadingDemo(true);
    setDemoMode(true);
    setStage("viewing");
    try {
      await loadSplatFromUrl(url);
    } catch (err) {
      console.error("Failed to load demo:", err);
    }
    setLoadingDemo(false);
  };

  const handleSegment = async () => {
    if (demoMode) {
      // In demo mode, generate synthetic segments for the viewer
      const fakeSegments: Segment[] = [
        { segment_id: 0, gaussian_count: 50000, center: [0, 0, 0], bbox_min: [-1, -1, -1], bbox_max: [-0.2, 0.5, 0.5], color: [255, 100, 100] },
        { segment_id: 1, gaussian_count: 30000, center: [0.5, 0, 0], bbox_min: [0, -0.5, -0.5], bbox_max: [1, 0.5, 0.5], color: [100, 255, 100] },
        { segment_id: 2, gaussian_count: 20000, center: [0, 0.5, 0], bbox_min: [-0.5, 0.2, -0.5], bbox_max: [0.5, 1, 0.5], color: [100, 100, 255] },
      ];
      setSegments(fakeSegments);
      setStage("editing");
      viewerRef.current?.addSegmentBoxes(fakeSegments);
      viewerRef.current?.setOnSegmentClick((id) => setSelectedSegment(id));
      return;
    }
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
    if (demoMode) return;
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
            <>
              <UploadPanel onProjectReady={handleProjectReady} />
              <div className="demo-section">
                <div className="divider"><span>or try a demo scene</span></div>
                {DEMO_SCENES.map((scene) => (
                  <button
                    key={scene.name}
                    className="demo-btn"
                    onClick={() => handleDemoScene(scene.url)}
                    disabled={loadingDemo}
                  >
                    {loadingDemo ? "Loading..." : scene.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {stage === "viewing" && (
            <div className="action-panel">
              <p>3D scene loaded{demoMode ? " (demo)" : ""}.</p>
              <button onClick={handleSegment} disabled={segmenting}>
                {segmenting ? "Segmenting objects..." : "Segment Objects (SAM2)"}
              </button>
              <button className="back-btn" onClick={() => { setStage("upload"); setDemoMode(false); }}>
                Back
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
              {!demoMode && <ExportPanel projectId={projectId} />}
              <button className="back-btn" onClick={() => { setStage("upload"); setDemoMode(false); setSegments([]); }}>
                New Scene
              </button>
            </>
          )}
        </aside>

        <div className="viewer-container" ref={containerRef}>
          {stage === "upload" && (
            <div className="viewer-placeholder">
              <p>Upload photos or select a demo scene to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
