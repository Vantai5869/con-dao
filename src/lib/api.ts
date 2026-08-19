import type { Lang } from './i18n';

// LAN address of the transaction backend (reachable via VPN during development).
// Override with VITE_API_BASE_URL for other environments.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://192.168.0.101:10081';
// Simple fixed API key (not a user token) — override with VITE_API_KEY if the backend issues a real one per deployment.
const API_KEY = import.meta.env.VITE_API_KEY ?? '1';

export class ApiError extends Error {}

/** Thrown for network-level failures (fetch rejected, or a response that isn't valid JSON) — as opposed to a business error the backend reported deliberately. Exported so screens can show "Retry" instead of "Rescan" for this specific case. */
export const CONNECTION_ERROR_MESSAGE = 'Không thể kết nối máy chủ. Vui lòng thử lại.';

// The backend only localizes messages in vi/en — any other app language falls back to en.
function toApiLang(lang: Lang): 'vi' | 'en' {
  return lang === 'vi' ? 'vi' : 'en';
}

function baseHeaders(lang: Lang): Record<string, string> {
  return { apiKey: API_KEY, 'Accept-Language': toApiLang(lang) };
}

async function parseJsonSafely(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    throw new ApiError(CONNECTION_ERROR_MESSAGE);
  }
}

async function postJson(path: string, body: unknown, lang: Lang): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...baseHeaders(lang), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(CONNECTION_ERROR_MESSAGE);
  }
  return parseJsonSafely(res);
}

export interface RegisterResult {
  transactionId: string;
  /** 2 = go capture the face next; 3 = face is already on file, skip straight to the document step. */
  nextStep: 2 | 3;
}

/** Initializes a check-in transaction for a scanned ticket. Works for both outbound and return trips. */
export async function registerTransaction(ticketInfo: string, lang: Lang): Promise<RegisterResult> {
  const body = await postJson('/api/transaction-v3/web/register', { ticketInfo }, lang);
  if (body.status !== 1) {
    throw new ApiError(typeof body.message === 'string' ? body.message : 'Đăng ký thông tin thất bại.');
  }
  // The API's own field is spelled "nexStep" (typo, missing a "t") — matching it verbatim here.
  const data = body.data as { transactionId: string; nexStep: 2 | 3 };
  return { transactionId: data.transactionId, nextStep: data.nexStep };
}

export type UploadType = 'FACE' | 'CC_FRONT' | 'CC_BACK' | 'PASSPORT';

export interface UploadResult {
  path: string;
  /** Whether the document-capture step is still needed after this upload. */
  isNeedPaper: boolean;
}

/** Uploads a captured photo (face or ID document side) tied to an in-progress transaction. */
export async function uploadPhoto(file: Blob, type: UploadType, transactionId: string, lang: Lang): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file, `${type.toLowerCase()}.jpg`);
  form.append('type', type);
  form.append('transactionId', transactionId);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/transaction-v3/web/upload`, {
      method: 'POST',
      headers: baseHeaders(lang),
      body: form,
    });
  } catch {
    throw new ApiError(CONNECTION_ERROR_MESSAGE);
  }

  const body = await parseJsonSafely(res);
  if (body.status !== 1) {
    throw new ApiError(typeof body.message === 'string' ? body.message : 'Tải ảnh lên thất bại.');
  }
  const data = body.data as { path: string; isNeedPaper: boolean };
  return { path: data.path, isNeedPaper: Boolean(data.isNeedPaper) };
}

/** Fetches a previously-uploaded photo by its storage path (as returned by uploadPhoto) and returns a local object URL. */
export async function getImageUrl(path: string, lang: Lang): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/transaction-v3/get-image?path=${encodeURIComponent(path)}`, {
      headers: baseHeaders(lang),
    });
  } catch {
    throw new ApiError(CONNECTION_ERROR_MESSAGE);
  }
  if (!res.ok) {
    throw new ApiError('Không thể tải ảnh.');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
