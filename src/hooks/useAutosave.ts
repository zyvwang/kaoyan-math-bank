import { useCallback, useEffect, useRef, useState } from "react";
import { saveBank } from "../api/client.js";
import type { Bank } from "../../shared/types.js";
import type { Notice, SaveState } from "./controllerTypes.js";

export function useAutosave(bank: Bank | null, setNotice: (notice: Notice | null) => void) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const skipNextSave = useRef(true);

  const persistBank = useCallback(async (nextBank: Bank) => {
    setSaveState("saving");
    await saveBank(nextBank);
    setSaveState("saved");
  }, []);

  useEffect(() => {
    if (!bank) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(() => {
      persistBank(bank).catch((error) => {
        setSaveState("error");
        setNotice({ type: "error", text: error instanceof Error ? error.message : "保存题库失败。" });
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [bank, persistBank, setNotice]);

  const skipNextAutosave = useCallback(() => {
    skipNextSave.current = true;
  }, []);

  return {
    saveState,
    persistBank,
    skipNextAutosave
  };
}
