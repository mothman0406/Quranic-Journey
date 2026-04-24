import type { Request } from "express";

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function getRequestLocalDate(req: Pick<Request, "get">): string {
  const localDateHeader = req.get("x-local-date")?.trim();
  if (localDateHeader && LOCAL_DATE_RE.test(localDateHeader)) {
    return localDateHeader;
  }

  return localDateStr(new Date());
}

export function addDaysToLocalDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateStr(date);
}
