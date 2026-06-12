export {};

declare global {
  interface Window {
    kmb?: {
      platform: string;
      selectWorkspaceDirectory: (title?: string) => Promise<string | null>;
      openPath: (targetPath: string) => Promise<string>;
      trashPath: (targetPath: string) => Promise<boolean>;
      openExternal: (targetUrl: string) => Promise<boolean>;
      onBeforeClose: (listener: () => Promise<void>) => () => void;
    };
    MathJax?: {
      loader?: { paths?: Record<string, string> };
      tex?: unknown;
      options?: unknown;
      startup?: { promise?: Promise<void> };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}
