export interface Ticket {
  code: string;
  name: string;
  idNumber: string;
  seat: string;
  /** ISO datetime string. */
  datetime: string;
  /** e.g. "VŨNG TÀU->CÔN ĐẢO" or "CÔN ĐẢO->VŨNG TÀU". */
  route: string;
  price: number;
  priceType: string;
}

/** Parses the JSON payload encoded in a ticket's QR code. Returns null if it's not a recognizable ticket. */
export function parseTicketQr(raw: string): Ticket | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as Ticket).code !== 'string' ||
    typeof (data as Ticket).name !== 'string' ||
    typeof (data as Ticket).idNumber !== 'string' ||
    typeof (data as Ticket).seat !== 'string' ||
    typeof (data as Ticket).datetime !== 'string' ||
    typeof (data as Ticket).route !== 'string' ||
    typeof (data as Ticket).price !== 'number' ||
    typeof (data as Ticket).priceType !== 'string'
  ) {
    return null;
  }

  return data as Ticket;
}

const RETURN_ROUTE_PREFIX = 'CÔN ĐẢO';

/** True if this ticket's route goes from Côn Đảo back to the mainland. */
export function isReturnTrip(ticket: Ticket): boolean {
  return ticket.route.trim().toUpperCase().startsWith(RETURN_ROUTE_PREFIX);
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

const USED_TICKETS_KEY = 'checkin:used-ticket-codes';

function getUsedTicketCodes(): Set<string> {
  try {
    const raw = localStorage.getItem(USED_TICKETS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

// TODO: re-enable the used-ticket check once a real backend tracks redemptions.
// Disabled for now so the same sample ticket QR can be rescanned freely while testing.
export function isTicketUsed(_code: string): boolean {
  void _code;
  return false;
}

export function markTicketUsed(code: string): void {
  const codes = getUsedTicketCodes();
  codes.add(code);
  localStorage.setItem(USED_TICKETS_KEY, JSON.stringify([...codes]));
}
