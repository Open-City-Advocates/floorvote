import { useState } from 'react'
import { CHIP_BASE, chipOutline } from '../lib/chipStyles'

interface StatusChipProps {
  status: string | null
  onClick?: () => void
  isActive?: boolean
  // id of an element holding a longer explanation of the status
  describedBy?: string
}

export function StatusChip({ status, onClick, isActive, describedBy }: StatusChipProps) {
  const [hovered, setHovered] = useState(false)
  if (!status) return null

  const inner = (
    <span aria-describedby={onClick ? undefined : describedBy} style={{ ...CHIP_BASE, whiteSpace: 'nowrap', ...chipOutline(!!isActive, hovered, !!onClick) }}>
      {status}
    </span>
  )

  if (!onClick) return inner

  return (
    <button
      aria-describedby={describedBy}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex' }}
    >
      {inner}
    </button>
  )
}
