"use client";
import * as XLSX from "xlsx/xlsx.mjs";

XLSX.set_fs(null); // ⭐ REQUIRED for browser mode

export function generateExcel({ table, fileName }: any) {
  const ws = XLSX.utils.json_to_sheet(table.rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
