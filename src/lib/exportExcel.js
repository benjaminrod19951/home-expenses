import * as XLSX from "xlsx";
import { toExportRows } from "./reports.js";

// Downloads the given transactions as an Excel file (right-to-left sheet, Hebrew headers).
export function exportRowsToExcel(rows, fileName) {
    const data = toExportRows(rows);
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [12, 32, 18, 11, 13, 9, 8, 30].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "הוצאות");
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, fileName);
}
