import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CommandCenter } from "@/components/command-center/CommandCenter";
import { AskJoy } from "@/components/home/AskJoy";

export function AppShell() {
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
        {/* One AI entry point on every screen, per the mock: the Ask Joy
            pill. Its panel answers small questions; a typed question opens
            the full Command Center. */}
        <AskJoy />
        <CommandCenter />
      </div>
    </SidebarProvider>
  );
}
