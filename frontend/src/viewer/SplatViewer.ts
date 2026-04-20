import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import * as THREE from "three";

export class SplatViewer {
  private viewer: any;
  private container: HTMLElement;
  private segmentBoxes: Map<number, THREE.Box3Helper> = new Map();
  private onSegmentClick?: (segmentId: number) => void;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private boundHandleClick: (e: MouseEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.boundHandleClick = this.handleClick.bind(this);
    this.container.addEventListener("click", this.boundHandleClick);
  }

  async loadSplat(url: string) {
    if (this.viewer) {
      try {
        this.viewer.dispose();
      } catch {
        // ignore disposal errors
      }
      // Clear any canvases left behind
      const canvases = this.container.querySelectorAll("canvas");
      canvases.forEach((c) => c.remove());
    }
    this.clearSegmentBoxes();

    this.viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, -1, 0],
      initialCameraPosition: [0, -2, 6],
      initialCameraLookAt: [0, 0, 0],
      rootElement: this.container,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
    });

    await this.viewer.addSplatScene(url, {
      showLoadingUI: true,
      progressiveLoad: true,
    });

    this.viewer.start();
  }

  addSegmentBoxes(
    segments: Array<{
      segment_id: number;
      bbox_min: [number, number, number];
      bbox_max: [number, number, number];
      color: [number, number, number];
    }>
  ) {
    this.clearSegmentBoxes();

    const scene = this.viewer?.threeScene;
    if (!scene) return;

    for (const seg of segments) {
      const box = new THREE.Box3(
        new THREE.Vector3(...seg.bbox_min),
        new THREE.Vector3(...seg.bbox_max)
      );
      const color = new THREE.Color(
        seg.color[0] / 255,
        seg.color[1] / 255,
        seg.color[2] / 255
      );
      const helper = new THREE.Box3Helper(box, color);
      helper.userData = { segmentId: seg.segment_id };
      scene.add(helper);
      this.segmentBoxes.set(seg.segment_id, helper);
    }
  }

  highlightSegment(segmentId: number) {
    for (const [id, box] of this.segmentBoxes) {
      const mat = box.material as THREE.LineBasicMaterial;
      if (id === segmentId) {
        mat.color.set(0xffff00);
        mat.linewidth = 2;
        mat.opacity = 1;
      } else {
        mat.color.set(0x888888);
        mat.linewidth = 1;
        mat.opacity = 0.5;
      }
      mat.transparent = true;
    }
  }

  clearSegmentBoxes() {
    for (const box of this.segmentBoxes.values()) {
      box.removeFromParent();
      box.geometry.dispose();
    }
    this.segmentBoxes.clear();
  }

  setOnSegmentClick(callback: (segmentId: number) => void) {
    this.onSegmentClick = callback;
  }

  private handleClick(event: MouseEvent) {
    if (!this.viewer?.camera || !this.onSegmentClick) return;

    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.viewer.camera);

    for (const [, box] of this.segmentBoxes) {
      const b3 = (box as any).box as THREE.Box3;
      if (this.raycaster.ray.intersectsBox(b3)) {
        const segId = box.userData.segmentId;
        this.onSegmentClick(segId);
        this.highlightSegment(segId);
        return;
      }
    }
  }

  dispose() {
    this.container.removeEventListener("click", this.boundHandleClick);
    this.clearSegmentBoxes();
    if (this.viewer) {
      try {
        this.viewer.dispose();
      } catch {
        // ignore
      }
    }
  }
}
