import { useCallback, useRef, useState } from "react";
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

  const handleFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return;

    setUploading(true);
    setStatus(`Uploading ${files.length} images...`);

    try {
      const { project_id, image_count } = await createProject(files);
      setStatus(`Uploaded ${image_count} images. Starting reconstruction...`);

      const job = await startReconstruction(project_id);
      await pollUntilDone(job.job_id, project_id);
    } catch (err) {
      setStatus(`Error: ${err}`);
      setUploading(false);
    }
  }, []);

  const pollUntilDone = async (jobId: string, projectId: string) => {
    const poll = async () => {
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
    };
    poll();
  };

  return (
    <div className="upload-panel">
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
            <div className="drop-icon">+</div>
            <p>Drop photos here or click to upload</p>
            <p className="hint">Upload 20-30 overlapping photos of your workspace</p>
          </>
        )}
      </div>
    </div>
  );
}
