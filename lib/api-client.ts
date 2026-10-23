export type ApiRecovery = 'sign-in' | 'open-site' | null;
export const API_RECOVERY_EVENT = 'eduo:api-recovery';
export type ApiRecoveryDetail = { message: string; recovery: Exclude<ApiRecovery, null> };

export class ApiRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 0, public readonly recovery: ApiRecovery = null) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type JsonObject = Record<string, unknown>;
type Validator = (value: JsonObject) => boolean;
const object = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const record = (value: unknown) => object(value) && typeof value.id === 'string' && typeof value.kind === 'string';
const home = (value: JsonObject) => typeof value.writable === 'boolean' && typeof value.preview === 'boolean' && Array.isArray(value.schools);
const context = (value: JsonObject) => value.context === null || object(value.context) && object(value.context.school) && Array.isArray(value.context.classes) && Array.isArray(value.context.pupils);

// Check the response envelope before any workspace renders or marks a write saved.
export const apiContracts = {
  workspace: (v: JsonObject) => Array.isArray(v.records) && v.records.every(record) && typeof v.writable === 'boolean' && typeof v.aiConfigured === 'boolean',
  record: (v: JsonObject) => record(v.record),
  tutor: (v: JsonObject) => typeof v.answer === 'string' && !!v.answer.trim(),
  school: (v: JsonObject) => home(v) && (v.current === null || object(v.current) && object(v.current.school) && Array.isArray(v.current.classes) && Array.isArray(v.current.pupils)),
  classwork: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.assignments),
  inbox: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.notices) && typeof v.unreadCount === 'number',
  learning: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.lessons),
  practice: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.practices) && Array.isArray(v.lessons),
  gradebook: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.grades) && typeof v.canRecord === 'boolean' && typeof v.capacityReached === 'boolean',
  attendance: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.sessions) && typeof v.canCreate === 'boolean' && typeof v.capacityReached === 'boolean',
  announcements: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.announcements) && typeof v.canCreate === 'boolean' && typeof v.capacityReached === 'boolean',
  schoolDocuments: (v: JsonObject) => home(v) && context(v) && Array.isArray(v.documents) && Array.isArray(v.parentCounts) && typeof v.canCreate === 'boolean' && typeof v.capacityReached === 'boolean',
} satisfies Record<string, Validator>;

function failure(code: string, status: number, writing: boolean): ApiRequestError {
  if (status === 401) return new ApiRequestError('Сесията за вход е изтекла или липсва. Влезте отново в Eduo, за да продължите.', 'sign-in', status, 'sign-in');
  if (writing) return new ApiRequestError('Не получихме потвърждение за записа. Проверете запазената работа, преди да изпратите отново.', code, status, 'open-site');
  if (code === 'network') return new ApiRequestError('Няма връзка с Eduo. Проверете връзката си и опитайте отново.', code, status, 'open-site');
  return new ApiRequestError('Прегледът не върна очакваните данни. Отворете Eduo директно и опитайте отново.', code, status, 'open-site');
}

function announceRecovery(error: ApiRequestError) {
  if (error.recovery && typeof window !== 'undefined') {
    const detail: ApiRecoveryDetail = { message: error.message, recovery: error.recovery };
    window.dispatchEvent(new CustomEvent(API_RECOVERY_EVENT, { detail }));
  }
}

export async function apiJson<T = JsonObject>(path: string, init: RequestInit = {}, validate?: Validator): Promise<T> {
  // Relative API paths keep cookies and uploaded work on this Site only.
  if (!path.startsWith('/api/') || /[\\\u0000-\u0020\u007f#]/.test(path) || new URL(path, 'https://app.local').pathname !== path.split('?')[0]) {
    throw new TypeError('Expected a same-origin API path');
  }
  const writing = !['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase());
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    let response: Response;
    try {
      response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'manual' });
    } catch (e) {
      if (init.signal?.aborted) throw e;
      throw failure('network', 0, writing);
    }
    if (response.type === 'opaqueredirect' || response.redirected || response.status >= 300 && response.status < 400) {
      throw failure('redirect', response.status, writing);
    }
    const mime = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (mime !== 'application/json' && !/^application\/[\w!#$&^.+-]+\+json$/.test(mime)) {
      throw failure('unexpected-response', response.status, writing);
    }
    let data: unknown;
    try { data = await response.json(); }
    catch (e) { if (init.signal?.aborted) throw e; throw failure('invalid-json', response.status, writing); }
    if (!response.ok) {
      const message = object(data) && typeof data.error === 'string' && data.error.trim();
      if (message) throw new ApiRequestError(message, 'http', response.status, response.status === 401 ? 'sign-in' : null);
      throw failure('http', response.status, writing);
    }
    if (!object(data) || validate && !validate(data)) throw failure('invalid-data', response.status, writing);
    return data as T;
  } catch (e) {
    if (e instanceof ApiRequestError) announceRecovery(e);
    throw e;
  }
}
