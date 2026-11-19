import type { Pose } from './motion';
import { inferenceSize, cameraPoses } from './frame';

export type VisionSettings = { dimension: number; hz: number };
export type Observation = { poses: Pose[]; time: number; ms: number; width: number; height: number };

export class Vision {
  private detector: import('@tensorflow-models/pose-detection').PoseDetector | null = null;
  private running = false;
  private paused = false;
  private generation = 0;
  private unpark: (() => void) | null = null;
  private loop: Promise<void> | null = null;
  private snapshot = document.createElement('canvas');
  private ctx = this.snapshot.getContext('2d')!;
  private lastVideoTime = -1;
  private lastInference = -Infinity;
  private raf = 0;
  private wake: (() => void) | null = null;
  settings: VisionSettings = { dimension: 256, hz: 30 };
  backend = '';

  async load(onProgress: (text: string) => void) {
    onProgress('正在加载识别引擎…');
    const [tf, detection] = await Promise.all([
      import('@tensorflow/tfjs-core'), import('@tensorflow-models/pose-detection'),
      import('@tensorflow/tfjs-backend-webgl'),
    ]);
    if (!(await tf.setBackend('webgl'))) throw new Error('WebGL 不可用，请开启 Chrome 图形加速并重启浏览器。');
    await tf.ready(); this.backend = tf.getBackend();
    onProgress('正在加载本地 MoveNet 模型…');
    this.detector = await detection.createDetector(detection.SupportedModels.MoveNet, {
      modelType: detection.movenet.modelType.MULTIPOSE_LIGHTNING,
      enableTracking: true,
      enableSmoothing: true,
      trackerType: detection.TrackerType.BoundingBox,
      multiPoseMaxDimension: this.settings.dimension,
      modelUrl: `${import.meta.env.BASE_URL}models/movenet/model.json`,
    });
  }

  start(video: HTMLVideoElement, onFrame: (frame: Observation) => void, onError: (error: unknown) => void) {
    this.running = true;
    this.lastVideoTime = -1; this.lastInference = -Infinity;
    this.loop = (async () => {
      while (this.running) {
        if (this.paused) {
          await new Promise<void>(resolve => { this.unpark = resolve; });
          this.unpark = null;
          continue;
        }
        await new Promise<void>(resolve => {
          this.wake = resolve;
          this.raf = requestAnimationFrame(() => { this.wake = null; resolve(); });
        });
        if (!this.running) break;
        if (this.paused) continue;
        if (document.hidden || video.readyState < 2 || video.currentTime === this.lastVideoTime) continue;
        const time = performance.now();
        if (time - this.lastInference < 1000 / this.settings.hz) continue;
        this.lastInference = time; this.lastVideoTime = video.currentTime;
        const generation = this.generation;
        try {
          const width = video.videoWidth, height = video.videoHeight;
          if (!width || !height) continue;
          const size = inferenceSize(width, height, this.settings.dimension);
          if (this.snapshot.width !== size.width || this.snapshot.height !== size.height) {
            this.snapshot.width = size.width; this.snapshot.height = size.height;
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
          }
          // Snapshot before awaiting GPU inference so coordinates refer to one known frame.
          this.ctx.drawImage(video, 0, 0, size.width, size.height);
          const poses = await this.detector!.estimatePoses(this.snapshot, {}, time);
          if (this.running && !this.paused && generation === this.generation) {
            onFrame({ poses: cameraPoses(poses, width / size.width, height / size.height),
              time, ms: performance.now() - time, width, height });
          }
        } catch (error) {
          this.running = false; onError(error);
        }
      }
    })();
  }

  pause() {
    this.paused = true; this.generation++;
  }

  resume() {
    if (!this.running || !this.paused) return;
    // MoveNet MultiPose 2.1.3 reset() touches SinglePose-only filters. Game
    // bindings and blades are cleared by replay(); model tracks expire by timestamp.
    this.paused = false;
    this.lastVideoTime = -1; this.lastInference = -Infinity;
    this.unpark?.(); this.unpark = null;
  }

  async stop() {
    this.running = false; this.generation++;
    this.unpark?.(); this.unpark = null;
    cancelAnimationFrame(this.raf);
    this.wake?.(); this.wake = null;
    await this.loop;
    this.loop = null;
    this.detector?.dispose(); this.detector = null;
  }
}
