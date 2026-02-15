export function parseJsonOutput<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON output: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function parseTableOutput(output: string): Array<Record<string, string>> {
  const lines = output.trim().split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return [];
  }

  // Find separator line (contains dashes and pipes)
  const separatorIndex = lines.findIndex(line =>
    line.includes('|') && /[-]+/.test(line)
  );

  if (separatorIndex === -1) {
    // No separator found, try to use first line as header if it has pipes
    return parseTableWithoutSeparator(lines);
  }

  const headerLine = lines[separatorIndex - 1];
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);

  const result: Array<Record<string, string>> = [];

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    // Stop if we hit another separator or empty line
    if (line.includes('|') && /[-]+/.test(line) && !line.includes('a')) {
      break;
    }
    if (!line.trim()) break;

    const values = line.split('|').map(v => v.trim()).filter(v => v);

    if (values.length > 0) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      result.push(row);
    }
  }

  return result;
}

function parseTableWithoutSeparator(lines: string[]): Array<Record<string, string>> {
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  if (!firstLine.includes('|')) {
    return [];
  }

  const headers = firstLine.split('|').map(h => h.trim()).filter(h => h);
  const result: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) break;

    const values = line.split('|').map(v => v.trim()).filter(v => v);

    if (values.length > 0) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      result.push(row);
    }
  }

  return result;
}

export function parsePsqlOutput(output: string): { columns: string[]; rows: string[][] } {
  const lines = output.split('\n');

  // Find all separator lines (+-----+-----+)
  const separatorIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\+[-+]+\+$/.test(lines[i].trim())) {
      separatorIndices.push(i);
    }
  }

  if (separatorIndices.length < 2) {
    return { columns: [], rows: [] };
  }

  // First separator is at separatorIndices[0]
  // Header should be after first separator and before second separator
  // In psql format: separator, header, separator, data, separator

  // Actually, psql format is: separator, header, separator, data, separator
  // So header is at separatorIndices[0] + 1
  const headerIndex = separatorIndices[0] + 1;

  if (headerIndex >= lines.length) {
    return { columns: [], rows: [] };
  }

  const headerLine = lines[headerIndex];
  const columns = headerLine
    .split('|')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const rows: string[][] = [];

  // Data starts after second separator (separatorIndices[1] + 1)
  for (let i = separatorIndices[1] + 1; i < lines.length; i++) {
    const line = lines[i];

    // Stop at next separator or empty line
    if (/^\+[-+]+\+$/.test(line.trim())) {
      break;
    }
    if (!line.trim()) continue;

    const values = line
      .split('|')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (values.length > 0) {
      rows.push(values);
    }
  }

  return { columns, rows };
}
