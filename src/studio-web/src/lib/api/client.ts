const DEFAULT_BASE_URL = "/api";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly body: unknown;

  constructor(statusCode: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cc-music-token");
}

let _baseUrl: string = DEFAULT_BASE_URL;

export function setBaseUrl(baseUrl: string): void {
  _baseUrl = baseUrl;
}

export function getBaseUrl(): string {
  return _baseUrl;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${_baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers["x-cc-music-token"] = token;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text().catch(() => undefined);
    }
    throw new ApiError(
      res.status,
      `Request failed: ${res.status} ${res.statusText}`,
      errorBody,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function del<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
