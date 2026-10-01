'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DialogOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface DialogState extends DialogOptions {
  mode: 'confirm' | 'notify'
}

interface ConfirmContextValue {
  /** Styled replacement for window.confirm — resolves true when confirmed. */
  confirm: (opts: DialogOptions) => Promise<boolean>
  /** Styled replacement for window.alert — resolves when dismissed. */
  notify: (opts: Omit<DialogOptions, 'cancelLabel' | 'destructive'>) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null)
  const [open, setOpen] = useState(false)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback((opts: DialogOptions) => {
    setState({ ...opts, mode: 'confirm' })
    setOpen(true)
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  const notify = useCallback((opts: Omit<DialogOptions, 'cancelLabel' | 'destructive'>) => {
    setState({ ...opts, mode: 'notify' })
    setOpen(true)
    return new Promise<void>(resolve => { resolverRef.current = () => resolve() })
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm, notify }}>
      {children}
      <AlertDialog open={open} onOpenChange={o => { if (!o) settle(false) }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-lg font-semibold">{state?.title}</AlertDialogTitle>
            {state?.description && (
              <AlertDialogDescription className="leading-relaxed">{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            {state?.mode === 'confirm' && (
              <AlertDialogCancel onClick={() => settle(false)}>
                {state.cancelLabel ?? 'Cancel'}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(state?.destructive && buttonVariants({ variant: 'destructive' }))}
            >
              {state?.confirmLabel ?? (state?.mode === 'notify' ? 'OK' : 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
