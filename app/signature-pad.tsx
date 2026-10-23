"use client";

import { useId, useRef, useState, type PointerEvent } from 'react';
import { PenLine, Trash2, Undo2 } from 'lucide-react';
import { Button } from './eduo-ui';
import { SIGNATURE_WIDTH, SIGNATURE_HEIGHT, MAX_SIGNATURE_POINTS, MAX_SIGNATURE_STROKES, drawnSignatureSchema, signatureDrawing, type DrawnSignature, type SignaturePoint } from '@/lib/document-signature';

export function SignatureImage({ drawing }: { drawing: unknown }) {
  const parsed = drawnSignatureSchema.safeParse(drawing);
  if (!parsed.success) return null;
  return <svg className="signature-image" viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} role="img" aria-label="Запазеният рисуван подпис"><g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{parsed.data.strokes.map((stroke, i) => <polyline key={i} points={stroke.map(point => point.join(',')).join(' ')}/>)}</g></svg>;
}

export function SignaturePad({ value, onChange, onDrawingChange, disabled = false }: {
  value: DrawnSignature; onChange: (value: DrawnSignature) => void; onDrawingChange?: (drawing: boolean) => void; disabled?: boolean;
}) {
  const instructions = useId(), surface = useRef<SVGSVGElement>(null);
  const active = useRef<number | null>(null), latest = useRef(value.strokes);
  const [drawing, setDrawing] = useState(false), [message, setMessage] = useState('');
  latest.current = value.strokes;
  const points = value.strokes.reduce((n, stroke) => n + stroke.length, 0);
  function update(strokes: SignaturePoint[][]) { latest.current = strokes; onChange(signatureDrawing(strokes)); }
  function point(e: PointerEvent<SVGSVGElement>): SignaturePoint {
    const box = e.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(SIGNATURE_WIDTH, Math.round((e.clientX - box.left) * SIGNATURE_WIDTH / Math.max(1, box.width)))),
      Math.max(0, Math.min(SIGNATURE_HEIGHT, Math.round((e.clientY - box.top) * SIGNATURE_HEIGHT / Math.max(1, box.height))))];
  }
  function start(e: PointerEvent<SVGSVGElement>) {
    if (disabled || active.current !== null || !e.isPrimary || e.button !== 0) return;
    if (latest.current.length >= MAX_SIGNATURE_STROKES || points >= MAX_SIGNATURE_POINTS) {
      setMessage('Полето е запълнено. Върнете последния щрих или започнете отначало.'); return;
    }
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    active.current = e.pointerId; setDrawing(true); onDrawingChange?.(true); setMessage(''); update([...latest.current, [point(e)]]);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (disabled || active.current !== e.pointerId) return;
    e.preventDefault();
    const strokes = latest.current, stroke = strokes.at(-1)!, next = point(e), previous = stroke.at(-1)!;
    if (strokes.reduce((n, s) => n + s.length, 0) >= MAX_SIGNATURE_POINTS) { setMessage('Достигнат е размерът на полето. Можете да изчистите и да подпишете отново.'); return; }
    if (Math.hypot(next[0] - previous[0], next[1] - previous[1]) < 2) return;
    update([...strokes.slice(0, -1), [...stroke, next]]);
  }
  function finish(e: PointerEvent<SVGSVGElement>) {
    if (active.current !== e.pointerId) return;
    // A tap is not a stroke. Pointer capture keeps a stroke continuous at edges.
    const strokes = latest.current;
    if ((strokes.at(-1)?.length || 0) < 2) update(strokes.slice(0, -1));
    active.current = null; setDrawing(false); onDrawingChange?.(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const valid = !drawing && drawnSignatureSchema.safeParse(value).success;
  return <div className={`signature-pad${disabled ? ' is-disabled' : ''}`}>
    <div className="signature-pad-heading"><span><PenLine size={16}/>Вашият подпис</span><small>Пръст, мишка или писалка</small></div>
    <div className="signature-surface">
      <svg ref={surface} viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Поле за рисуване на подпис" aria-describedby={instructions} aria-disabled={disabled}
        onPointerDown={start} onPointerMove={move} onPointerUp={e => { move(e); finish(e); }} onPointerCancel={finish} onLostPointerCapture={finish}>
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{value.strokes.map((stroke, i) => <polyline key={i} points={stroke.map(p => p.join(',')).join(' ')}/>)}</g>
      </svg>
      {!value.strokes.length && <span className="signature-placeholder"><PenLine size={21}/>Подпишете тук</span>}
      <span className="signature-baseline"/>
    </div>
    <div className="signature-pad-tools"><Button variant="light" disabled={disabled || drawing || !value.strokes.length} onClick={() => { update(value.strokes.slice(0, -1)); setMessage(''); }}><Undo2 size={15}/>Върни щрих</Button><Button variant="light" disabled={disabled || drawing || !value.strokes.length} onClick={() => { update([]); setMessage(''); }}><Trash2 size={15}/>Изчисти</Button></div>
    <p id={instructions} className="signature-instructions">Рисувайте в полето. Преди изпращане можете да изчистите или върнете щрих. За работа само с клавиатура изберете „Само запознаване“.</p>
    <p className="signature-status" role="status">{message || (drawing ? 'Рисувате…' : valid ? 'Подписът е готов за преглед.' : 'Нарисувайте подпис, преди да потвърдите.')}</p>
  </div>;
}
