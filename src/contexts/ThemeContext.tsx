import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'black' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  document.documentElement.classList.add('dark')
  document.documentElement.classList.toggle('black', theme === 'black')
  document.documentElement.style.colorScheme = 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('lunatica-theme')
    return saved === 'dark' ? 'dark' : 'black'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme: (nextTheme: Theme) => {
      localStorage.setItem('lunatica-theme', nextTheme)
      setThemeState(nextTheme)
    },
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return value
}
