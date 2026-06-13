import { FolderOpen, RefreshCw, RotateCcw } from "lucide-react";
import { useLifecycle, useWorkspace } from "../context/questionBankContexts.js";
import controls from "../styles/controls.module.css";
import styles from "./SetupScreen.module.css";

export function RecoveryScreen() {
  const lifecycle = useLifecycle();
  const workspace = useWorkspace();
  const reportError = (error: unknown, fallback: string) =>
    lifecycle.setNotice({ type: "error", text: error instanceof Error ? error.message : fallback });
  return (
    <main className={styles.setupShell}>
      <section className={`${styles.setupPanel} ${styles.recoveryPanel}`}>
        <div className={styles.setupCopy}>
          <span>题库读取失败</span>
          <h1>磁盘数据没有被覆盖</h1>
          <p>{lifecycle.loadError}</p>
        </div>
        <div className={styles.setupActions}>
          <button className={controls.primaryAction} onClick={() => void lifecycle.retryInitialLoad().catch((error) => reportError(error, "重新读取失败。"))}>
            <RefreshCw size={18} />重试
          </button>
          <button className={controls.secondaryAction} onClick={workspace.openCurrentWorkspaceFolder}>
            <FolderOpen size={18} />打开工作区
          </button>
        </div>
        {lifecycle.recoveryCandidates.length > 0 && (
          <div className={styles.recoveryList}>
            <strong>可恢复版本</strong>
            {lifecycle.recoveryCandidates.map((candidate) => (
              <button
                key={candidate.id}
                className={controls.secondaryAction}
                onClick={() => void lifecycle.recoverFromCandidate(candidate.id).catch((error) => reportError(error, "恢复失败。"))}
              >
                <RotateCcw size={16} />{candidate.label}
              </button>
            ))}
          </div>
        )}
        {lifecycle.notice && <p className={`${styles.setupNotice} ${styles[lifecycle.notice.type]}`}>{lifecycle.notice.text}</p>}
      </section>
    </main>
  );
}
