export interface Ticket {
  /** The ticket's unique code (first segment of the raw QR content, before "$"). */
  code: string;
  /** Route code as encoded on the ticket, e.g. "VT-CD" or "CD-VT". */
  routeCode: string;
  /** Departure date/time exactly as printed on the ticket, e.g. "09/07/2026 07:30". */
  datetime: string;
  name: string;
  seat: string;
  idNumber: string;
}

// The ticket QR encodes a raw ticketInfo string (not JSON), e.g.:
// "1112C94DB0F5C0FEA162712FFBE9CBA1$VT-CD*09/07/2026 07:30*NGUYEN DUONG TU LINH*EN16*P03009062##"
const RAW_TICKET_PATTERN = /^([^$]+)\$([^*]+)\*([^*]+)\*([^*]+)\*([^*]+)\*([^#]+)##?$/;

/** Parses a scanned ticket QR's raw content. Returns null if it doesn't match the expected shape. */
export function parseTicketInfo(raw: string): Ticket | null {
  const match = RAW_TICKET_PATTERN.exec(raw.trim());
  if (!match) return null;

  const [, code, routeCode, datetime, name, seat, idNumber] = match;
  return {
    code: code.trim(),
    routeCode: routeCode.trim().toUpperCase(),
    datetime: datetime.trim(),
    name: name.trim(),
    seat: seat.trim(),
    idNumber: idNumber.trim(),
  };
}

const RETURN_ROUTE_PREFIX = 'CD';

/** True if this ticket's route goes from Côn Đảo back to the mainland. */
export function isReturnTrip(ticket: Ticket): boolean {
  return ticket.routeCode.startsWith(RETURN_ROUTE_PREFIX);
}

/** Human-readable route label for a raw route code like "VT-CD" or "CD-VT". */
export function routeLabel(routeCode: string): string {
  const code = routeCode.trim().toUpperCase();
  if (code === 'VT-CD') return 'VŨNG TÀU → CÔN ĐẢO';
  if (code === 'CD-VT') return 'CÔN ĐẢO → VŨNG TÀU';
  return routeCode;
}

/** Generates the e-ID pass code shown on the success screen, e.g. "VT-CD-2026-08-04-12A". */
export function generatePassCode(ticket: Ticket): string {
  const direction = isReturnTrip(ticket) ? 'CD-VT' : 'VT-CD';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `${direction}-${datePart}-${pad(now.getHours())}${suffix}`;
}
