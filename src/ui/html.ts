export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

export function formatDateRange(dateFrom: string, dateTo: string): string {
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `Through ${dateTo}`;
  return "All dates";
}
