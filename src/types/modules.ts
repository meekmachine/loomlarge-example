export interface ModuleSettings {
  [key: string]: any;
}

export interface Module {
  name: string;
  path: string;
  description: string;
  settings: ModuleSettings;
}

export interface ModulesConfig {
  modules: Module[];
}

export interface ModuleInstance {
  start: (
    animationManager: any,
    settings: ModuleSettings,
    containerRef: React.RefObject<HTMLDivElement>,
    toast: any
  ) => void;
  stop: (animationManager: any) => void;
}
