/** 通信待ちを有限にする。更新の自動再送はせず、同じ識別子で利用者が再試行する */
export function casinoFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(15_000) });
}
