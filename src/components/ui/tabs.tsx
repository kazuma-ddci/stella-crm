"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const TabsIdContext = React.createContext<string | undefined>(undefined)

type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
  idBase?: string
}

const Tabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ idBase, ...props }, ref) => (
  <TabsIdContext.Provider value={idBase}>
    <TabsPrimitive.Root ref={ref} {...props} />
  </TabsIdContext.Provider>
))
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-12 items-center justify-center rounded-lg bg-gray-100 p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(
  ({ className, value, id, "aria-controls": ariaControls, ...props }, ref) => {
    const idBase = React.useContext(TabsIdContext)
    const triggerId = idBase ? `${idBase}-trigger-${value}` : undefined
    const contentId = idBase ? `${idBase}-content-${value}` : undefined

    return (
      <TabsPrimitive.Trigger
        ref={ref}
        value={value}
        id={id ?? triggerId}
        aria-controls={ariaControls ?? contentId}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=inactive]:text-sm data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gray-600 data-[state=active]:text-base data-[state=active]:font-bold data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-md",
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(
  ({ className, value, id, "aria-labelledby": ariaLabelledBy, ...props }, ref) => {
    const idBase = React.useContext(TabsIdContext)
    const triggerId = idBase ? `${idBase}-trigger-${value}` : undefined
    const contentId = idBase ? `${idBase}-content-${value}` : undefined

    return (
      <TabsPrimitive.Content
        ref={ref}
        value={value}
        id={id ?? contentId}
        aria-labelledby={ariaLabelledBy ?? triggerId}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    )
  }
)
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
