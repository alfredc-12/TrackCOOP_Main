type Column<T> = {
  key: keyof T;
  label: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
};

export function DataTable<T extends Record<string, string | number>>({
  columns,
  data,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="bg-[#eef4e8] text-[#4a574f]">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="border-t border-black/10">
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3">
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
