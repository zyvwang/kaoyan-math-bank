export {};

declare global {
  interface Window {
    kmb?: {
      platform: string;
      selectWorkspaceDirectory: (title?: string) => Promise<string | null>;
      openPath: (targetPath: string) => Promise<string>;
      trashPath: (targetPath: string) => Promise<boolean>;
    };
    MathJax?: {
      tex?: unknown;
      options?: unknown;
      startup?: { promise?: Promise<void> };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}
