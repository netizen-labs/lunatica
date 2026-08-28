import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'black' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.classList.toggle('dark', theme !== 'light')
  document.documentElement.classList.toggle('black', theme === 'black')
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('lunatica-theme')
    return saved === 'black' || saved === 'dark' ? saved : 'light'
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
