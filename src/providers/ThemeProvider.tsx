import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** La misma clave que lee el script anti-destello de index.html. */
const STORAGE_KEY = 'worklog.theme'

function readInitialTheme(): Theme {
  const current = document.documentElement.dataset.theme
  if (current === 'light' || current === 'dark') return current
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* sin almacenamiento: el tema dura lo que la pestaña */
    }
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])
  const toggle = useCallback(() => setThemeState((value) => (value === 'dark' ? 'light' : 'dark')), [])

  return <ThemeContext value={{ theme, toggle, setTheme }}>{children}</ThemeContext>
}

// eslint-disable-next-line react/only-export-components
export function useTheme() {
  const context = use(ThemeContext)
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider.')
  return context
}
