interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}

export const Pagination = ({ page, totalPages, total, onPage }: Props) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>{total} registros</span>
      <div className="flex gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">
          &lsaquo;
        </button>
        <span className="px-3 py-1">
          {page} / {totalPages}
        </span>
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">
          &rsaquo;
        </button>
      </div>
    </div>
  );
};
