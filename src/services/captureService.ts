import * as THREE from 'three';

export interface CaptureOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number; // 0-1 for jpeg/webp
}

export interface RecordingOptions {
  duration?: number; // Total duration in ms
  fps?: number;
  format?: 'webm' | 'gif-frames'; // webm uses MediaRecorder, gif-frames captures PNG frames
}

export interface CaptureService {
  captureScreenshot: (options?: CaptureOptions) => Promise<string>;
  captureFrames: (options?: RecordingOptions) => Promise<string[]>;
  recordWebM: (options?: RecordingOptions) => Promise<Blob>;
  downloadScreenshot: (filename: string, options?: CaptureOptions) => Promise<void>;
  downloadWebM: (filename: string, options?: RecordingOptions) => Promise<void>;
  isRecording: () => boolean;
  stopRecording: () => void;
}

/**
 * Creates a capture service for taking screenshots and recording videos
 * from the Three.js renderer
 */
export function createCaptureService(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): CaptureService {
  let recording = false;
  let stopRequested = false;

  /**
   * Capture a single frame as a data URL
   */
  async function captureScreenshot(options: CaptureOptions = {}): Promise<string> {
    const {
      width,
      height,
      format = 'png',
      quality = 0.92,
    } = options;

    // If custom size requested, we need to render to a separate render target
    if (width && height) {
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      });

      // Render to the target
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Read pixels from render target
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

      // Create canvas and draw flipped (WebGL y is inverted)
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(width, height);

      // Flip vertically while copying
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = ((height - y - 1) * width + x) * 4;
          const dstIdx = (y * width + x) * 4;
          imageData.data[dstIdx] = pixels[srcIdx];
          imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
          imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
          imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
        }
      }

      ctx.putImageData(imageData, 0, 0);
      renderTarget.dispose();

      const mimeType = `image/${format}`;
      return canvas.toDataURL(mimeType, quality);
    }

    // Use the existing canvas directly
    renderer.render(scene, camera);
    const mimeType = `image/${format}`;
    return renderer.domElement.toDataURL(mimeType, quality);
  }

  /**
   * Capture multiple frames as data URLs (for external GIF encoding)
   */
  async function captureFrames(options: RecordingOptions = {}): Promise<string[]> {
    const {
      duration = 2000,
      fps = 10,
    } = options;

    const frameCount = Math.floor((duration / 1000) * fps);
    const frameDelay = 1000 / fps;
    const frames: string[] = [];

    recording = true;
    stopRequested = false;

    for (let i = 0; i < frameCount && !stopRequested; i++) {
      // Render and capture current frame
      renderer.render(scene, camera);
      frames.push(renderer.domElement.toDataURL('image/png'));

      // Wait for next frame
      if (i < frameCount - 1) {
        await new Promise(resolve => setTimeout(resolve, frameDelay));
      }
    }

    recording = false;
    return frames;
  }

  /**
   * Record a WebM video using MediaRecorder
   */
  async function recordWebM(options: RecordingOptions = {}): Promise<Blob> {
    const {
      duration = 3000,
      fps = 30,
    } = options;

    const canvas = renderer.domElement;
    const stream = canvas.captureStream(fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000,
    });

    const chunks: Blob[] = [];
    recording = true;
    stopRequested = false;

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        recording = false;
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.onerror = (e) => {
        recording = false;
        reject(e);
      };

      mediaRecorder.start();

      // Stop after duration or when stopRecording is called
      const checkStop = () => {
        if (stopRequested) {
          mediaRecorder.stop();
        }
      };

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);

      // Check periodically for stop request
      const interval = setInterval(() => {
        if (stopRequested || mediaRecorder.state !== 'recording') {
          clearInterval(interval);
          checkStop();
        }
      }, 100);
    });
  }

  /**
   * Download a screenshot
   */
  async function downloadScreenshot(
    filename: string,
    options: CaptureOptions = {}
  ): Promise<void> {
    const dataUrl = await captureScreenshot(options);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  /**
   * Download a WebM video
   */
  async function downloadWebM(
    filename: string,
    options: RecordingOptions = {}
  ): Promise<void> {
    const blob = await recordWebM(options);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function isRecording(): boolean {
    return recording;
  }

  function stopRecording(): void {
    stopRequested = true;
  }

  return {
    captureScreenshot,
    captureFrames,
    recordWebM,
    downloadScreenshot,
    downloadWebM,
    isRecording,
    stopRecording,
  };
}

/**
 * Simple screenshot capture without GIF support
 * Use this when you don't need GIF functionality to avoid the gif.js dependency
 */
export function captureRendererScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: CaptureOptions = {}
): string {
  const { format = 'png', quality = 0.92 } = options;
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL(`image/${format}`, quality);
}

/**
 * Download screenshot directly from renderer
 */
export function downloadRendererScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  filename: string,
  options: CaptureOptions = {}
): void {
  const dataUrl = captureRendererScreenshot(renderer, scene, camera, options);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
