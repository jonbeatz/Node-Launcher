'use client'

import { useState } from 'react'

/**
 * v1.3.5+ — **Projects** (tactical + favorites filter), **Vault** accordions default collapsed.
 * v1.9.0 — Favorites filter lives inside **Projects** (no separate Favorites pillar).
 */
export function useSidebarAccordionState() {
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)

  return {
    projectsOpen,
    setProjectsOpen,
    vaultOpen,
    setVaultOpen,
  }
}
