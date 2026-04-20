/// <reference types="vite/client" />

declare module "@mkkellogg/gaussian-splats-3d" {
  export const SceneRevealMode: {
    Instant: number;
    Gradual: number;
  };

  export class Viewer {
    constructor(options: {
      cameraUp?: number[];
      initialCameraPosition?: number[];
      initialCameraLookAt?: number[];
      rootElement?: HTMLElement;
      sceneRevealMode?: number;
      crossOriginIsolation?: boolean;
    });
    addSplatScene(
      url: string,
      options?: {
        showLoadingUI?: boolean;
        progressiveLoad?: boolean;
      }
    ): Promise<void>;
    start(): void;
    dispose(): void;
    threeScene?: any;
    camera?: any;
  }
}
