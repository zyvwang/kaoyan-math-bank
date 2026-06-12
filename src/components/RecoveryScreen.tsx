import { FolderOpen, RefreshCw, RotateCcw } from "lucide-react";
import type { QuestionBankController } from "../hooks/useQuestionBankApp.js";

export function RecoveryScreen({ app }: { app: QuestionBankController }) {
  return (
    <main className="setupShell">
      <section className="setupPanel recoveryPanel">
        <div className="setupCopy">
          <span>题库读取失败</span>
          <h1>磁盘数据没有被覆盖</h1>
          <p>{app.loadError}</p>
        </div>
        <div className="setupActions">
          <button
            className="primaryAction"
            onClick={() => {
              void app.retryInitialLoad().catch((error) =>
                app.setNotice({
                  type: "error",
                  text: error instanceof Error ? error.message : "重新读取失败。"
                })
              );
            }}
          >
            <RefreshCw size={18} />
            重试
          </button>
          <button className="secondaryAction" onClick={app.openCurrentWorkspaceFolder}>
            <FolderOpen size={18} />
            打开工作区
          </button>
        </div>
        {app.recoveryCandidates.length > 0 && (
          <div className="recoveryList">
            <strong>可恢复版本</strong>
            {app.recoveryCandidates.map((candidate) => (
              <button
                key={candidate.id}
                className="secondaryAction"
                onClick={() => {
                  void app.recoverFromCandidate(candidate.id).catch((error) =>
                    app.setNotice({
                      type: "error",
                      text: error instanceof Error ? error.message : "恢复失败。"
                    })
                  );
                }}
              >
                <RotateCcw size={16} />
                {candidate.label}
              </button>
            ))}
          </div>
        )}
        {app.notice && <p className={`setupNotice ${app.notice.type}`}>{app.notice.text}</p>}
      </section>
    </main>
  );
}
