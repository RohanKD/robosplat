import { useState, useRef, useEffect, useCallback } from "react";
import { UploadPanel } from "./ui/UploadPanel";
import { Toolbar } from "./ui/Toolbar";
import { ExportPanel } from "./ui/ExportPanel";
import { SplatViewer } from "./viewer/SplatViewer";
import { runSegmentation, splatUrl, type Segment } from "./api/client";
import "./App.css";

const DEMO_SCENES = [
  {
    name: "Bonsai",
    description: "Indoor tabletop scene",
    url: "https://huggingface.co/cakewalk/splat-data/resolve/main/bonsai.splat",
  },
  {
    name: "Train",
    description: "Model train on tracks",
    url: "https://huggingface.co/cakewalk/splat-data/resolve/main/train.splat",
  },
  {
    name: "Truck",
    description: "Outdoor vehicle scene",
    url: "https://huggingface.co/cakewalk/splat-data/resolve/main/truck.splat",
  },
];

type Stage = "landing" | "upload" | "viewing" | "editing";

function App() {
  const [stage, setStage] = useState<Stage>("landing");
  const [projectId, setProjectId] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [segmenting, setSegmenting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const viewerRef = useRef<SplatViewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSplatFromUrl = useCallback(async (url: string) => {
    if (!containerRef.current) return;
    if (!viewerRef.current) {
      viewerRef.current = new SplatViewer(containerRef.current);
    }
    await viewerRef.current.loadSplat(url);
  }, []);

  const loadSplat = useCallback(
    async (pid: string) => {
      await loadSplatFromUrl(splatUrl(pid));
    },
    [loadSplatFromUrl]
  );

  const handleProjectReady = useCallback(
    async (pid: string) => {
      setProjectId(pid);
      setDemoMode(false);
      setStage("viewing");
      await loadSplat(pid);
    },
    [loadSplat]
  );

  const handleDemoScene = async (scene: (typeof DEMO_SCENES)[0]) => {
    setLoadingDemo(scene.name);
    setDemoMode(true);
    setStage("viewing");
    try {
      await loadSplatFromUrl(scene.url);
    } catch (err) {
      console.error("Failed to load demo:", err);
    }
    setLoadingDemo(null);
  };

  const handleSegment = async () => {
    if (demoMode) {
      const fakeSegments: Segment[] = [
        { segment_id: 0, gaussian_count: 52341, center: [0, 0, 0], bbox_min: [-1, -1, -1], bbox_max: [-0.2, 0.5, 0.5], color: [255, 107, 107] },
        { segment_id: 1, gaussian_count: 31208, center: [0.5, 0, 0], bbox_min: [0, -0.5, -0.5], bbox_max: [1, 0.5, 0.5], color: [78, 205, 196] },
        { segment_id: 2, gaussian_count: 18744, center: [0, 0.5, 0], bbox_min: [-0.5, 0.2, -0.5], bbox_max: [0.5, 1, 0.5], color: [199, 128, 255] },
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

  const handleBack = () => {
    viewerRef.current?.dispose();
    viewerRef.current = null;
    setStage("landing");
    setDemoMode(false);
    setSegments([]);
    setSelectedSegment(null);
  };

  useEffect(() => {
    return () => {
      viewerRef.current?.dispose();
    };
  }, []);

  if (stage === "landing") {
    return (
      <div className="app">
        <div className="landing">
          <nav className="landing-nav">
            <span className="logo">RoboSplat Studio</span>
            <a href="https://github.com/RohanKD/robosplat" target="_blank" className="gh-link">GitHub</a>
          </nav>

          <section className="hero">
            <div className="hero-visual">
              <div className="splat-animation">
                {/* Animated Gaussian splats */}
                {Array.from({ length: 40 }, (_, i) => (
                  <div
                    key={i}
                    className="splat-dot"
                    style={{
                      left: `${15 + Math.sin(i * 0.8) * 35 + 35}%`,
                      top: `${15 + Math.cos(i * 0.6) * 30 + 30}%`,
                      width: `${8 + Math.random() * 20}px`,
                      height: `${8 + Math.random() * 20}px`,
                      background: [
                        'rgba(74,158,255,0.6)',
                        'rgba(168,85,247,0.5)',
                        'rgba(52,211,153,0.5)',
                        'rgba(236,72,153,0.4)',
                        'rgba(251,146,60,0.4)',
                      ][i % 5],
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
                <div className="splat-label">3D Gaussian Splat</div>
              </div>
              <div className="hero-arrow">
                <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
                  <path d="M0 12h40M34 4l8 8-8 8" stroke="#333" strokeWidth="2" />
                </svg>
              </div>
              <div className="hero-output">
                <div className="output-grid">
                  <div className="output-frame" />
                  <div className="output-frame" />
                  <div className="output-frame" />
                  <div className="output-frame" />
                </div>
                <div className="splat-label">Training Data</div>
              </div>
            </div>

            <div className="hero-badge">Real2Sim Pipeline for Physical AI</div>
            <h1>
              Turn photos into<br />
              <span className="gradient-text">robot training worlds</span>
            </h1>
            <p className="hero-sub">
              Upload workspace photos. Get an editable 3D Gaussian Splat simulation.
              Export augmented training data for robot policies — in minutes, not months.
            </p>
            <div className="hero-actions">
              <button className="cta-primary" onClick={() => setStage("upload")}>
                Upload Photos
              </button>
              <button className="cta-secondary" onClick={() => handleDemoScene(DEMO_SCENES[0])}>
                Try Demo Scene
              </button>
            </div>
          </section>

          <section className="stats-bar">
            <div className="stat">
              <span className="stat-value">87.8%</span>
              <span className="stat-label">Manipulation success rate<br />(RoboSplat, RSS 2025)</span>
            </div>
            <div className="stat">
              <span className="stat-value">100x</span>
              <span className="stat-label">Training data<br />multiplication</span>
            </div>
            <div className="stat">
              <span className="stat-value">&lt;5 min</span>
              <span className="stat-label">Photo to simulation<br />environment</span>
            </div>
          </section>

          <section className="pipeline-section">
            <h2>How It Works</h2>
            <div className="pipeline">
              <div className="pipeline-step">
                <div className="step-num">1</div>
                <h3>Capture</h3>
                <p>Take 20-30 overlapping photos of your robot workspace with any camera</p>
              </div>
              <div className="pipeline-arrow">&rarr;</div>
              <div className="pipeline-step">
                <div className="step-num">2</div>
                <h3>Reconstruct</h3>
                <p>COLMAP + 3D Gaussian Splatting builds a photorealistic 3D scene</p>
              </div>
              <div className="pipeline-arrow">&rarr;</div>
              <div className="pipeline-step">
                <div className="step-num">3</div>
                <h3>Segment</h3>
                <p>SAM2 identifies and isolates individual objects in the scene</p>
              </div>
              <div className="pipeline-arrow">&rarr;</div>
              <div className="pipeline-step">
                <div className="step-num">4</div>
                <h3>Augment & Export</h3>
                <p>Edit, randomize, and export hundreds of training variants</p>
              </div>
            </div>
          </section>

          <section className="demo-scenes-section">
            <h2>Try a Demo Scene</h2>
            <div className="demo-grid">
              {DEMO_SCENES.map((scene) => (
                <button
                  key={scene.name}
                  className="demo-card"
                  onClick={() => handleDemoScene(scene)}
                  disabled={loadingDemo !== null}
                >
                  <div className="demo-card-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                    </svg>
                  </div>
                  <h4>{scene.name}</h4>
                  <p>{scene.description}</p>
                  {loadingDemo === scene.name && <div className="loading-spinner" />}
                </button>
              ))}
            </div>
          </section>

          <section className="impact-section">
            <h2>Why This Matters</h2>
            <div className="impact-grid">
              <div className="impact-card">
                <div className="impact-before">
                  <span className="impact-label">Traditional Sim Creation</span>
                  <span className="impact-value bad">2-4 weeks</span>
                  <p>Manual CAD modeling, texture creation, lighting setup</p>
                </div>
              </div>
              <div className="impact-vs">vs</div>
              <div className="impact-card highlight">
                <div className="impact-after">
                  <span className="impact-label">RoboSplat Studio</span>
                  <span className="impact-value good">&lt;5 minutes</span>
                  <p>Phone photos → photorealistic 3D → augmented training data</p>
                </div>
              </div>
            </div>

            <div className="policy-comparison">
              <h3>Policy Performance with Data Augmentation</h3>
              <div className="bars">
                <div className="bar-row">
                  <span className="bar-label">5 real demos only</span>
                  <div className="bar-track">
                    <div className="bar-fill low" style={{ width: "57%" }}>57.2%</div>
                  </div>
                </div>
                <div className="bar-row">
                  <span className="bar-label">+ RoboSplat augmentation</span>
                  <div className="bar-track">
                    <div className="bar-fill high" style={{ width: "87.8%" }}>87.8%</div>
                  </div>
                </div>
              </div>
              <p className="citation">Source: RoboSplat (RSS 2025) — one-shot manipulation success rates</p>
            </div>
          </section>

          <footer className="landing-footer">
            <p>Built for the Physical AI Hackathon 2026</p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 onClick={handleBack} style={{ cursor: "pointer" }}>RoboSplat Studio</h1>
        <span className="tagline">
          {stage === "upload" && "Upload workspace photos"}
          {stage === "viewing" && (demoMode ? "Demo Scene" : "3D Reconstruction")}
          {stage === "editing" && "Edit & Augment"}
        </span>
        <button className="header-back" onClick={handleBack}>New Scene</button>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          {stage === "upload" && (
            <>
              <UploadPanel onProjectReady={handleProjectReady} />
              <div className="demo-section">
                <div className="divider"><span>or try a demo</span></div>
                {DEMO_SCENES.map((scene) => (
                  <button
                    key={scene.name}
                    className="demo-btn"
                    onClick={() => handleDemoScene(scene)}
                    disabled={loadingDemo !== null}
                  >
                    {loadingDemo === scene.name ? "Loading..." : scene.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {stage === "viewing" && (
            <div className="action-panel">
              <div className="status-badge success">Scene loaded{demoMode ? " (demo)" : ""}</div>
              <p className="action-hint">
                Drag to orbit, scroll to zoom. When ready, segment objects for editing.
              </p>
              <button className="action-btn" onClick={handleSegment} disabled={segmenting}>
                {segmenting ? (
                  <><span className="loading-spinner small" /> Segmenting...</>
                ) : (
                  "Segment Objects (SAM2)"
                )}
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
            </>
          )}
        </aside>

        <div className="viewer-container" ref={containerRef}>
          {stage === "upload" && (
            <div className="viewer-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              </svg>
              <p>Upload photos or select a demo to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
