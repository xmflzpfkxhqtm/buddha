'use client';
import { useState } from 'react';

export function useListWithPagination<T>(items: T[], itemsPerPage = 5) {
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const paginated = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  function handlePageChange(page: number) {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }

  return { currentPage, setCurrentPage, totalPages, paginated, handlePageChange, deleteTargetId, setDeleteTargetId };
}
