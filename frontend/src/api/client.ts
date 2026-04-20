const API = "/api";

export async function createProject(files: FileList): Promise<{ project_id: string; image_count: number }> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", f);
  }
  const res = await fetch(`${API}/projects`, { method: "POST", body: form });
  return res.json();
}

export interface Job {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  result: { ply_path?: string } | null;
}

export async function startReconstruction(projectId: string): Promise<Job> {
  const res = await fetch(`${API}/projects/${projectId}/reconstruct`, { method: "POST" });
  return res.json();
}

export async function pollJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API}/jobs/${jobId}`);
  return res.json();
}

export interface Segment {
  segment_id: number;
  gaussian_count: number;
  center: [number, number, number];
  bbox_min: [number, number, number];
  bbox_max: [number, number, number];
  color: [number, number, number];
}

export async function runSegmentation(projectId: string): Promise<{ segments: Segment[] }> {
  const res = await fetch(`${API}/projects/${projectId}/segment`, { method: "POST" });
  return res.json();
}

export async function editSplat(
  projectId: string,
  segmentId: number,
  translation: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
  colorShift?: [number, number, number]
) {
  const res = await fetch(`${API}/projects/${projectId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      segment_id: segmentId,
      translation,
      rotation,
      scale,
      color_shift: colorShift ?? null,
    }),
  });
  return res.json();
}

export async function exportDataset(
  projectId: string,
  numVariants: number,
  positionJitter: number,
  colorJitter: number
) {
  const res = await fetch(`${API}/projects/${projectId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      num_variants: numVariants,
      position_jitter: positionJitter,
      color_jitter: colorJitter,
    }),
  });
  return res.json();
}

export function splatUrl(projectId: string): string {
  return `${API}/projects/${projectId}/splat/point_cloud.ply`;
}
