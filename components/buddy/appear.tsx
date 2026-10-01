'use client'

import { AnimatePresence, MotionConfig, motion } from 'motion/react'

/** Long, soft ease-out (easeOutQuint) — starts promptly, settles slowly. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/**
 * Elegant screen transition: the outgoing screen fades away quickly, then the
 * incoming one drifts up a few pixels while fading and sharpening into place.
 * Change `id` to trigger it. Honours the OS "reduce motion" setting.
 */
export function Appear({ id, children, className }: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={id}
          className={className}
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{
            opacity: 1, y: 0, filter: 'blur(0px)',
            transition: { duration: 0.7, ease: EASE_OUT },
            // Clear filter/transform afterwards so they can't affect fixed or sticky children
            transitionEnd: { filter: 'none', transform: 'none' },
          }}
          exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}
