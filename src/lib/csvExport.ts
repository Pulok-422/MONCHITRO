function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const s = typeof value === 'string' && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T extends object>(
  rows: T[],
  columns: { key: string; header?: string }[]
): string {
  const header = columns.map((c) => escapeCsvField(c.header ?? c.key)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escapeCsvField(getValue(r, c.key))).join(','))
    .join('\n');
  return header + '\n' + body;
}

function getValue(obj: object, key: string): unknown {
  if (key in obj) return (obj as Record<string, unknown>)[key];
  // allow bracket notation keys like 'Poverty Index'
  return (obj as Record<string, unknown>)[key];
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
