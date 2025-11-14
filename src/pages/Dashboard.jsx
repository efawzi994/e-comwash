
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import {
  TrendingUp,
  Users,
  Car,
  DollarSign,
  Calendar,
  Clock,
  Package,
  AlertCircle
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function DashboardPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // Fetch all data
  const { data: washTickets = [] } = useQuery({
    queryKey: ['washTickets'],
    queryFn: () => base44.entities.WashTicket.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date', 200),
  });

  // Filter data by date range
  const filteredTickets = washTickets.filter(t => {
    if (!t.created_date) return false;
    const date = new Date(t.created_date);
    return date >= new Date(dateRange.from) && date <= new Date(dateRange.to);
  });

  // Calculate metrics
  const totalRevenue = filteredTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const completedTickets = filteredTickets.filter(t => t.status === 'delivered').length;
  const activeCustomers = new Set(filteredTickets.map(t => t.customer_id).filter(Boolean)).size;
  const avgTicketValue = completedTickets > 0 ? totalRevenue / completedTickets : 0;

  // Low stock products
  const lowStockProducts = products.filter(p => 
    p.current_stock <= p.min_stock_level && p.min_stock_level > 0
  );

  // Revenue trend (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const revenueTrend = last7Days.map(date => {
    const dayTickets = washTickets.filter(t => {
      if (!t.created_date) return false;
      const ticketDate = new Date(t.created_date);
      return ticketDate.toDateString() === date.toDateString();
    });
    return {
      date: format(date, 'MMM d'),
      revenue: dayTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0),
      tickets: dayTickets.length
    };
  });

  // Service distribution
  const serviceStats = {};
  filteredTickets.forEach(ticket => {
    ticket.services?.forEach(service => {
      if (!serviceStats[service.service_name]) {
        serviceStats[service.service_name] = { name: service.service_name, count: 0, revenue: 0 };
      }
      serviceStats[service.service_name].count += 1;
      serviceStats[service.service_name].revenue += service.price || 0;
    });
  });

  const serviceData = Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Status distribution
  const statusData = [
    { name: 'Completed', value: filteredTickets.filter(t => t.status === 'delivered').length, color: '#10b981' },
    { name: 'In Progress', value: filteredTickets.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Queue', value: filteredTickets.filter(t => t.status === 'queue').length, color: '#f59e0b' },
    { name: 'Quality Check', value: filteredTickets.filter(t => t.status === 'quality_check').length, color: '#8b5cf6' },
  ].filter(item => item.value > 0);

  // Upcoming bookings
  const upcomingBookings = bookings.filter(b => {
    if (b.status === 'cancelled') return false;
    const bookingDate = new Date(b.booking_date);
    return bookingDate >= new Date();
  }).slice(0, 5);

  return (
    <div className="p-6 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome to E-COMWash ERP System</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm opacity-90">Total Revenue</p>
                  <p className="text-3xl font-bold mt-2">{formatCurrency(totalRevenue, currency)}</p>
                  <p className="text-xs opacity-75 mt-1">{completedTickets} completed tickets</p>
                </div>
                <DollarSign className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm opacity-90">Active Customers</p>
                  <p className="text-3xl font-bold mt-2">{activeCustomers}</p>
                  <p className="text-xs opacity-75 mt-1">Total: {customers.length}</p>
                </div>
                <Users className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm opacity-90">Avg Ticket Value</p>
                  <p className="text-3xl font-bold mt-2">{formatCurrency(avgTicketValue, currency)}</p>
                  <p className="text-xs opacity-75 mt-1">Per completed wash</p>
                </div>
                <TrendingUp className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm opacity-90">Low Stock Items</p>
                  <p className="text-3xl font-bold mt-2">{lowStockProducts.length}</p>
                  <p className="text-xs opacity-75 mt-1">Need reorder</p>
                </div>
                <AlertCircle className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value, currency) : value,
                      name === 'revenue' ? 'Revenue' : 'Tickets'
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                  <Line type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={2} name="Tickets" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Ticket Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Services */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Top 5 Services by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(value, currency) : value,
                    name === 'revenue' ? 'Revenue' : 'Count'
                  ]}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="count" fill="#3b82f6" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming Bookings & Low Stock Alerts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Bookings */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Upcoming Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingBookings.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No upcoming bookings</p>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <div key={booking.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{booking.customer_name}</p>
                        <p className="text-sm text-slate-500">{booking.plate_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{format(new Date(booking.booking_date), 'MMM d, yyyy')}</p>
                        <p className="text-xs text-slate-500">{booking.booking_time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-600" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-center text-slate-400 py-8">All products well stocked</p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div>
                        <p className="font-medium">{product.product_name}</p>
                        <p className="text-sm text-slate-500">Min: {product.min_stock_level} {product.uom}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-orange-100 text-orange-700">
                          {product.current_stock} {product.uom}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
