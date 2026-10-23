"use client";
import { type ReactNode } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
export function Pill({ children, color = 'gray' }: {
    children: ReactNode;
    color?: string;
}) { return <span className={`pill ${color}`}>{children}</span>; }
export function Choice({ value, onChange, options, label, className = '', disabled = false }: {
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    label: string;
    className?: string;
    disabled?: boolean;
}) { return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={`choice ${className}`}><SelectValue /></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>; }
export function Button({ children, onClick, variant = '', type = 'button', disabled = false, className = '' }: {
    children: ReactNode;
    onClick?: () => void;
    variant?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
    className?: string;
}) { return <button type={type} onClick={onClick} disabled={disabled} className={`btn ${variant} ${className}`}>{children}</button>; }
export function SectionTitle({ title, action, onClick }: {
    title: string;
    action?: string;
    onClick?: () => void;
}) { return <div className="section-title"><h2>{title}</h2>{action && <button className="text-button" onClick={onClick}>{action}<ChevronRight size={16}/></button>}</div>; }
export function Blank({ icon: Icon = CheckCircle2, title, text, children }: {
    icon?: any;
    title: string;
    text: string;
    children?: ReactNode;
}) { return <div className="blank"><Icon size={36}/><h3>{title}</h3><p>{text}</p>{children}</div>; }
export function PageHeading({ eyebrow, title, description, children }: {
    eyebrow?: string;
    title: string;
    description?: string;
    children?: ReactNode;
}) { return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</div>; }
