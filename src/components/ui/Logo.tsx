import { cn } from '../../lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Símbolo da Lunatica" className={cn('logo-mark h-9 w-9 shrink-0', className)}>
      <defs><linearGradient id="luna-core" x1="11" y1="8" x2="34" y2="37" gradientUnits="userSpaceOnUse"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#6d4acb" /></linearGradient></defs>
      <rect className="logo-mark-bg" x="1" y="1" width="46" height="46" rx="15" />
      <path className="logo-crescent" d="M28.3 9.8a14.7 14.7 0 1 0 8.9 24.8 13 13 0 1 1-8.9-24.8Z" fill="url(#luna-core)" />
      <path className="logo-orbit" d="M7.5 36.5C15.2 25 28 15.8 41 12.8" fill="none" strokeWidth="1.6" strokeLinecap="round" />
      <circle className="logo-star" cx="40.8" cy="12.9" r="2.1" />
      <path className="logo-star" d="m35.4 27.5.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9.9-2.2Z" />
    </svg>
  )
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label="Lunatica 1.5">
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight">Lunatica</span>
          <span className="mt-1 block text-[9px] font-semibold tracking-[.2em] text-zinc-500">INTELLIGENCE · 1.5</span>
        </div>
      )}
    </div>
  )
}
