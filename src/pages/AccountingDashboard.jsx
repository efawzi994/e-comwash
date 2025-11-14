import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  FileText,
  CreditCard,
  AlertCircle,
  Calendar
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AccountingDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("current_month");

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const { data: journalEntries = [] } = useQuery({
    queryKey: ['journalEntries'],
    queryFn: () => base44.entities.JournalEntry.list('-created_date', 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 500),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 500),
  });

  // Calculate financial metrics
  const revenueAccounts = accounts.filter(a => a.account_type === 'revenue');
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense');
  const assetAccounts = accounts.filter(a => a.account_type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.account_type === 'liability');

  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const totalAssets = assetAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const outstandingInvoices = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status));
  const totalAccountsReceivable = outstandingInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0);

  const unpaidExpenses = expenses.filter(e => e.payment_status === 'unpaid');
  const totalAccountsPayable = unpaidExpenses.reduce((sum, e) => sum + (e.total_amount || 0), 0);

  const overdueInvoices = invoices.filter(i => 
    i.status === 'overdue' || 
    (i.status === 'sent' && new Date(i.due_date) < new Date())
  );

  // Last 6 months revenue/expense trend
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  });

  const monthlyData = last6Months.map(month => {
    const monthStr = format(month, 'yyyy-MM');
    const monthInvoices = invoices.filter(i => 
      i.invoice_date && i.invoice_date.startsWith(monthStr)
    );
    const monthExpenses = expenses.filter(e => 
      e.expense_date && e.expense_date.startsWith(monthStr)
    );

    return {
      month: format(month, 'MMM yyyy'),
      revenue: monthInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
      expenses: monthExpenses.reduce((sum, e) => sum + (e.total_amount || 0), 0)
    };
  });

  // Expense breakdown by category
  const expenseByCategory = expenses.reduce((acc, expense) => {
    const category = expense.expense_category || 'other';
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += expense.total_amount || 0;
    return acc;
  }, {});

  const expenseBreakdown = Object.entries(expenseByCategory).map(([category, amount]) => ({
    category: category.replace(/_/g, ' '),
    amount: amount
  })).sort((a, b) => b.amount - a.amount).slice(0, 8);

  // Recent transactions
  const recentTransactions = journalEntries
    .filter(je => je.status === 'posted')
    .slice(0, 10);

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <PieChart className="w-8 h-8 text-blue-600" />
              Accounting Dashboard
            </h1>
            <p className="text-slate-500 mt-1">Financial overview and insights</p>
          </div>
          <div className="flex gap-3">
            <Link to={createPageUrl('Invoices')}>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Create Invoice
              </button>
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <TrendingUp className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p>
              <p className="text-sm opacity-90">Total Revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <TrendingDown className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">${totalExpenses.toFixed(2)}</p>
              <p className="text-sm opacity-90">Total Expenses</p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} text-white border-none shadow-lg`}>
            <CardContent className="pt-6">
              <DollarSign className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">${netProfit.toFixed(2)}</p>
              <p className="text-sm opacity-90">Net Profit</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{outstandingInvoices.length}</p>
              <p className="text-sm opacity-90">Outstanding Invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Position */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">${totalAssets.toFixed(2)}</p>
              <p className="text-sm text-slate-500 mt-2">Total Assets</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Liabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">${totalLiabilities.toFixed(2)}</p>
              <p className="text-sm text-slate-500 mt-2">Total Liabilities</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Equity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">${(totalAssets - totalLiabilities).toFixed(2)}</p>
              <p className="text-sm text-slate-500 mt-2">Owner's Equity</p>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Receivable & Payable */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Accounts Receivable
                </span>
                <Link to={createPageUrl('Invoices')}>
                  <button className="text-sm text-blue-600 hover:underline">View All</button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Outstanding</span>
                  <span className="text-2xl font-bold text-blue-600">${totalAccountsReceivable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Overdue Invoices</span>
                  <span className="font-medium text-red-600">{overdueInvoices.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Total Outstanding</span>
                  <span className="font-medium">{outstandingInvoices.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  Accounts Payable
                </span>
                <Link to={createPageUrl('Expenses')}>
                  <button className="text-sm text-blue-600 hover:underline">View All</button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Outstanding</span>
                  <span className="text-2xl font-bold text-orange-600">${totalAccountsPayable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Unpaid Expenses</span>
                  <span className="font-medium text-red-600">{unpaidExpenses.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue vs Expenses Trend */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Revenue vs Expenses (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense Breakdown */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Expense Breakdown by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expenseBreakdown} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="category" type="category" width={100} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#8b5cf6" name="Amount" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Journal Entries</span>
              <Link to={createPageUrl('JournalEntries')}>
                <button className="text-sm text-blue-600 hover:underline">View All</button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                    <div>
                      <p className="font-medium">{entry.entry_number}</p>
                      <p className="text-sm text-slate-500">{entry.description}</p>
                      <p className="text-xs text-slate-400">
                        {entry.entry_date && format(new Date(entry.entry_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">${entry.total_debit?.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{entry.entry_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid md:grid-cols-4 gap-4">
          <Link to={createPageUrl('ChartOfAccounts')}>
            <Card className="border-none shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="pt-6 text-center">
                <PieChart className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="font-medium">Chart of Accounts</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('Invoices')}>
            <Card className="border-none shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="pt-6 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="font-medium">Invoices</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('Payments')}>
            <Card className="border-none shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="pt-6 text-center">
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="font-medium">Payments</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('Expenses')}>
            <Card className="border-none shadow-lg hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-red-50 to-red-100">
              <CardContent className="pt-6 text-center">
                <TrendingDown className="w-8 h-8 mx-auto mb-2 text-red-600" />
                <p className="font-medium">Expenses</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}