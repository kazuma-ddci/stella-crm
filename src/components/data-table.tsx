import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Column = {
  key: string;
  header: string;
};

type DataTableProps = {
  data: Record<string, unknown>[];
  columns: Column[];
  emptyMessage?: string;
};

function getValue(item: Record<string, unknown>, key: string): unknown {
  const keys = key.split(".");
  let value: unknown = item;
  for (const k of keys) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    ...dateOptions,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  if (value instanceof Date) {
    return value.toLocaleDateString("ja-JP", dateOptions);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      if (value.includes("T")) {
        return date.toLocaleString("ja-JP", dateTimeOptions);
      }
      return date.toLocaleDateString("ja-JP", dateOptions);
    }
  }
  if (typeof value === "boolean") {
    return value ? "有効" : "無効";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function DataTable({
  data,
  columns,
  emptyMessage = "データがありません",
}: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className="whitespace-nowrap">
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, index) => (
              <TableRow key={(item.id as string | number) || index}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className="whitespace-nowrap max-w-xs truncate"
                    title={String(getValue(item, column.key) ?? "")}
                  >
                    {formatValue(getValue(item, column.key))}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
