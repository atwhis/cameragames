import type { Pose } from './motion';

export function inferenceSize(width: number, height: number, dimension: number) {
  const scale = Math.min(1, dimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Keep downstream tracking, mirroring and collision mapping in original camera coordinates.
export function cameraPoses(poses: Pose[], scaleX: number, scaleY: number): Pose[] {
  return poses.map(pose => ({ ...pose, keypoints: pose.keypoints.map(p => ({ ...p, x: p.x * scaleX, y: p.y * scaleY })) }));
}
