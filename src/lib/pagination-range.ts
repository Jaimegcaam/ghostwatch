export type PaginationItem = number | "ellipsis";

/** 0-based page indices with ellipsis gaps for compact pagination UI. */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 1) return [0];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const pages = new Set<number>([0, totalPages - 1]);
  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
    if (i >= 0 && i < totalPages) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}
