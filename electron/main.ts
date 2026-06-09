import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let apiServer: Server | null = null;

async function createWindow() {
  process.env.KMB_DESKTOP = "1";
  process.env.KMB_APP_DATA_DIR = app.getPath("userData");
  process.env.KMB_ROOT_DIR = app.getAppPath();

  const isDev = Boolean(process.env.KMB_DEV_SERVER_URL);
  const { startApiServer } = await import("../server/index.js");
  const api = await startApiServer({ port: isDev ? 5174 : 0 });
  apiServer = api.server;

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 720,
    title: "Kaoyan Math Bank",
    backgroundColor: "#f7f5ef",
    webPreferences: {
      preload: path.join(currentDir, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await mainWindow.loadURL(process.env.KMB_DEV_SERVER_URL || api.url);
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  apiServer?.close();
});

function registerIpcHandlers() {
  ipcMain.handle("workspace:select-directory", async (_event, title?: string) => {
    const options: Electron.OpenDialogOptions = {
      title: title || "选择题库工作区",
      properties: ["openDirectory", "createDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle("shell:open-path", async (_event, targetPath: string) => {
    return shell.openPath(targetPath);
  });

  ipcMain.handle("shell:trash-path", async (_event, targetPath: string) => {
    await shell.trashItem(targetPath);
    return true;
  });
}
