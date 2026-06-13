export function validateReorderTarget(value: string, itemCount: number): string | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return "请输入有效的整数题序。";
  const target = Number(trimmed);
  if (target < 1 || target > itemCount) return `题序需在 1 到 ${itemCount} 之间。`;
  return null;
}
