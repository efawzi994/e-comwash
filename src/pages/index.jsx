import Layout from "./Layout.jsx";

import Customers from "./Customers";

import Vehicles from "./Vehicles";

import Services from "./Services";

import Products from "./Products";

import Branches from "./Branches";

import Queue from "./Queue";

import POS from "./POS";

import Employees from "./Employees";

import Packages from "./Packages";

import Inventory from "./Inventory";

import Reports from "./Reports";

import Settings from "./Settings";

import Bookings from "./Bookings";

import AccountingDashboard from "./AccountingDashboard";

import ChartOfAccounts from "./ChartOfAccounts";

import Invoices from "./Invoices";

import Payments from "./Payments";

import Expenses from "./Expenses";

import InventoryReports from "./InventoryReports";

import Dashboard from "./Dashboard";

import Suppliers from "./Suppliers";

import PurchaseOrders from "./PurchaseOrders";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Customers: Customers,
    
    Vehicles: Vehicles,
    
    Services: Services,
    
    Products: Products,
    
    Branches: Branches,
    
    Queue: Queue,
    
    POS: POS,
    
    Employees: Employees,
    
    Packages: Packages,
    
    Inventory: Inventory,
    
    Reports: Reports,
    
    Settings: Settings,
    
    Bookings: Bookings,
    
    AccountingDashboard: AccountingDashboard,
    
    ChartOfAccounts: ChartOfAccounts,
    
    Invoices: Invoices,
    
    Payments: Payments,
    
    Expenses: Expenses,
    
    InventoryReports: InventoryReports,
    
    Dashboard: Dashboard,
    
    Suppliers: Suppliers,
    
    PurchaseOrders: PurchaseOrders,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Customers />} />
                
                
                <Route path="/Customers" element={<Customers />} />
                
                <Route path="/Vehicles" element={<Vehicles />} />
                
                <Route path="/Services" element={<Services />} />
                
                <Route path="/Products" element={<Products />} />
                
                <Route path="/Branches" element={<Branches />} />
                
                <Route path="/Queue" element={<Queue />} />
                
                <Route path="/POS" element={<POS />} />
                
                <Route path="/Employees" element={<Employees />} />
                
                <Route path="/Packages" element={<Packages />} />
                
                <Route path="/Inventory" element={<Inventory />} />
                
                <Route path="/Reports" element={<Reports />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/Bookings" element={<Bookings />} />
                
                <Route path="/AccountingDashboard" element={<AccountingDashboard />} />
                
                <Route path="/ChartOfAccounts" element={<ChartOfAccounts />} />
                
                <Route path="/Invoices" element={<Invoices />} />
                
                <Route path="/Payments" element={<Payments />} />
                
                <Route path="/Expenses" element={<Expenses />} />
                
                <Route path="/InventoryReports" element={<InventoryReports />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Suppliers" element={<Suppliers />} />
                
                <Route path="/PurchaseOrders" element={<PurchaseOrders />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}