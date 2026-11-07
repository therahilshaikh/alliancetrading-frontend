"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        // Prototype filter chips: separate rounded pills, selected one filled with brand.
        default: "flex-wrap justify-start gap-2 text-slate-500",
        line: "h-9 justify-center gap-1 rounded-none bg-transparent p-[3px] text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all focus-visible:ring-4 focus-visible:ring-brand/20 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // chips (default)
        "group-data-[variant=default]/tabs-list:rounded-xl group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-slate-200 group-data-[variant=default]/tabs-list:bg-white group-data-[variant=default]/tabs-list:px-3.5 group-data-[variant=default]/tabs-list:py-2 group-data-[variant=default]/tabs-list:text-xs group-data-[variant=default]/tabs-list:font-extrabold group-data-[variant=default]/tabs-list:text-slate-500 group-data-[variant=default]/tabs-list:hover:border-brand/40 group-data-[variant=default]/tabs-list:hover:text-slate-900",
        "dark:group-data-[variant=default]/tabs-list:border-white/10 dark:group-data-[variant=default]/tabs-list:bg-white/5 dark:group-data-[variant=default]/tabs-list:text-slate-300 dark:group-data-[variant=default]/tabs-list:hover:text-white",
        "group-data-[variant=default]/tabs-list:data-[state=active]:border-brand group-data-[variant=default]/tabs-list:data-[state=active]:bg-brand group-data-[variant=default]/tabs-list:data-[state=active]:text-white dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-brand dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-brand",
        // underline (line)
        "group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:flex-1 group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:py-1 group-data-[variant=line]/tabs-list:text-sm group-data-[variant=line]/tabs-list:font-medium group-data-[variant=line]/tabs-list:text-foreground/60 group-data-[variant=line]/tabs-list:data-[state=active]:text-brand",
        "after:absolute after:bg-brand after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
