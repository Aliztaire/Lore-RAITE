import { LayoutGrid, PenLine, Library, BarChart3, type LucideIcon } from 'lucide-react'
import type { ViewMode } from '@/lib/types'

export interface NavItem {
  mode: ViewMode
  label: string
  icon: LucideIcon
  /** Secondary views that keep this item highlighted (e.g. the concept map lives under Overview). */
  alsoActiveFor?: ViewMode[]
}

export interface NavSection {
  /** Optional small heading shown above the group. */
  label?: string
  items: NavItem[]
}

/**
 * Sidebar navigation, in display order.
 *
 * Adding a view (e.g. Adviser, AI Use Log):
 *   1. add its key to `ViewMode` in lib/types.ts
 *   2. add an entry to the VIEWS registry in app/page.tsx and to KNOWN_VIEW_MODES in
 *      lib/store.ts (both are full Records, so TypeScript flags any you miss)
 *   3. add a NavItem here, in a new section such as:
 *        { label: 'Review', items: [
 *          { mode: 'adviser', label: 'Adviser', icon: GraduationCap },
 *          { mode: 'ai-log',  label: 'AI use log', icon: ScrollText },
 *        ] }
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { mode: 'dashboard', label: 'Overview', icon: LayoutGrid, alsoActiveFor: ['canvas'] },
      { mode: 'writing', label: 'Write', icon: PenLine },
      { mode: 'literature', label: 'Literature', icon: Library },
      { mode: 'analyzer', label: 'Data Analysis', icon: BarChart3 },
    ],
  },
]

export function isNavItemActive(item: NavItem, viewMode: ViewMode) {
  return item.mode === viewMode || !!item.alsoActiveFor?.includes(viewMode)
}
