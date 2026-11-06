import { Toaster } from 'sonner'
import { useTheme } from '@/providers/ThemeProvider'

/** Los toasts siguen el tema claro u oscuro del panel. */
export function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      closeButton
      richColors
      toastOptions={{ classNames: { toast: 'rounded-[12px] font-sans' } }}
    />
  )
}
