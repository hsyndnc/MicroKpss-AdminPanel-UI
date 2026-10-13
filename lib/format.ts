import { format } from "date-fns";
import { tr } from "date-fns/locale";

/** Geçersiz/boş tarihte em-dash döner — date-fns v4 `format` Invalid Date'te RangeError atar. */
export function formatTrDate(value: string | null | undefined, pattern: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern, { locale: tr });
}
