import { useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { EditorView } from "@codemirror/view";
import { bindWheelScroller } from "../utils/wheel.js";

const latexExtension = StreamLanguage.define(stex);
const editorScrollPadding = EditorView.theme({
  ".cm-content": {
    paddingTop: "24px",
    paddingBottom: "72px"
  },
  ".cm-scroller": {
    overscrollBehavior: "contain"
  }
});

export default function LatexEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = editorPaneRef.current;
    if (!root) return undefined;
    return bindWheelScroller(root, () => root.querySelector<HTMLElement>(".cm-scroller"));
  }, []);

  return (
    <div className="editorPane" ref={editorPaneRef}>
      <CodeMirror
        value={value}
        height="100%"
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
        extensions={[latexExtension, EditorView.lineWrapping, editorScrollPadding]}
        onChange={onChange}
      />
    </div>
  );
}
