import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.js";
import type { AppInfo, Bank } from "../../shared/types.js";

vi.mock("../../src/components/LatexEditor.js", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="latex-editor" value={value} onChange={(event) => onChange(event.target.value)} />
  )
}));

const appInfo: AppInfo = {
  appState: {
    version: 1,
    currentWorkspacePath: "/tmp/math-bank",
    recentWorkspacePaths: ["/tmp/math-bank"]
  },
  currentWorkspaceName: "math-bank",
  currentWorkspacePath: "/tmp/math-bank",
  recentWorkspaces: [{ name: "math-bank", path: "/tmp/math-bank", exists: true }],
  texStatus: {
    available: true,
    command: "latexmk",
    source: "path",
    message: "已检测到 LaTeX：latexmk"
  },
  isDesktop: false,
  setupRequired: false
};

const bank: Bank = {
  version: 1,
  settings: {
    pageSize: "a4",
    spacing: { item: "1.0em", module: "0.45em" },
    preamble: "% test"
  },
  items: [
    {
      id: "limit",
      order: 1,
      sourceNumber: "2024-1",
      chapter: "高等数学/极限",
      tags: ["极限"],
      star: 3,
      questionTex: "求极限 $x$。",
      solutionTex: "答案。",
      noteTex: "备注。",
      assets: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "matrix",
      order: 2,
      sourceNumber: "2024-2",
      chapter: "线性代数/矩阵",
      tags: ["矩阵"],
      star: 4,
      questionTex: "求矩阵秩。",
      solutionTex: "答案。",
      noteTex: "",
      assets: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ]
};

beforeEach(() => {
  vi.useRealTimers();
  vi.stubGlobal("fetch", vi.fn(handleFetch));
});

describe("App UI", () => {
  it("loads the workspace and filters items", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("考研数学一题库")).toBeInTheDocument();
    expect(await screen.findByText("2024-1")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("搜索"), "矩阵");
    expect(screen.queryByText("2024-1")).not.toBeInTheDocument();
    expect(screen.getByText("2024-2")).toBeInTheDocument();
  });

  it("autosaves metadata edits", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("2024-1");

    const sourceInput = screen.getByDisplayValue("2024-1");
    await user.clear(sourceInput);
    await user.type(sourceInput, "2026-1");
    await new Promise((resolve) => window.setTimeout(resolve, 650));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/bank",
        expect.objectContaining({
          method: "PUT"
        })
      );
    });
  });

  it("uploads an image into the active module", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText("2024-1");

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input!, new File(["image"], "figure.png", { type: "image/png" }));

    expect(await screen.findByText("图片已插入当前模块。")).toBeInTheDocument();
  });

  it("exports the selected items", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("2024-1");

    await user.click(screen.getByRole("button", { name: /导出 2 题/ }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/export",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
    expect(await screen.findByText(/导出完成/)).toBeInTheDocument();
  });
});

async function handleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === "/api/app") return json(appInfo);
  if (url === "/api/bank" && !init) return json(bank);
  if (url === "/api/bank" && init?.method === "PUT") return json(bank);
  if (url === "/api/assets") {
    return json({
      asset: {
        id: "asset-1",
        fileName: "asset.png",
        originalName: "figure.png",
        relativePath: "assets/asset.png",
        mimeType: "image/png",
        size: 5,
        uploadedAt: "2026-01-01T00:00:00.000Z"
      },
      url: "/assets/asset.png",
      insertText: "\\includegraphics{assets/asset.png}"
    });
  }
  if (url === "/api/export") {
    return json({
      ok: true,
      exportName: "math-test",
      exportPath: "/tmp/math-bank/exports/math-test",
      exportUrl: "/exports/math-test/",
      files: ["questions.tex", "questions.pdf", "full.tex", "full.pdf"],
      results: {
        questions: { ok: true, texPath: "questions.tex", pdfPath: "questions.pdf", log: "" },
        full: { ok: true, texPath: "full.tex", pdfPath: "full.pdf", log: "" }
      }
    });
  }
  return json({ error: `Unhandled ${url}` }, 404);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
