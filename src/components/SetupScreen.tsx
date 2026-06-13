import { FolderInput, FolderPlus } from "lucide-react";
import { useLifecycle, useWorkspace } from "../context/questionBankContexts.js";
import controls from "../styles/controls.module.css";
import styles from "./SetupScreen.module.css";

export function SetupScreen() {
  const lifecycle = useLifecycle();
  const workspace = useWorkspace();
  return (
    <main className={styles.setupShell}>
      <section className={styles.setupPanel}>
        <div className={styles.setupCopy}>
          <span>考研数学一题库</span>
          <h1>选择第一个题库工作区</h1>
          <p>工作区是一个普通文件夹，保存 bank.json、图片、导出文件和临时编译文件。</p>
        </div>
        <div className={styles.setupActions}>
          <button className={controls.primaryAction} onClick={() => void workspace.createSampleWorkspace()} disabled={workspace.isChangingWorkspace}>
            <FolderPlus size={18} />创建示例工作区
          </button>
          <button className={controls.secondaryAction} onClick={() => void workspace.openWorkspace()} disabled={workspace.isChangingWorkspace}>
            <FolderInput size={18} />打开已有工作区
          </button>
        </div>
        {lifecycle.notice && <p className={`${styles.setupNotice} ${styles[lifecycle.notice.type]}`}>{lifecycle.notice.text}</p>}
      </section>
    </main>
  );
}
