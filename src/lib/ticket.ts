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
// The trailing "##" isn't consistent across every ticket/port (e.g. some end with just "#", some
// with none at all), so it's optional rather than requiring at least one.
const RAW_TICKET_PATTERN = /^([^$]+)\$([^*]+)\*([^*]+)\*([^*]+)\*([^*]+)\*([^#]+)#*$/;

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

/** Generates the e-ID pass code shown on the success screen, e.g. "VT-CD-2026-08-04-EN16". */
export function generatePassCode(ticket: Ticket): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${ticket.routeCode}-${datePart}-${ticket.seat}`;
}
