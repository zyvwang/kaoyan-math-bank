import { lazy, Suspense, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { moduleLabels } from "../constants.js";
import type { ModuleKind, QuestionItem } from "../../shared/types.js";
import { LatexPreview } from "./LatexPreview.js";

const LatexEditor = lazy(() => import("./LatexEditor.js"));

interface ModuleEditorProps {
  kind: ModuleKind;
  value: string;
  item: QuestionItem;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}

export function ModuleEditor({ kind, value, item, onChange, onUpload }: ModuleEditorProps) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <article className="modulePanel">
      <header>
        <h2>{moduleLabels[kind]}</h2>
        <button className="iconButton" onClick={() => fileInput.current?.click()} title="插入图片">
          <ImagePlus size={17} />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        {isUploading && <span className="miniStatus">上传中</span>}
      </header>
      <div className="moduleGrid">
        <Suspense fallback={<div className="editorPane editorFallback">编辑器加载中</div>}>
          <LatexEditor value={value} onChange={onChange} />
        </Suspense>
        <LatexPreview tex={value} assets={item.assets} />
      </div>
    </article>
  );
}
