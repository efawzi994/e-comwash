
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  Wrench, 
  Package,
  MapPin,
  ClipboardList,
  CreditCard,
  Gift,
  Archive,
  TrendingUp,
  UserCog,
  Settings,
  Droplets,
  ShoppingCart,
  Calendar,
  PieChart,
  FileText,
  DollarSign,
  Receipt,
  BarChart3,
  Truck,
  ShoppingBag
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationGroups = [
  {
    label: "Operations",
    items: [
      { title: "Dashboard", url: "Dashboard", icon: LayoutDashboard },
      { title: "Bookings", url: "Bookings", icon: Calendar },
      { title: "Queue & Bays", url: "Queue", icon: Droplets },
      { title: "POS", url: "POS", icon: CreditCard },
    ]
  },
  {
    label: "Master Data",
    items: [
      { title: "Customers", url: "Customers", icon: Users },
      { title: "Vehicles", url: "Vehicles", icon: Car },
      { title: "Services", url: "Services", icon: Wrench },
      { title: "Products", url: "Products", icon: ShoppingCart },
      { title: "Branches", url: "Branches", icon: MapPin },
    ]
  },
  {
    label: "Inventory",
    items: [
      { title: "Inventory", url: "Inventory", icon: Archive },
      { title: "Purchase Orders", url: "PurchaseOrders", icon: ShoppingBag },
      { title: "Suppliers", url: "Suppliers", icon: Truck },
      { title: "Inventory Reports", url: "InventoryReports", icon: BarChart3 },
    ]
  },
  {
    label: "Accounting",
    items: [
      { title: "Accounting Dashboard", url: "AccountingDashboard", icon: PieChart },
      { title: "Chart of Accounts", url: "ChartOfAccounts", icon: FileText },
      { title: "Invoices", url: "Invoices", icon: Receipt },
      { title: "Payments", url: "Payments", icon: DollarSign },
      { title: "Expenses", url: "Expenses", icon: TrendingUp },
    ]
  },
  {
    label: "Business",
    items: [
      { title: "Packages & Memberships", url: "Packages", icon: Gift },
      { title: "Reports", url: "Reports", icon: TrendingUp },
    ]
  },
  {
    label: "Admin",
    items: [
      { title: "Employees", url: "Employees", icon: UserCog },
      { title: "Settings", url: "Settings", icon: Settings },
    ]
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-slate-900">E-COMWash</h2>
                <p className="text-xs text-slate-500">Car Wash ERP System</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {navigationGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = location.pathname === createPageUrl(item.url);
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            asChild 
                            className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg mb-1 ${
                              isActive ? 'bg-blue-100 text-blue-700 font-medium shadow-sm' : 'text-slate-700'
                            }`}
                          >
                            <Link to={createPageUrl(item.url)} className="flex items-center gap-3 px-3 py-2.5">
                              <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-screen">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 sticky top-0 z-10 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold text-slate-900">E-COMWash</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
