/**
 * Self-contained DOM controls for AnnotationCameraController
 * No React dependencies - vanilla DOM manipulation
 */

export interface DOMControlsConfig {
  /** Container element to append controls to */
  container: HTMLElement;
  /** Callback when user selects an annotation */
  onAnnotationSelect: (name: string) => void;
  /** Initial list of annotation names */
  annotations: string[];
  /** Currently selected annotation */
  currentAnnotation?: string;
}

/**
 * CSS styles for the DOM controls
 * Scoped with unique class prefix to avoid conflicts
 */
const STYLES = `
.acc-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.acc-select {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  min-width: 120px;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 28px;
}

.acc-select:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.acc-select:focus {
  border-color: #3182ce;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.3);
}

.acc-select option {
  background: #1a202c;
  color: white;
  padding: 8px;
}

.acc-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  display: flex;
  align-items: center;
  margin-right: 4px;
}
`;

// Track if styles have been injected
let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-acc-styles', 'true');
  style.textContent = STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * Format annotation name for display
 * Converts snake_case to Title Case
 */
function formatName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * CameraDOMControls - Self-contained DOM UI for annotation selection
 */
export class CameraDOMControls {
  private container: HTMLElement;
  private wrapper: HTMLDivElement;
  private select: HTMLSelectElement;
  private onAnnotationSelect: (name: string) => void;

  constructor(config: DOMControlsConfig) {
    // Inject styles once
    injectStyles();

    this.container = config.container;
    this.onAnnotationSelect = config.onAnnotationSelect;

    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'acc-controls';

    // Create label
    const label = document.createElement('span');
    label.className = 'acc-label';
    label.textContent = 'View:';
    this.wrapper.appendChild(label);

    // Create select
    this.select = document.createElement('select');
    this.select.className = 'acc-select';
    this.populateSelect(config.annotations, config.currentAnnotation);

    // Handle selection changes
    this.select.addEventListener('change', () => {
      this.onAnnotationSelect(this.select.value);
    });

    this.wrapper.appendChild(this.select);

    // Append to container
    // Ensure container has relative positioning for absolute positioning to work
    const containerStyle = window.getComputedStyle(this.container);
    if (containerStyle.position === 'static') {
      this.container.style.position = 'relative';
    }

    this.container.appendChild(this.wrapper);
  }

  /**
   * Populate select options
   */
  private populateSelect(annotations: string[], current?: string): void {
    this.select.innerHTML = '';

    if (annotations.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No annotations';
      option.disabled = true;
      this.select.appendChild(option);
      return;
    }

    annotations.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = formatName(name);
      if (name === current) {
        option.selected = true;
      }
      this.select.appendChild(option);
    });
  }

  /**
   * Update available annotations
   */
  updateAnnotations(annotations: string[], current?: string): void {
    this.populateSelect(annotations, current);
  }

  /**
   * Set current annotation (updates select value)
   */
  setCurrentAnnotation(name: string): void {
    if (this.select.value !== name) {
      this.select.value = name;
    }
  }

  /**
   * Show/hide controls
   */
  setVisible(visible: boolean): void {
    this.wrapper.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Check if controls are visible
   */
  isVisible(): boolean {
    return this.wrapper.style.display !== 'none';
  }

  /**
   * Cleanup and remove from DOM
   */
  dispose(): void {
    this.wrapper.remove();
  }
}
