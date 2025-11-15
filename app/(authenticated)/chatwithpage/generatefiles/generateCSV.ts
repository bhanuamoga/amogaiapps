"use client";

export function generateCSV({ table, fileName }: any) {
  if (!table) return;

  const headers = table.columns.map((c: any) => c.header).join(",");
  const rows = table.rows
    .map((row: any) => table.columns.map((c: any) => row[c.key]).join(","))
    .join("\n");

  const csv = headers + "\n" + rows;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
}
