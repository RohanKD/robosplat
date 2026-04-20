import { useCallback, useRef, useState, useEffect } from "react";
import { createProject, startReconstruction, pollJob, type Job } from "../api/client";

interface Props {
  onProjectReady: (projectId: string) => void;
}

export function UploadPanel({ onProjectReady }: Props) {
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    abortRef.current = false;
    setUploading(true);
    setStatus(`Uploading ${files.length} images...`);

    try {
      const { project_id, image_count } = await createProject(files);
      setStatus(`Uploaded ${image_count} images. Starting reconstruction...`);

      const job = await startReconstruction(project_id);
      pollUntilDone(job.job_id, project_id);
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
      setUploading(false);
    }
  }, []);

  const pollUntilDone = (jobId: string, projectId: string) => {
    const poll = async () => {
      if (abortRef.current) return;
      try {
        const job: Job = await pollJob(jobId);
        setProgress(job.progress);
        setStatus(job.message);

        if (job.status === "completed") {
          setUploading(false);
          onProjectReady(projectId);
        } else if (job.status === "failed") {
          setUploading(false);
          setStatus(`Failed: ${job.message}`);
        } else {
          setTimeout(poll, 2000);
        }
      } catch {
        setStatus("Lost connection to server");
        setUploading(false);
      }
    };
    poll();
  };

  return (
    <div className="upload-panel">
      <h3>Upload Workspace Photos</h3>
      <div
        className={`drop-zone ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
            <span className="status-text">{status}</span>
          </div>
        ) : (
          <>
            <div className="drop-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <p>Drop photos here or click to upload</p>
            <p className="hint">20-30 overlapping photos of your workspace</p>
          </>
        )}
      </div>
    </div>
  );
}
