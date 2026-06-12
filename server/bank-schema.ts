import type {
  Bank,
  LatexSettings,
  ModuleKind,
  QuestionAsset,
  QuestionItem,
  StarRating
} from "../shared/types.js";

export const defaultStarRating: StarRating = 5;

export const defaultSettings: LatexSettings = {
  pageSize: "a4",
  spacing: {
    item: "1.0em",
    module: "0.45em"
  },
  preamble: `% 可在这里添加全局宏命令，例如：
% \\newcommand{\\R}{\\mathbb{R}}`
};

export const moduleKinds: ModuleKind[] = ["question", "solution", "note"];

export function createEmptyBank(): Bank {
  return {
    version: 2,
    settings: defaultSettings,
    items: []
  };
}

export function createSampleBank(): Bank {
  const now = "2026-01-01T00:00:00.000Z";
  const items: QuestionItem[] = [
    {
      id: "sample-limit",
      order: 1,
      sourceNumber: "自造示例 1",
      chapter: "高等数学/极限",
      tags: ["极限", "等价无穷小"],
      star: 3,
      modules: {
        question: { tex: "求极限 $\\displaystyle \\lim_{x\\to 0}\\frac{\\sin x-x}{x^3}$。" },
        solution: {
          tex:
            "由泰勒公式 $\\sin x=x-\\dfrac{x^3}{6}+o(x^3)$，得\n\\[\n\\lim_{x\\to 0}\\frac{\\sin x-x}{x^3}=-\\frac16.\n\\]"
        },
        note: { tex: "这是一个用于演示实时公式预览和导出编译的自造例题。" }
      },
      assets: [],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "sample-linear-algebra",
      order: 2,
      sourceNumber: "自造示例 2",
      chapter: "线性代数/矩阵",
      tags: ["矩阵", "行列式"],
      star: 2,
      modules: {
        question: {
          tex: "设 $A=\\begin{pmatrix}1&2\\\\0&3\\end{pmatrix}$，求 $\\det A$ 与 $A$ 的特征值。"
        },
        solution: {
          tex:
            "因为 $A$ 是上三角矩阵，所以\n\\[\n\\det A=1\\cdot 3=3,\n\\]\n特征值为主对角线元素 $1,3$。"
        },
        note: { tex: "上三角矩阵的行列式和特征值都可以直接从主对角线读取。" }
      },
      assets: [],
      createdAt: now,
      updatedAt: now
    }
  ];

  return {
    version: 2,
    settings: defaultSettings,
    items
  };
}

export function normalizeBank(input: unknown): Bank {
  const candidate = isRecord(input) ? input : {};
  const settings = normalizeSettings(candidate.settings);
  const items = Array.isArray(candidate.items) ? candidate.items.map(normalizeItem) : [];
  return {
    version: 2,
    settings,
    items: items
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index + 1 }))
  };
}

function normalizeSettings(input: unknown): LatexSettings {
  const candidate = input as Partial<LatexSettings>;
  return {
    pageSize: "a4",
    spacing: {
      item: safeString(candidate?.spacing?.item, defaultSettings.spacing.item),
      module: safeString(candidate?.spacing?.module, defaultSettings.spacing.module)
    },
    preamble: safeString(candidate?.preamble, defaultSettings.preamble)
  };
}

function normalizeItem(input: unknown, index: number): QuestionItem {
  const candidate = isRecord(input) ? input : {};
  const now = new Date().toISOString();
  return {
    id: safeString(candidate.id, crypto.randomUUID()),
    order: Number.isFinite(candidate.order) ? Number(candidate.order) : index + 1,
    sourceNumber: safeOptionalString(candidate.sourceNumber),
    chapter: safeString(candidate.chapter, ""),
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.map((tag) => safeString(tag, "")).filter(Boolean)
      : [],
    star: safeStarRating(candidate.star),
    modules: normalizeModules(candidate),
    assets: Array.isArray(candidate.assets)
      ? candidate.assets.map((asset) => normalizeAsset(asset, now))
      : [],
    createdAt: safeString(candidate.createdAt, now),
    updatedAt: safeString(candidate.updatedAt, now)
  };
}

function normalizeModules(candidate: Record<string, unknown>): QuestionItem["modules"] {
  const modules = isRecord(candidate.modules) ? candidate.modules : {};
  return {
    question: { tex: normalizeModuleTex(modules.question, candidate.questionTex) },
    solution: { tex: normalizeModuleTex(modules.solution, candidate.solutionTex) },
    note: { tex: normalizeModuleTex(modules.note, candidate.noteTex) }
  };
}

function normalizeModuleTex(moduleValue: unknown, legacyTex: unknown): string {
  if (isRecord(moduleValue)) return safeString(moduleValue.tex, "");
  return safeString(legacyTex, "");
}

function normalizeAsset(input: unknown, now: string): QuestionAsset {
  const asset = isRecord(input) ? input : {};
  return {
    id: safeString(asset.id, crypto.randomUUID()),
    fileName: safeString(asset.fileName, ""),
    originalName: safeString(asset.originalName, ""),
    relativePath: safeString(asset.relativePath, ""),
    mimeType: safeString(asset.mimeType, ""),
    size: Number.isFinite(asset.size) ? Number(asset.size) : 0,
    uploadedAt: safeString(asset.uploadedAt, now)
  };
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function safeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeStarRating(value: unknown): StarRating {
  const rating = Number(value);
  return rating >= 1 && rating <= 5 && Number.isInteger(rating)
    ? (rating as StarRating)
    : defaultStarRating;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
