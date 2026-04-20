import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import * as THREE from "three";

export class SplatViewer {
  private viewer: any;
  private container: HTMLElement;
  private segmentBoxes: Map<number, THREE.Box3Helper> = new Map();
  private threeScene: THREE.Scene;
  private onSegmentClick?: (segmentId: number) => void;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(container: HTMLElement) {
    this.container = container;
    this.threeScene = new THREE.Scene();
  }

  async loadSplat(url: string) {
    // Clear previous viewer
    if (this.viewer) {
      try {
        this.viewer.dispose();
      } catch {
        // ignore disposal errors
      }
      this.container.innerHTML = "";
    }

    this.viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, -1, 0],
      initialCameraPosition: [0, -2, 6],
      initialCameraLookAt: [0, 0, 0],
      rootElement: this.container,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      crossOriginIsolation: false,
    });

    await this.viewer.addSplatScene(url, {
      showLoadingUI: false,
      progressiveLoad: true,
    });

    this.viewer.start();

    // Add click handler for segment selection
    this.container.addEventListener("click", this.handleClick);
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
      this.threeScene.add(helper);
      this.segmentBoxes.set(seg.segment_id, helper);

      // Add to viewer's three scene if accessible
      if (this.viewer?.threeScene) {
        this.viewer.threeScene.add(helper);
      }
    }
  }

  highlightSegment(segmentId: number) {
    for (const [id, box] of this.segmentBoxes) {
      const mat = (box as any).material as THREE.LineBasicMaterial;
      if (id === segmentId) {
        mat.color.set(0xffff00);
        mat.linewidth = 2;
      } else {
        mat.color.set(0x888888);
        mat.linewidth = 1;
      }
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

  private handleClick = (event: MouseEvent) => {
    if (!this.viewer?.camera || !this.onSegmentClick) return;

    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.viewer.camera);

    // Check intersection with bounding boxes
    const boxes = Array.from(this.segmentBoxes.values());
    for (const box of boxes) {
      const b3 = (box as any).box as THREE.Box3;
      if (this.raycaster.ray.intersectsBox(b3)) {
        this.onSegmentClick(box.userData.segmentId);
        this.highlightSegment(box.userData.segmentId);
        return;
      }
    }
  };

  dispose() {
    this.container.removeEventListener("click", this.handleClick);
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
