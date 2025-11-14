import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Printer, TrendingUp, Users, Package, DollarSign, Calendar, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToCSV } from "@/components/ReportExporter";

export default function ReportsPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [filters, setFilters] = useState({
    branch: 'all',
    employee: 'all',
    service: 'all',
    customer: 'all',
    product: 'all'
  });

  // Fetch all data
  const { data: washTickets = [] } = useQuery({
    queryKey: ['washTickets'],
    queryFn: () => base44.entities.WashTicket.list('-created_date', 1000),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date', 1000),
  });

  const { data: customerPackages = [] } = useQuery({
    queryKey: ['customerPackages'],
    queryFn: () => base44.entities.CustomerPackage.list(),
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => base44.entities.StockMovement.list('-movement_date', 1000),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 1000),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-expense_date', 1000),
  });

  const { data: costLayers = [] } = useQuery({
    queryKey: ['costLayers'],
    queryFn: () => base44.entities.CostLayer.list(),
  });

  // Filter data by date range and filters
  const filteredTickets = washTickets.filter(t => {
    if (!t.created_date) return false;
    const date = new Date(t.created_date);
    const matchesDate = date >= new Date(dateRange.from) && date <= new Date(dateRange.to);
    const matchesBranch = filters.branch === 'all' || t.branch_id === filters.branch;
    const matchesEmployee = filters.employee === 'all' || t.assigned_employee_id === filters.employee;
    return matchesDate && matchesBranch && matchesEmployee;
  });

  // ===== CALCULATE COST OF GOODS SOLD (COGS) =====
  const calculateCOGS = () => {
    // Get all consumption and sale movements
    const consumptionMovements = stockMovements.filter(m => {
      if (!m.movement_date) return false;
      const date = new Date(m.movement_date);
      return date >= new Date(dateRange.from) && 
             date <= new Date(dateRange.to) &&
             (m.movement_type === 'consumption' || m.movement_type === 'sale');
    });

    return consumptionMovements.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  };

  const totalCOGS = calculateCOGS();

  // Calculate COGS by service
  const cogsByService = {};
  filteredTickets.forEach(ticket => {
    ticket.services?.forEach(service => {
      if (!cogsByService[service.service_name]) {
        cogsByService[service.service_name] = { 
          name: service.service_name, 
          revenue: 0, 
          count: 0,
          cogs: 0,
          grossProfit: 0
        };
      }
      
      const serviceCost = services.find(s => s.id === service.service_id)?.cost || 0;
      cogsByService[service.service_name].revenue += service.price || 0;
      cogsByService[service.service_name].count += 1;
      cogsByService[service.service_name].cogs += serviceCost;
      cogsByService[service.service_name].grossProfit += (service.price || 0) - serviceCost;
    });
  });

  // Calculate COGS by product
  const cogsByProduct = {};
  filteredTickets.forEach(ticket => {
    ticket.products?.forEach(product => {
      if (!cogsByProduct[product.product_name]) {
        cogsByProduct[product.product_name] = { 
          name: product.product_name, 
          revenue: 0, 
          quantity: 0,
          cogs: 0,
          grossProfit: 0
        };
      }
      
      const productData = products.find(p => p.id === product.product_id);
      const unitCost = productData?.cost_price || 0;
      const qty = product.quantity || 0;
      
      cogsByProduct[product.product_name].revenue += (product.price * qty) || 0;
      cogsByProduct[product.product_name].quantity += qty;
      cogsByProduct[product.product_name].cogs += unitCost * qty;
      cogsByProduct[product.product_name].grossProfit += ((product.price || 0) - unitCost) * qty;
    });
  });

  // ===== SALES REPORTS WITH COGS =====
  const salesByDate = {};
  filteredTickets.forEach(ticket => {
    const date = format(new Date(ticket.created_date), 'yyyy-MM-dd');
    if (!salesByDate[date]) {
      salesByDate[date] = { date, revenue: 0, cogs: 0, grossProfit: 0, tickets: 0 };
    }
    
    // Calculate ticket COGS
    let ticketCOGS = 0;
    ticket.services?.forEach(s => {
      const serviceCost = services.find(srv => srv.id === s.service_id)?.cost || 0;
      ticketCOGS += serviceCost;
    });
    ticket.products?.forEach(p => {
      const productCost = products.find(prod => prod.id === p.product_id)?.cost_price || 0;
      ticketCOGS += productCost * (p.quantity || 0);
    });

    salesByDate[date].revenue += ticket.total_amount || 0;
    salesByDate[date].cogs += ticketCOGS;
    salesByDate[date].grossProfit += (ticket.total_amount || 0) - ticketCOGS;
    salesByDate[date].tickets += 1;
  });

  const salesChartData = Object.values(salesByDate).sort((a, b) => a.date.localeCompare(b.date));

  const salesByEmployee = {};
  filteredTickets.forEach(ticket => {
    const empName = ticket.assigned_employee_name || 'Unassigned';
    if (!salesByEmployee[empName]) {
      salesByEmployee[empName] = { name: empName, revenue: 0, tickets: 0, cogs: 0, grossProfit: 0 };
    }
    
    let ticketCOGS = 0;
    ticket.services?.forEach(s => {
      const serviceCost = services.find(srv => srv.id === s.service_id)?.cost || 0;
      ticketCOGS += serviceCost;
    });
    ticket.products?.forEach(p => {
      const productCost = products.find(prod => prod.id === p.product_id)?.cost_price || 0;
      ticketCOGS += productCost * (p.quantity || 0);
    });

    salesByEmployee[empName].revenue += ticket.total_amount || 0;
    salesByEmployee[empName].tickets += 1;
    salesByEmployee[empName].cogs += ticketCOGS;
    salesByEmployee[empName].grossProfit += (ticket.total_amount || 0) - ticketCOGS;
  });

  const totalRevenue = filteredTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const completedTickets = filteredTickets.filter(t => t.status === 'delivered').length;
  const avgTicketValue = completedTickets > 0 ? totalRevenue / completedTickets : 0;

  // ===== CUSTOMER REPORTS =====
  const customerStats = customers.map(customer => {
    const customerTickets = washTickets.filter(t => t.customer_id === customer.id);
    const customerBookings = bookings.filter(b => b.customer_id === customer.id);
    const customerPackage = customerPackages.find(cp => cp.customer_id === customer.id && cp.status === 'active');
    
    return {
      ...customer,
      total_visits: customerTickets.length,
      total_spent: customerTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0),
      total_bookings: customerBookings.length,
      last_visit: customerTickets[0]?.created_date,
      active_package: customerPackage?.package_name
    };
  }).sort((a, b) => b.total_spent - a.total_spent);

  // ===== INVENTORY REPORTS =====
  const lowStockProducts = products.filter(p => 
    p.current_stock <= p.min_stock_level && p.min_stock_level > 0
  );

  const totalInventoryValue = products.reduce((sum, p) => {
    const productLayers = costLayers.filter(
      l => l.product_id === p.id && l.status === 'active' && l.quantity_remaining > 0
    );
    const totalCost = productLayers.reduce((s, l) => s + l.total_cost, 0);
    return sum + totalCost;
  }, 0);

  const filteredMovements = stockMovements.filter(m => {
    if (!m.movement_date) return false;
    const date = new Date(m.movement_date);
    return date >= new Date(dateRange.from) && date <= new Date(dateRange.to);
  });

  const movementsByType = {
    purchase: filteredMovements.filter(m => m.movement_type === 'purchase'),
    sale: filteredMovements.filter(m => m.movement_type === 'sale'),
    adjustment: filteredMovements.filter(m => m.movement_type === 'adjustment'),
    return: filteredMovements.filter(m => m.movement_type === 'return'),
    consumption: filteredMovements.filter(m => m.movement_type === 'consumption'),
  };

  // ===== ENHANCED FINANCIAL REPORTS WITH COGS =====
  const filteredInvoices = invoices.filter(inv => {
    if (!inv.invoice_date) return false;
    const date = new Date(inv.invoice_date);
    return date >= new Date(dateRange.from) && date <= new Date(dateRange.to);
  });

  const filteredExpenses = expenses.filter(exp => {
    if (!exp.expense_date) return false;
    const date = new Date(exp.expense_date);
    return date >= new Date(dateRange.from) && date <= new Date(dateRange.to);
  });

  const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = filteredInvoices.filter(inv => inv.payment_status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const accountsReceivable = totalInvoiced - totalPaid;
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // Enhanced P&L with COGS
  const grossProfit = totalRevenue - totalCOGS;
  const operatingProfit = grossProfit - totalExpenses;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const operatingProfitMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;

  const expensesByCategory = {};
  filteredExpenses.forEach(exp => {
    if (!expensesByCategory[exp.category]) {
      expensesByCategory[exp.category] = { category: exp.category, amount: 0 };
    }
    expensesByCategory[exp.category].amount += exp.amount || 0;
  });

  const handlePrint = () => {
    window.print();
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-6 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Comprehensive Reports
            </h1>
            <p className="text-slate-500 mt-1">Detailed analytics with COGS tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                />
              </div>
              <div>
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                />
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={filters.branch} onValueChange={(v) => setFilters({ ...filters, branch: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employee</Label>
                <Select value={filters.employee} onValueChange={(v) => setFilters({ ...filters, employee: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <TrendingUp className="w-8 h-8 mb-2" />
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue, currency)}</p>
              <p className="text-sm opacity-90">Total Revenue</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="pt-6">
              <Package className="w-8 h-8 mb-2" />
              <p className="text-2xl font-bold">{formatCurrency(totalCOGS, currency)}</p>
              <p className="text-sm opacity-90">Cost of Goods Sold</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <DollarSign className="w-8 h-8 mb-2" />
              <p className="text-2xl font-bold">{formatCurrency(grossProfit, currency)}</p>
              <p className="text-sm opacity-90">Gross Profit ({grossProfitMargin.toFixed(1)}%)</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <Users className="w-8 h-8 mb-2" />
              <p className="text-2xl font-bold">{completedTickets}</p>
              <p className="text-sm opacity-90">Completed Tickets</p>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="sales">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Sales with COGS</TabsTrigger>
            <TabsTrigger value="customers">Customer Reports</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Reports</TabsTrigger>
            <TabsTrigger value="financial">P&L Statement</TabsTrigger>
          </TabsList>

          {/* SALES REPORTS WITH COGS */}
          <TabsContent value="sales" className="space-y-6 mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sales & Profitability Trend</CardTitle>
                <Button size="sm" onClick={() => exportToCSV(salesChartData, 'sales_profitability')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [formatCurrency(value, currency), name]} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="cogs" stroke="#ef4444" strokeWidth={2} name="COGS" />
                    <Line type="monotone" dataKey="grossProfit" stroke="#10b981" strokeWidth={2} name="Gross Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Service Profitability Analysis</CardTitle>
                  <Button size="sm" onClick={() => exportToCSV(Object.values(cogsByService), 'service_profitability')}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Service</th>
                          <th className="text-right py-2">Count</th>
                          <th className="text-right py-2">Revenue</th>
                          <th className="text-right py-2">COGS</th>
                          <th className="text-right py-2">Profit</th>
                          <th className="text-right py-2">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(cogsByService).sort((a, b) => b.grossProfit - a.grossProfit).map((s, i) => {
                          const margin = s.revenue > 0 ? ((s.grossProfit / s.revenue) * 100) : 0;
                          return (
                            <tr key={i} className="border-b hover:bg-slate-50">
                              <td className="py-2">{s.name}</td>
                              <td className="text-right py-2">{s.count}</td>
                              <td className="text-right py-2">{formatCurrency(s.revenue, currency)}</td>
                              <td className="text-right py-2 text-red-600">{formatCurrency(s.cogs, currency)}</td>
                              <td className="text-right py-2 font-bold text-green-600">{formatCurrency(s.grossProfit, currency)}</td>
                              <td className="text-right py-2">{margin.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Product Profitability</CardTitle>
                  <Button size="sm" onClick={() => exportToCSV(Object.values(cogsByProduct), 'product_profitability')}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Product</th>
                          <th className="text-right py-2">Qty</th>
                          <th className="text-right py-2">Revenue</th>
                          <th className="text-right py-2">COGS</th>
                          <th className="text-right py-2">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(cogsByProduct).sort((a, b) => b.grossProfit - a.grossProfit).map((p, i) => (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="py-2">{p.name}</td>
                            <td className="text-right py-2">{p.quantity}</td>
                            <td className="text-right py-2">{formatCurrency(p.revenue, currency)}</td>
                            <td className="text-right py-2 text-red-600">{formatCurrency(p.cogs, currency)}</td>
                            <td className="text-right py-2 font-bold text-green-600">{formatCurrency(p.grossProfit, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Employee Performance with Profitability</CardTitle>
                <Button size="sm" onClick={() => exportToCSV(Object.values(salesByEmployee), 'employee_performance')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Employee</th>
                        <th className="text-right py-2">Tickets</th>
                        <th className="text-right py-2">Revenue</th>
                        <th className="text-right py-2">COGS</th>
                        <th className="text-right py-2">Gross Profit</th>
                        <th className="text-right py-2">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(salesByEmployee).sort((a, b) => b.revenue - a.revenue).map((emp, i) => {
                        const margin = emp.revenue > 0 ? ((emp.grossProfit / emp.revenue) * 100) : 0;
                        return (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="py-2 font-medium">{emp.name}</td>
                            <td className="text-right py-2">{emp.tickets}</td>
                            <td className="text-right py-2">{formatCurrency(emp.revenue, currency)}</td>
                            <td className="text-right py-2 text-red-600">{formatCurrency(emp.cogs, currency)}</td>
                            <td className="text-right py-2 font-bold text-green-600">{formatCurrency(emp.grossProfit, currency)}</td>
                            <td className="text-right py-2">{margin.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CUSTOMER REPORTS */}
          <TabsContent value="customers" className="space-y-6 mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Top Customers by Revenue</CardTitle>
                <Button size="sm" onClick={() => exportToCSV(customerStats, 'customer_report')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Customer</th>
                        <th className="text-center py-2">Type</th>
                        <th className="text-right py-2">Total Visits</th>
                        <th className="text-right py-2">Total Spent</th>
                        <th className="text-right py-2">Bookings</th>
                        <th className="text-center py-2">Active Package</th>
                        <th className="text-right py-2">Last Visit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerStats.slice(0, 50).map((customer, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-2">{customer.name}</td>
                          <td className="text-center py-2">
                            <Badge variant="outline" className={
                              customer.customer_type === 'corporate' 
                                ? 'bg-purple-50 text-purple-700' 
                                : 'bg-blue-50 text-blue-700'
                            }>
                              {customer.customer_type}
                            </Badge>
                          </td>
                          <td className="text-right py-2">{customer.total_visits}</td>
                          <td className="text-right py-2 font-bold text-green-600">
                            {formatCurrency(customer.total_spent, currency)}
                          </td>
                          <td className="text-right py-2">{customer.total_bookings}</td>
                          <td className="text-center py-2">
                            {customer.active_package ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                {customer.active_package}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-xs">None</span>
                            )}
                          </td>
                          <td className="text-right py-2 text-sm text-slate-600">
                            {customer.last_visit ? format(new Date(customer.last_visit), 'MMM d, yyyy') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Customer Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Retail', value: customers.filter(c => c.customer_type === 'retail').length },
                          { name: 'Corporate', value: customers.filter(c => c.customer_type === 'corporate').length }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Package Status Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-slate-50 rounded">
                      <span>Total Packages Sold</span>
                      <span className="font-bold">{customerPackages.length}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-green-50 rounded">
                      <span>Active Packages</span>
                      <span className="font-bold text-green-600">
                        {customerPackages.filter(cp => cp.status === 'active').length}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-red-50 rounded">
                      <span>Expired Packages</span>
                      <span className="font-bold text-red-600">
                        {customerPackages.filter(cp => cp.status === 'expired').length}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-blue-50 rounded">
                      <span>Package Revenue</span>
                      <span className="font-bold text-blue-600">
                        {formatCurrency(customerPackages.reduce((sum, cp) => sum + (cp.amount_paid || 0), 0), currency)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* INVENTORY REPORTS */}
          <TabsContent value="inventory" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-none shadow-lg">
                <CardContent className="pt-6">
                  <Package className="w-8 h-8 text-blue-600 mb-2" />
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-sm text-slate-600">Total Products</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardContent className="pt-6">
                  <Package className="w-8 h-8 text-orange-600 mb-2" />
                  <p className="text-2xl font-bold">{lowStockProducts.length}</p>
                  <p className="text-sm text-slate-600">Low Stock Items</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardContent className="pt-6">
                  <DollarSign className="w-8 h-8 text-green-600 mb-2" />
                  <p className="text-2xl font-bold">{formatCurrency(totalInventoryValue, currency)}</p>
                  <p className="text-sm text-slate-600">Inventory Value (FIFO)</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Low Stock Alerts</CardTitle>
                <Button size="sm" onClick={() => exportToCSV(lowStockProducts, 'low_stock_products')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">All products are well stocked</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Product</th>
                          <th className="text-right py-2">Current Stock</th>
                          <th className="text-right py-2">Min Level</th>
                          <th className="text-right py-2">Reorder Qty</th>
                          <th className="text-center py-2">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockProducts.map((product, i) => {
                          const isCritical = product.current_stock <= (product.min_stock_level * 0.5);
                          return (
                            <tr key={i} className="border-b hover:bg-slate-50">
                              <td className="py-2">{product.product_name}</td>
                              <td className="text-right py-2 font-bold text-orange-600">
                                {product.current_stock} {product.uom}
                              </td>
                              <td className="text-right py-2">{product.min_stock_level} {product.uom}</td>
                              <td className="text-right py-2">{product.reorder_quantity} {product.uom}</td>
                              <td className="text-center py-2">
                                <Badge className={isCritical ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                                  {isCritical ? 'Critical' : 'Low'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Stock Movements by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{movementsByType.purchase.length}</p>
                    <p className="text-sm text-slate-600">Purchases</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{movementsByType.sale.length}</p>
                    <p className="text-sm text-slate-600">Sales</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{movementsByType.consumption.length}</p>
                    <p className="text-sm text-slate-600">Consumption</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{movementsByType.adjustment.length}</p>
                    <p className="text-sm text-slate-600">Adjustments</p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-2xl font-bold text-indigo-600">{movementsByType.return.length}</p>
                    <p className="text-sm text-slate-600">Returns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENHANCED FINANCIAL REPORTS WITH COGS */}
          <TabsContent value="financial" className="space-y-6 mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Profit & Loss Statement (with COGS)</CardTitle>
                <Button size="sm" onClick={() => exportToCSV([{
                  revenue: totalRevenue,
                  cogs: totalCOGS,
                  gross_profit: grossProfit,
                  gross_margin: grossProfitMargin,
                  operating_expenses: totalExpenses,
                  operating_profit: operatingProfit,
                  operating_margin: operatingProfitMargin
                }], 'profit_loss_statement')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Revenue */}
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <span className="font-bold text-lg">Revenue</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalRevenue, currency)}
                    </span>
                  </div>

                  {/* COGS */}
                  <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                    <span className="font-medium">Cost of Goods Sold (COGS)</span>
                    <span className="text-xl font-bold text-red-600">
                      ({formatCurrency(totalCOGS, currency)})
                    </span>
                  </div>

                  {/* Gross Profit */}
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <div>
                      <span className="font-bold text-lg">Gross Profit</span>
                      <p className="text-sm text-slate-600">Gross Margin: {grossProfitMargin.toFixed(1)}%</p>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(grossProfit, currency)}
                    </span>
                  </div>

                  {/* Operating Expenses */}
                  <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                    <span className="font-medium">Operating Expenses</span>
                    <span className="text-xl font-bold text-orange-600">
                      ({formatCurrency(totalExpenses, currency)})
                    </span>
                  </div>

                  {/* Operating Profit */}
                  <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                    <div>
                      <span className="font-bold text-lg">Operating Profit (EBIT)</span>
                      <p className="text-sm text-slate-600">Operating Margin: {operatingProfitMargin.toFixed(1)}%</p>
                    </div>
                    <span className={`text-3xl font-bold ${operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(operatingProfit, currency)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Operating Expenses Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.values(expensesByCategory)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {Object.values(expensesByCategory).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Accounts Receivable</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-slate-50 rounded">
                      <span>Total Invoiced</span>
                      <span className="font-bold">{formatCurrency(totalInvoiced, currency)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-green-50 rounded">
                      <span>Collected</span>
                      <span className="font-bold text-green-600">{formatCurrency(totalPaid, currency)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-orange-50 rounded">
                      <span>Outstanding (A/R)</span>
                      <span className="font-bold text-orange-600">{formatCurrency(accountsReceivable, currency)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-blue-50 rounded">
                      <span>Collection Rate</span>
                      <span className="font-bold text-blue-600">
                        {totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Cost Structure Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Revenue', amount: totalRevenue, color: '#3b82f6' },
                    { name: 'COGS', amount: totalCOGS, color: '#ef4444' },
                    { name: 'Gross Profit', amount: grossProfit, color: '#10b981' },
                    { name: 'Operating Expenses', amount: totalExpenses, color: '#f59e0b' },
                    { name: 'Operating Profit', amount: operatingProfit, color: '#8b5cf6' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                    <Bar dataKey="amount" fill="#3b82f6">
                      {[0, 1, 2, 3, 4].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Unpaid Invoices (Accounts Receivable)</CardTitle>
                <Button size="sm" onClick={() => exportToCSV(
                  filteredInvoices.filter(inv => inv.payment_status !== 'paid'), 
                  'accounts_receivable'
                )}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Invoice #</th>
                        <th className="text-left py-2">Customer</th>
                        <th className="text-right py-2">Date</th>
                        <th className="text-right py-2">Due Date</th>
                        <th className="text-right py-2">Amount</th>
                        <th className="text-right py-2">Days Overdue</th>
                        <th className="text-center py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.filter(inv => inv.payment_status !== 'paid').slice(0, 20).map((invoice, i) => {
                        const dueDate = new Date(invoice.due_date);
                        const today = new Date();
                        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="py-2">{invoice.invoice_number}</td>
                            <td className="py-2">{invoice.customer_name}</td>
                            <td className="text-right py-2">
                              {format(new Date(invoice.invoice_date), 'MMM d')}
                            </td>
                            <td className="text-right py-2">
                              {format(new Date(invoice.due_date), 'MMM d')}
                            </td>
                            <td className="text-right py-2 font-bold">
                              {formatCurrency(invoice.total_amount, currency)}
                            </td>
                            <td className="text-right py-2">
                              {daysOverdue > 0 ? (
                                <span className="text-red-600 font-bold">{daysOverdue}</span>
                              ) : (
                                <span className="text-green-600">-</span>
                              )}
                            </td>
                            <td className="text-center py-2">
                              <Badge className={
                                invoice.payment_status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                              }>
                                {invoice.payment_status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}