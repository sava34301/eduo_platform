import { createRequire } from 'node:module';

export async function checkApiClient({ check, dir, setUser, routes }) {
  const { apiJson, apiContracts, ApiRequestError, API_RECOVERY_EVENT } = await import(dir + '/api-client.mjs');
  const navigation = await import(dir + '/auth-navigation.mjs');
  const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
  const events = [], calls = [];
  globalThis.window = new EventTarget();
  window.addEventListener(API_RECOVERY_EVENT, e => events.push(e.detail));
  const serve = response => {
    events.length = 0; calls.length = 0;
    globalThis.fetch = async (path, init) => { calls.push({ path, init }); return typeof response === 'function' ? response(path, init) : response; };
  };
  async function rejected(path = '/api/workspace', init = {}, validate) {
    try { await apiJson(path, init, validate); } catch (error) { return error; }
    throw new Error('Expected API failure');
  }
  try {
    serve(Response.json({ records: [{ id: 'r', kind: 'note' }], writable: false, aiConfigured: false }));
    const snapshot = await apiJson('/api/workspace?school=test', {}, apiContracts.workspace);
    check(snapshot.records[0].id === 'r' && calls[0].path === '/api/workspace?school=test', 'Valid JSON workspace and query are returned intact');
    const request = calls[0].init;
    check(request.headers.get('Accept') === 'application/json' && request.credentials === 'same-origin' && request.cache === 'no-store' && request.redirect === 'manual', 'Client requests JSON with same-origin credentials, fresh reads and manual redirects');
    check(!request.headers.has('Content-Type'), 'GET requests do not invent a body content type');

    serve(new Response('{"answer":"Здравей"}', { headers: { 'Content-Type': 'Application/JSON; charset=utf-8' } }));
    check((await apiJson('/api/tutor', {}, apiContracts.tutor)).answer === 'Здравей', 'JSON MIME casing and charset are handled');
    serve(new Response('{"error":"Няма достъп до този клас."}', { status: 403, headers: { 'Content-Type': 'application/problem+json' } }));
    let error = await rejected();
    check(error instanceof ApiRequestError && error.message === 'Няма достъп до този клас.' && error.status === 403 && error.recovery === null && events.length === 0, 'Problem JSON preserves a membership refusal without suggesting expired sign-in');
    for (const status of [400, 404, 409, 429, 503]) {
      serve(Response.json({ error: 'Проверен сървърен отговор ' + status }, { status }));
      error = await rejected();
      check(error.message === 'Проверен сървърен отговор ' + status && error.status === status && !error.recovery, 'JSON application error ' + status + ' keeps its specific reason');
    }
    serve(Response.json({ error: 'За запис е необходим вход.' }, { status: 401 }));
    error = await rejected('/api/workspace', { method: 'POST', body: '{}' });
    check(error.message === 'За запис е необходим вход.' && error.recovery === 'sign-in' && events[0]?.recovery === 'sign-in', 'JSON 401 preserves its reason and offers sign-in recovery');

    for (const status of [200, 401, 403, 404, 500, 503]) {
      let parsed = false;
      const response = new Response('<!DOCTYPE html><p>Private gateway page: secret marker</p>', { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      response.json = async () => { parsed = true; throw new SyntaxError('Unexpected token <'); };
      serve(response); error = await rejected();
      check(error instanceof ApiRequestError && !parsed && !error.message.includes('secret marker') && !error.message.includes('Unexpected token'), 'HTML ' + status + ' is rejected before JSON parsing without exposing the page');
      check(error.status === status && error.recovery === (status === 401 ? 'sign-in' : 'open-site') && events.length === 1, 'HTML ' + status + ' emits the appropriate actionable recovery');
    }
    serve(new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } }));
    error = await rejected('/api/classwork', { method: 'POST', body: '{"type":"submit"}' });
    check(calls.length === 1 && error.message.includes('потвърждение') && !error.message.includes('запазена.'), 'An HTML write response remains unconfirmed and is never automatically retried');

    for (const status of [301, 302, 307, 308]) {
      serve(new Response(null, { status, headers: { Location: '/signin-with-chatgpt' } }));
      error = await rejected();
      check(error.code === 'redirect' && error.recovery === 'open-site' && calls.length === 1, 'Redirect ' + status + ' is handled without fetching the sign-in page');
    }
    serve({ type: 'opaqueredirect', status: 0, redirected: false });
    check((await rejected()).code === 'redirect', 'Browser opaque redirects have clear recovery');
    const followed = Response.json({ ok: true }); Object.defineProperty(followed, 'redirected', { value: true });
    serve(followed);
    check((await rejected()).code === 'redirect', 'A response from an already-followed redirect is not trusted as API data');

    for (const [body, code] of [['<!DOCTYPE html>', 'invalid-json'], ['{"records":', 'invalid-json'], ['', 'invalid-json'], ['null', 'invalid-data'], ['[]', 'invalid-data'], ['"hello"', 'invalid-data'], ['42', 'invalid-data']]) {
      serve(new Response(body, { headers: { 'Content-Type': 'application/json' } }));
      error = await rejected();
      check(error instanceof ApiRequestError && error.code === code && !error.message.includes('Unexpected token'), 'Invalid JSON body ' + JSON.stringify(body) + ' has a readable failure');
    }
    serve(new Response('{}'));
    check((await rejected()).code === 'unexpected-response', 'A missing JSON content type is not silently accepted');
    serve(new Response(null, { status: 204 }));
    check((await rejected('/api/workspace', { method: 'POST' })).message.includes('потвърждение'), 'An empty write response cannot acknowledge a saved record');
    serve(Response.json({ error: 'Wrong success envelope' }));
    check((await rejected('/api/workspace', {}, apiContracts.workspace)).code === 'invalid-data', 'Wrong JSON envelope cannot reach the workspace renderer');
    serve(Response.json({ record: { id: 'missing-kind' } }));
    check((await rejected('/api/workspace', { method: 'POST' }, apiContracts.record)).code === 'invalid-data', 'Malformed saved-record response cannot mark a mutation successful');
    serve(Response.json({ answer: '   ' }));
    check((await rejected('/api/tutor', { method: 'POST' }, apiContracts.tutor)).code === 'invalid-data', 'An empty tutor answer cannot clear the question form');
    serve(Response.json({ unrelated: true }, { status: 503 }));
    check((await rejected()).status === 503, 'An HTTP JSON error lacking a message still has a readable failure');
    const interrupted = new Response('{}', { headers: { 'Content-Type': 'application/json' } }); interrupted.json = async () => { throw new TypeError('Body interrupted'); };
    serve(interrupted);
    check((await rejected()).code === 'invalid-json', 'Interrupted JSON response bodies do not leak parser errors');

    serve(() => { throw new TypeError('Failed to fetch: internal network detail'); });
    error = await rejected();
    check(error.code === 'network' && error.message.includes('Няма връзка') && !error.message.includes('internal'), 'Network read failures show a safe retry message');
    serve(() => { throw new TypeError('Failed to fetch'); });
    error = await rejected('/api/classwork', { method: 'POST', body: '{}' });
    check(calls.length === 1 && error.message.includes('потвърждение'), 'Lost write responses are unconfirmed and are never retried automatically');
    const abort = new AbortController(); abort.abort(); const abortError = new DOMException('Cancelled by caller', 'AbortError');
    serve(() => { throw abortError; });
    check(await rejected('/api/workspace', { signal: abort.signal }) === abortError && events.length === 0, 'Intentional request cancellation does not trigger sign-in recovery');

    const form = new FormData(); form.set('data', '{"requestId":"test"}'); form.append('files', new File(['synthetic worksheet'], 'worksheet.txt', { type: 'text/plain' }));
    serve(Response.json({ record: { id: 'saved-upload', kind: 'file' } }));
    await apiJson('/api/files', { method: 'POST', body: form, headers: { 'X-Request-ID': 'retained' } }, apiContracts.record);
    check(calls[0].init.body === form && !calls[0].init.headers.has('Content-Type') && calls[0].init.headers.get('X-Request-ID') === 'retained', 'Multipart upload preserves its form and caller headers without breaking the boundary');
    const uploadRequest = new Request('https://example.test/api/files', calls[0].init), uploadedForm = await uploadRequest.formData();
    check((await uploadedForm.get('files').text()) === 'synthetic worksheet' && uploadedForm.get('data') === '{"requestId":"test"}', 'Browser-generated multipart encoding keeps selected file bytes and fields intact');
    serve(Response.json({ record: { id: 'saved', kind: 'note' } }));
    await apiJson('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"note"}', credentials: 'include', redirect: 'follow', cache: 'force-cache' }, apiContracts.record);
    check(calls[0].init.headers.get('Content-Type') === 'application/json' && calls[0].init.body === '{"type":"note"}' && calls[0].init.credentials === 'same-origin' && calls[0].init.redirect === 'manual' && calls[0].init.cache === 'no-store', 'JSON writes keep their payload while enforcing the Site request boundary');
    for (const path of ['https://other.test/api/workspace', '//other.test/api/workspace', '/signin-with-chatgpt', '/api/../page', '/api/./workspace', '/api/\\other', '/api/workspace#fragment', '/api/workspace\n']) {
      serve(Response.json({})); error = await rejected(path);
      check(error instanceof TypeError && calls.length === 0, 'Unsafe API path ' + JSON.stringify(path) + ' is rejected before sending cookies or files');
    }

    // Route envelopes are checked against actual production source, not copied fixtures.
    for (const identity of [null, 'api-client-reader']) {
      setUser(identity);
      for (const [path, route, contract] of routes) {
        serve((input, init) => route.GET(new Request('https://example.test' + input, init)));
        const result = await apiJson(path, {}, contract(apiContracts));
        check(result && typeof result.writable === 'boolean', 'Actual ' + path + ' response passes its client envelope for ' + (identity ? 'signed-in account' : 'fictional preview'));
      }
    }

    const destination = '/?view=school#school-practice?school=s1&practice=p1&pupil=u1';
    const links = navigation.siteRecoveryLinks(destination);
    check(new URL(links.signIn).origin === navigation.EDUO_SITE_ORIGIN && new URL(links.signIn).searchParams.get('return_to') === destination && links.openSite === navigation.EDUO_SITE_ORIGIN + destination, 'Recovery preserves the current section and school/pupil deep link on the published Site');
    const fromPreview = navigation.siteRecoveryLinksForLocation(new URL('https://preview.example.test/host-preview?preview_context=private#school-learning?lesson=l1'));
    check(fromPreview.openSite === navigation.EDUO_SITE_ORIGIN + '/#school-learning?lesson=l1' && !fromPreview.signIn.includes('preview_context'), 'Embedded recovery keeps the school section without copying preview-host query parameters');
    check(navigation.siteRecoveryLinksForLocation(new URL(navigation.EDUO_SITE_ORIGIN + destination)).openSite === links.openSite, 'Published-Site recovery retains its own query and section');
    for (const path of ['https://other.test/', '//other.test/', '/\\other.test/', '/\nother.test', '/signin-with-chatgpt', '/signout-with-chatgpt?return_to=bad', '/callback#x', '/callback/', '/%63allback', '/folder/../callback', '/%ZZ']) {
      check(navigation.safeRelativeReturnPath(path) === '/' && new URL(navigation.siteRecoveryLinks(path).signIn).origin === navigation.EDUO_SITE_ORIGIN, 'Unsafe or looping sign-in return path ' + JSON.stringify(path) + ' stays on the Site');
    }
    check(new URL('https://example.test' + navigation.chatGPTSignOutPath(destination)).searchParams.get('return_to') === destination, 'The shared server sign-out helper preserves a safe return path');
    const require = createRequire(import.meta.url), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { ApiRecoveryActions } = await import(dir + '/api-recovery.mjs');
    const markup = renderToStaticMarkup(React.createElement(ApiRecoveryActions, { recovery: 'sign-in' }));
    check(markup.includes('target="_top"') && markup.includes('/signin-with-chatgpt?return_to=') && markup.includes('target="_blank"') && markup.includes('rel="noopener noreferrer"'), 'Recovery renders normal top-level sign-in and separate published-Site anchors');
    check(renderToStaticMarkup(React.createElement(ApiRecoveryActions, { recovery: null })) === '', 'Ordinary validation or membership errors do not add sign-in actions');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    setUser(null);
  }
}
