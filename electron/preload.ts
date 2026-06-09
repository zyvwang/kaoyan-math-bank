import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("kmb", {
  platform: process.platform,
  selectWorkspaceDirectory: (title?: string) =>
    ipcRenderer.invoke("workspace:select-directory", title) as Promise<string | null>,
  openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath) as Promise<string>,
  trashPath: (targetPath: string) => ipcRenderer.invoke("shell:trash-path", targetPath) as Promise<boolean>
});
