// Shared by server auth helpers and the client recovery links. No session data.
export const EDUO_SITE_ORIGIN = 'https://eduo.codesm27.chatgpt.site';

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    if (url.origin !== 'https://app.local' || ['/signin-with-chatgpt', '/signout-with-chatgpt', '/callback'].includes(pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}

export function chatGPTSignInPath(returnTo: string): string {
  return '/signin-with-chatgpt?return_to=' + encodeURIComponent(safeRelativeReturnPath(returnTo));
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  return '/signout-with-chatgpt?return_to=' + encodeURIComponent(safeRelativeReturnPath(returnTo));
}

export function siteRecoveryLinks(returnTo = '/') {
  const path = safeRelativeReturnPath(returnTo);
  return { signIn: EDUO_SITE_ORIGIN + chatGPTSignInPath(path), openSite: EDUO_SITE_ORIGIN + path };
}

export function siteRecoveryLinksForLocation(location: Pick<URL, 'origin' | 'search' | 'hash'>) {
  // Preview-host query parameters belong to the preview, not the school app.
  return siteRecoveryLinks('/' + (location.origin === EDUO_SITE_ORIGIN ? location.search : '') + location.hash);
}
