'use client'

import type { ComponentProps } from 'react'
import { AppSidebar } from '@/components/app-sidebar'

/** v2.0.0 — layout island: wraps `AppSidebar` for composition pages without changing markup. */
export function StationSidebar(props: ComponentProps<typeof AppSidebar>) {
  return <AppSidebar {...props} />
}
