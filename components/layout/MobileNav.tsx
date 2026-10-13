"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./SidebarNav";

export function MobileNav({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-11 w-11 p-0 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>KPSS Admin</SheetTitle>
          </SheetHeader>
          <SidebarNav
            pendingCount={pendingCount}
            reportCount={reportCount}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
