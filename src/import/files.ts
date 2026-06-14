export type ImportFileKind = "csv" | "xlsx";

export interface ImportFileLike {
  name: string;
  type?: string;
}

export function classifyImportFile(file: ImportFileLike): ImportFileKind {
  const name = file.name.toLowerCase();
  const type = (file.type ?? "").toLowerCase();

  if (name.endsWith(".xlsx") || type.includes("spreadsheetml")) return "xlsx";
  if (name.endsWith(".xls") || type === "application/vnd.ms-excel") {
    throw new Error("Legacy .xls workbooks are not supported yet. Save the file as .xlsx or CSV and try again.");
  }

  return "csv";
}
