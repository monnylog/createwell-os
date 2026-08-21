import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { CalendarDays, ClipboardList, HeartPulse, Home, LogOut, PanelLeft, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: ClipboardList, label: "Operating current", path: "/team" },
  { icon: CalendarDays, label: "Program calendar", path: "/team#calendar" },
  { icon: HeartPulse, label: "Check-ins", path: "/team#check-ins" },
  { icon: ShieldCheck, label: "Private operations", path: "/team#private" },
];

const SIDEBAR_WIDTH_KEY = "createwell-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 216;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#f4f5ee] p-6"><div className="max-w-md rounded-2xl border border-[#c8dbd6] bg-white p-9 text-center shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#277b7d]">Create Well / Team portal</p><h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] text-[#092f35]">Come back into the current.</h1><p className="mt-4 text-sm leading-6 text-[#527174]">This space holds private team operations and requires authentication.</p><Button onClick={() => startLogin()} className="mt-7 rounded-full bg-[#166e70] px-6 hover:bg-[#0d5759]">Sign in to the portal</Button></div></div>;
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardContent setSidebarWidth={setSidebarWidth}>{children}</DashboardContent></SidebarProvider>;
}

function DashboardContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const move = (event: MouseEvent) => { if (!isResizing) return; const left = sidebarRef.current?.getBoundingClientRect().left ?? 0; const width = event.clientX - left; if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width); };
    const up = () => setIsResizing(false);
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
  }, [isResizing, setSidebarWidth]);

  return <><div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r border-[#184e52] bg-[#062c33] text-[#ecf5f1]"><SidebarHeader className="h-20 justify-center"><div className="flex items-center gap-3 px-3"><button onClick={toggleSidebar} className="grid h-8 w-8 place-items-center rounded-lg text-[#b9e1d8] hover:bg-white/10" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4" /></button>{!isCollapsed && <span className="font-serif text-xl tracking-tight">Create Well</span>}</div></SidebarHeader><SidebarContent><SidebarMenu className="px-2 py-2">{menuItems.map(item => <SidebarMenuItem key={item.label}><SidebarMenuButton isActive={location === "/team" && item.path === "/team"} onClick={() => { if (item.path.includes("#")) document.querySelector(item.path.slice(item.path.indexOf("#")))?.scrollIntoView({ behavior: "smooth" }); else setLocation(item.path); }} tooltip={item.label} className="h-10 text-[#dcedea] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#17676b] data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="space-y-2 p-3"><button onClick={() => setLocation("/")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-[#b9e1d8] hover:bg-white/10"><Home className="h-4 w-4" /><span className="group-data-[collapsible=icon]:hidden">Public site</span></button><div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm"><Avatar className="h-8 w-8 border border-white/20"><AvatarFallback className="bg-[#d6ebe5] text-[#155b5e]">{user?.name?.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate font-medium">{user?.name}</p><p className="truncate text-xs text-[#8ebeb7]">{user?.role}</p></div><button onClick={logout} className="text-[#b9e1d8] hover:text-white" aria-label="Sign out"><LogOut className="h-4 w-4" /></button></div></SidebarFooter></Sidebar><div className={`absolute right-0 top-0 h-full w-1 cursor-col-resize ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} /></div><SidebarInset className="bg-[#f4f5ee]">{isMobile && <div className="sticky top-0 z-30 flex h-14 items-center border-b border-[#c8dbd6] bg-[#f4f5ee]/95 px-3 backdrop-blur"><SidebarTrigger className="mr-2" /><span className="font-serif text-lg text-[#092f35]">Create Well</span></div>}<main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main></SidebarInset></>;
}
