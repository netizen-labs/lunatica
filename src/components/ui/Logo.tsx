import { cn } from '../../lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" role="img" aria-label="Símbolo da Lunatica" className={cn('h-9 w-9 shrink-0', className)}>
      <rect x="1" y="1" width="42" height="42" rx="14" fill="#111016" stroke="rgba(255,255,255,.12)" />
      <path d="M27.7 10.5A13 13 0 1 0 34 31.9a11.6 11.6 0 1 1-6.3-21.4Z" fill="#a78bfa" />
      <path d="M7.2 27.5c7.3 4.8 21.2 5.2 29.9-3.4" fill="none" stroke="#ddd6fe" strokeWidth="1.35" strokeLinecap="round" opacity=".72" />
      <circle cx="34.7" cy="22.5" r="1.7" fill="#f5f3ff" />
      <circle cx="29.7" cy="9.9" r="1" fill="#c4b5fd" />
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
          <span className="mt-1 block text-[10px] font-medium tracking-[.18em] text-zinc-500">MODELO 1.5</span>
        </div>
      )}
    </div>
  )
}
