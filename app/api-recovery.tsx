"use client";
import { useEffect, useState } from 'react';
import { ExternalLink, LogIn, ShieldCheck, X } from 'lucide-react';
import { API_RECOVERY_EVENT, type ApiRecovery, type ApiRecoveryDetail } from '@/lib/api-client';
import { siteRecoveryLinks, siteRecoveryLinksForLocation } from '@/lib/auth-navigation';

export function ApiRecoveryActions({ recovery }: { recovery: ApiRecovery }) {
  const [links, setLinks] = useState(() => siteRecoveryLinks());
  useEffect(() => {
    const update = () => setLinks(siteRecoveryLinksForLocation(window.location));
    update(); window.addEventListener('hashchange', update); window.addEventListener('popstate', update);
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); };
  }, []);
  if (!recovery) return null;
  return <div className="api-recovery-actions">
    {recovery === 'sign-in' && <a className="btn" href={links.signIn} target="_top"><LogIn size={17}/>Влез отново с ChatGPT</a>}
    <a className={`btn ${recovery === 'sign-in' ? 'light' : ''}`} href={links.openSite} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Отвори Eduo в нов раздел</a>
    {recovery === 'sign-in' && <small>Входът се отваря в основния прозорец. Копирайте незапазената работа преди вход.</small>}
  </div>;
}

// One recovery notice also covers editors, uploads and AI requests. Their current
// inputs stay mounted; a failed response never silently resubmits a write.
export function ApiRecoveryNotice({ hidden = false }: { hidden?: boolean }) {
  const [notice, setNotice] = useState<ApiRecoveryDetail | null>(null);
  useEffect(() => { if (hidden) setNotice(null); }, [hidden]);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<ApiRecoveryDetail>).detail;
      if (detail && typeof detail.message === 'string' && ['sign-in', 'open-site'].includes(detail.recovery)) setNotice(detail);
    };
    window.addEventListener(API_RECOVERY_EVENT, receive);
    return () => window.removeEventListener(API_RECOVERY_EVENT, receive);
  }, []);
  if (!notice || hidden) return null;
  return <aside className="api-recovery-notice" aria-label="Възстановяване на връзката">
    <ShieldCheck size={23} aria-hidden="true"/>
    <div><h2>{notice.recovery === 'sign-in' ? 'Влезте отново в Eduo' : 'Отворете платформата директно'}</h2><p role="alert">{notice.message}</p><ApiRecoveryActions recovery={notice.recovery}/></div>
    <button className="api-recovery-dismiss" type="button" aria-label="Затвори известието за връзката" onClick={() => setNotice(null)}><X size={19}/></button>
  </aside>;
}
