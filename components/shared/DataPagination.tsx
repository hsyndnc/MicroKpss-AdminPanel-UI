"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface DataPaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// Ellipsis'li pencereleme: totalPages <= 7 → hepsi; aksi halde {1, page-1, page, page+1, totalPages}.
// Ardışık olmayan iki numara arasına "ellipsis" konur.
function buildPages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const nums = new Set<number>([1, totalPages]);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) nums.add(p);
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("ellipsis");
    out.push(n);
    prev = n;
  }
  return out;
}

export function DataPagination({ page, totalCount, pageSize, onPageChange }: DataPaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(page, 1), totalPages);
  const pages = buildPages(current, totalPages);
  const disabledCls = "pointer-events-none opacity-50";

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="Önceki"
            aria-disabled={current <= 1}
            className={current <= 1 ? disabledCls : "cursor-pointer"}
            onClick={() => current > 1 && onPageChange(current - 1)}
          />
        </PaginationItem>

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`e${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === current}
                className="cursor-pointer"
                onClick={() => onPageChange(p)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            text="Sonraki"
            aria-disabled={current >= totalPages}
            className={current >= totalPages ? disabledCls : "cursor-pointer"}
            onClick={() => current < totalPages && onPageChange(current + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
