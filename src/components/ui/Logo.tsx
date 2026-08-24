import { cn } from '../../lib/utils'

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label="Lunatica 1.5">
      <svg viewBox="0 0 40 40" role="img" aria-hidden="true" className="h-9 w-9 shrink-0">
        <rect width="40" height="40" rx="12" fill="currentColor" className="text-zinc-900 dark:text-white" />
        <path d="M26.2 10.6a11.2 11.2 0 1 0 3.2 18.8A10 10 0 1 1 26.2 10.6Z" fill="currentColor" className="text-lunar-300 dark:text-lunar-400" />
        <circle cx="28.4" cy="13" r="1.3" fill="currentColor" className="text-white dark:text-ink-950" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight">Lunatica</span>
          <span className="mt-1 block text-[10px] font-medium tracking-[.18em] text-zinc-500">VERSÃO 1.5</span>
        </div>
      )}
    </div>
  )
}
