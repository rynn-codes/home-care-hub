import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CommandCenter } from "@/components/command-center/CommandCenter";
import { AskJoy } from "@/components/home/AskJoy";

export function AppShell() {
  // The Brain carries its own Ask-the-Brain dot in its header — the updated
  // design is explicit that home's AI door is that dot, not a floating panel.
  // Every other screen keeps the Ask Joy pill. The Command Center itself stays
  // mounted everywhere, because it is what a typed question opens.
  const onBrain = useLocation().pathname === "/";
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          {/* The approved mock's content frame: 20px top, 56px sides, 96px
              bottom so the Ask Joy pill never sits on the last row. */}
          <main className="flex-1 px-4 pt-5 pb-24 animate-fade-in md:px-8 lg:px-14">
            <Outlet />
          </main>
        </div>
        {/* One AI entry point per screen: the Ask Joy pill everywhere except
            home, where The Brain's header dot is the door. A typed question
            opens the full Command Center either way. */}
        {!onBrain && <AskJoy />}
        <CommandCenter />
      </div>
    </SidebarProvider>
  );
}
