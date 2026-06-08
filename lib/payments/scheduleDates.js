function toDateParts(value) {
  if (!value) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate()
    };
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]) - 1,
        day: Number(match[3])
      };
    }
  }

  const date = new Date(value);
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate()
  };
}

export function addCalendarMonths(value, months) {
  const { year, month, day } = toDateParts(value);
  const target = new Date(year, month + months, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTargetMonth));
  return target;
}

export function dateOnly(value) {
  const date = value instanceof Date ? value : addCalendarMonths(value, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeMonthlyScheduleRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const sortedRows = [...rows].sort((a, b) => Number(a.due_number || 0) - Number(b.due_number || 0));
  const anchorRow = sortedRows.find((row) => Number(row.due_number || 0) === 1) || sortedRows[0];
  const anchorDueNumber = Math.max(1, Number(anchorRow.due_number || 1));
  const anchorDate = dateOnly(addCalendarMonths(anchorRow.due_date, -(anchorDueNumber - 1)));

  return sortedRows.map((row, index) => {
    const dueNumber = Math.max(1, Number(row.due_number || index + 1));
    return {
      ...row,
      due_date: dateOnly(addCalendarMonths(anchorDate, dueNumber - 1))
    };
  });
}
