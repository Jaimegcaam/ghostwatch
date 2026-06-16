export const UNCATEGORIZED_FOLDER = "__uncategorized__";

export function normalizeFolder(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function folderDisplayName(folderKey: string): string {
  return folderKey === UNCATEGORIZED_FOLDER ? "Uncategorized" : folderKey;
}

export function folderKeyFromCheck(folder: string | null | undefined): string {
  return normalizeFolder(folder) ?? UNCATEGORIZED_FOLDER;
}

export function groupChecksByFolder<T extends { folder?: string | null; sortOrder?: number; name: string }>(
  checks: T[],
): { key: string; label: string; checks: T[] }[] {
  const map = new Map<string, T[]>();

  for (const check of checks) {
    const key = folderKeyFromCheck(check.folder);
    const list = map.get(key) ?? [];
    list.push(check);
    map.set(key, list);
  }

  const groups = [...map.entries()].map(([key, items]) => ({
    key,
    label: folderDisplayName(key),
    checks: [...items].sort((a, b) => {
      const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    }),
  }));

  groups.sort((a, b) => {
    if (a.key === UNCATEGORIZED_FOLDER) return 1;
    if (b.key === UNCATEGORIZED_FOLDER) return -1;
    return a.label.localeCompare(b.label);
  });

  return groups;
}
