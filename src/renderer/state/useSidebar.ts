'use client'

import { useState } from 'react'

/**
 * v1.3.5 — **Engineering**, **Vault** (incl. VPE Sandbox link), **Favorites** accordions default collapsed.
 * Dashboard nav is flat (no accordion) in **`app-sidebar.tsx`**.
 */
export function useSidebarAccordionState() {
  const [engineeringOpen, setEngineeringOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)

  return {
    engineeringOpen,
    setEngineeringOpen,
    vaultOpen,
    setVaultOpen,
    favoritesOpen,
    setFavoritesOpen,
  }
}
