'use client'

import * as React from 'react'
import { GripVerticalIcon } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      {...props}
      data-slot="resizable-panel-group"
      data-panel-group-direction={
        orientation === 'vertical' ? 'vertical' : 'horizontal'
      }
      className={cn(
        'group flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
        className,
      )}
      orientation={orientation}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      {...props}
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden group-data-[panel-group-direction=vertical]:h-px group-data-[panel-group-direction=vertical]:w-full group-data-[panel-group-direction=vertical]:after:left-0 group-data-[panel-group-direction=vertical]:after:h-1 group-data-[panel-group-direction=vertical]:after:w-full group-data-[panel-group-direction=vertical]:after:translate-x-0 group-data-[panel-group-direction=vertical]:after:-translate-y-1/2 group-data-[panel-group-direction=vertical]:[&>div]:rotate-90',
        className,
      )}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
