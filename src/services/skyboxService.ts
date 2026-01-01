import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export type SkyboxPreset = {
  name: string;
  path: string;
  thumbnail?: string;
};

export const SKYBOX_PRESETS: SkyboxPreset[] = [
  { name: 'None', path: '', thumbnail: '' },
  { name: 'Studio', path: '/skyboxes/studio_small_08_1k.hdr', thumbnail: '/skyboxes/studio_small_08_1k.jpg' },
  { name: 'Beach', path: '/skyboxes/secluded_beach.hdr', thumbnail: '/skyboxes/sample_skybox.jpg' },
  { name: 'Urban', path: '/skyboxes/urban_alley_01_1k.hdr', thumbnail: '/skyboxes/studio_preview.jpg' },
];

export type SkyboxSettings = {
  enabled: boolean;
  preset: string;
  backgroundBlur: number;
  backgroundIntensity: number;
  environmentIntensity: number;
};

const DEFAULT_SETTINGS: SkyboxSettings = {
  enabled: false,
  preset: 'None',
  backgroundBlur: 0,
  backgroundIntensity: 1,
  environmentIntensity: 1,
};

/**
 * SkyboxService - Manages HDRI environment maps for scene background and lighting.
 *
 * Works seamlessly with AnnotationCameraController because HDRI environment maps
 * are rendered as scene backgrounds that automatically follow camera orientation.
 */
export class SkyboxService {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private loader: RGBELoader;
  private currentEnvMap: THREE.Texture | null = null;
  private originalBackground: THREE.Color | THREE.Texture | null = null;
  private settings: SkyboxSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<(settings: SkyboxSettings) => void> = new Set();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.loader = new RGBELoader();

    // Store original background for restoration
    this.originalBackground = scene.background;
  }

  getSettings(): SkyboxSettings {
    return { ...this.settings };
  }

  subscribe(listener: (settings: SkyboxSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const settings = this.getSettings();
    this.listeners.forEach(fn => fn(settings));
  }

  async loadPreset(presetName: string): Promise<void> {
    const preset = SKYBOX_PRESETS.find(p => p.name === presetName);
    if (!preset) {
      console.warn(`[SkyboxService] Unknown preset: ${presetName}`);
      return;
    }

    this.settings.preset = presetName;

    if (preset.path === '' || presetName === 'None') {
      // Disable skybox, restore original background
      this.disable();
      return;
    }

    try {
      const envMap = await this.loader.loadAsync(preset.path);
      envMap.mapping = THREE.EquirectangularReflectionMapping;

      // Dispose previous environment map
      if (this.currentEnvMap) {
        this.currentEnvMap.dispose();
      }

      this.currentEnvMap = envMap;
      this.settings.enabled = true;
      this.applySettings();
      this.notify();

      console.log(`[SkyboxService] Loaded preset: ${presetName}`);
    } catch (error) {
      console.error(`[SkyboxService] Failed to load preset ${presetName}:`, error);
    }
  }

  private applySettings() {
    if (!this.settings.enabled || !this.currentEnvMap) {
      return;
    }

    // Set environment map for reflections/lighting
    this.scene.environment = this.currentEnvMap;

    // Set as background
    this.scene.background = this.currentEnvMap;
    this.scene.backgroundBlurriness = this.settings.backgroundBlur;
    this.scene.backgroundIntensity = this.settings.backgroundIntensity;
  }

  setBackgroundBlur(value: number) {
    this.settings.backgroundBlur = Math.max(0, Math.min(1, value));
    if (this.settings.enabled) {
      this.scene.backgroundBlurriness = this.settings.backgroundBlur;
    }
    this.notify();
  }

  setBackgroundIntensity(value: number) {
    this.settings.backgroundIntensity = Math.max(0, Math.min(2, value));
    if (this.settings.enabled) {
      this.scene.backgroundIntensity = this.settings.backgroundIntensity;
    }
    this.notify();
  }

  setEnvironmentIntensity(value: number) {
    this.settings.environmentIntensity = Math.max(0, Math.min(2, value));
    // Note: environmentIntensity requires Three.js r165+
    // For now we track the setting but can't apply it directly
    this.notify();
  }

  disable() {
    this.settings.enabled = false;
    this.settings.preset = 'None';

    // Restore original background
    this.scene.background = this.originalBackground;
    this.scene.environment = null;
    this.scene.backgroundBlurriness = 0;

    this.notify();
    console.log('[SkyboxService] Skybox disabled');
  }

  enable() {
    if (this.currentEnvMap) {
      this.settings.enabled = true;
      this.applySettings();
      this.notify();
    }
  }

  toggle() {
    if (this.settings.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  dispose() {
    if (this.currentEnvMap) {
      this.currentEnvMap.dispose();
      this.currentEnvMap = null;
    }
    this.listeners.clear();

    // Restore original state
    this.scene.background = this.originalBackground;
    this.scene.environment = null;
  }
}
