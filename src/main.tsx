import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { App } from './App'
import { ThemedToaster } from './components/layout/ThemedToaster'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './providers/AuthProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import './index.css'

/**
 * Las devtools de TanStack Query solo aparecen si se piden (localStorage worklog.devtools = "1"):
 * su botón flotante tapaba el menú de usuario y las acciones de las páginas.
 */
function devtoolsEnabled() {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem('worklog.devtools') === '1'
  } catch {
    return false
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ThemedToaster />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
      {devtoolsEnabled() && <ReactQueryDevtools buttonPosition="bottom-right" />}
    </QueryClientProvider>
  </StrictMode>,
)
