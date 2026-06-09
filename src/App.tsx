import { LoadingScreen } from "./components/LoadingScreen.js";
import { Overlays } from "./components/Overlays.js";
import { SetupScreen } from "./components/SetupScreen.js";
import { Sidebar } from "./components/Sidebar.js";
import { WorkspaceView } from "./components/WorkspaceView.js";
import { useQuestionBankApp } from "./hooks/useQuestionBankApp.js";

function App() {
  const app = useQuestionBankApp();

  if (!app.bank || !app.appInfo) {
    return <LoadingScreen />;
  }

  if (app.appInfo.setupRequired) {
    return <SetupScreen app={app} />;
  }

  return (
    <main className="appShell">
      <Sidebar app={app} />
      <WorkspaceView app={app} />
      <Overlays app={app} />
    </main>
  );
}

export default App;
