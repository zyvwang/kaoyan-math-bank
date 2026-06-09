import { FolderInput, FolderPlus } from "lucide-react";
import type { QuestionBankController } from "../hooks/useQuestionBankApp.js";

export function SetupScreen({ app }: { app: QuestionBankController }) {
  return (
    <main className="setupShell">
      <section className="setupPanel">
        <div className="setupCopy">
          <span>Kaoyan Math Bank</span>
          <h1>选择第一个题库工作区</h1>
          <p>工作区是一个普通文件夹，里面会保存 bank.json、图片、导出文件和临时编译文件。</p>
        </div>
        <div className="setupActions">
          <button className="primaryAction" onClick={() => void app.createSampleWorkspace()} disabled={app.isChangingWorkspace}>
            <FolderPlus size={18} />
            创建示例工作区
          </button>
          <button className="secondaryAction" onClick={() => void app.openWorkspace()} disabled={app.isChangingWorkspace}>
            <FolderInput size={18} />
            打开已有工作区
          </button>
        </div>
        {app.notice && <p className={`setupNotice ${app.notice.type}`}>{app.notice.text}</p>}
      </section>
    </main>
  );
}
