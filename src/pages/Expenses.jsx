import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown, Plus, Search, Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";

export default function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 500),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['expenses']);
      setShowDialog(false);
    },
  });

  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expense_category: 'other',
    vendor_name: '',
    branch_id: '',
    employee_id: '',
    description: '',
    amount: 0,
    tax_amount: 0,
    payment_method: 'cash',
    payment_status: 'unpaid',
    notes: ''
  });

  const handleOpenDialog = () => {
    setFormData({
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      expense_category: 'other',
      vendor_name: '',
      branch_id: '',
      employee_id: '',
      description: '',
      amount: 0,
      tax_amount: 0,
      payment_method: 'cash',
      payment_status: 'unpaid',
      notes: ''
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const branch = branches.find(b => b.id === formData.branch_id);
    const employee = employees.find(e => e.id === formData.employee_id);
    
    const expenseData = {
      expense_number: `EXP-${Date.now()}`,
      expense_date: formData.expense_date,
      expense_category: formData.expense_category,
      vendor_name: formData.vendor_name,
      branch_id: formData.branch_id || null,
      branch_name: branch?.branch_name || null,
      employee_id: formData.employee_id || null,
      employee_name: employee?.full_name || null,
      description: formData.description,
      amount: parseFloat(formData.amount),
      tax_amount: parseFloat(formData.tax_amount),
      total_amount: parseFloat(formData.amount) + parseFloat(formData.tax_amount),
      payment_method: formData.payment_method,
      payment_status: formData.payment_status,
      paid_date: formData.payment_status === 'paid' ? formData.expense_date : null,
      notes: formData.notes,
      is_recurring: false
    };
    
    createMutation.mutate(expenseData);
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      exp.expense_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || exp.expense_category === filterCategory;
    const matchesStatus = filterStatus === 'all' || exp.payment_status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const statusColors = {
    unpaid: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700'
  };

  const categoryColors = {
    salaries: 'bg-blue-100 text-blue-700',
    utilities: 'bg-purple-100 text-purple-700',
    rent: 'bg-orange-100 text-orange-700',
    supplies: 'bg-green-100 text-green-700',
    maintenance: 'bg-red-100 text-red-700',
    marketing: 'bg-pink-100 text-pink-700',
    insurance: 'bg-indigo-100 text-indigo-700',
    taxes: 'bg-yellow-100 text-yellow-700',
    fuel: 'bg-amber-100 text-amber-700',
    equipment: 'bg-cyan-100 text-cyan-700',
    other: 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <TrendingDown className="w-8 h-8 text-blue-600" />
              Expenses
            </h1>
            <p className="text-slate-500 mt-1">Track and manage business expenses</p>
          </div>
          <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <TrendingDown className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                ${expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0).toFixed(2)}
              </p>
              <p className="text-sm opacity-90">Total Expenses</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <TrendingDown className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                ${expenses.filter(e => e.payment_status === 'paid').reduce((sum, e) => sum + (e.total_amount || 0), 0).toFixed(2)}
              </p>
              <p className="text-sm opacity-90">Paid</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <TrendingDown className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                ${expenses.filter(e => e.payment_status === 'unpaid').reduce((sum, e) => sum + (e.total_amount || 0), 0).toFixed(2)}
              </p>
              <p className="text-sm opacity-90">Unpaid</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{expenses.length}</p>
              <p className="text-sm opacity-90">Total Records</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="salaries">Salaries</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="supplies">Supplies</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="taxes">Taxes</SelectItem>
                  <SelectItem value="fuel">Fuel</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <TrendingDown className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>No expenses found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExpenses.map(expense => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold">{expense.expense_number}</p>
                        <Badge className={categoryColors[expense.expense_category]}>
                          {expense.expense_category?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {expense.vendor_name || 'N/A'}
                        {expense.description && ` • ${expense.description}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {expense.expense_date && format(parseISO(expense.expense_date), 'MMM d, yyyy')}
                        {expense.branch_name && ` • ${expense.branch_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={statusColors[expense.payment_status]}>
                        {expense.payment_status}
                      </Badge>
                      <p className="text-lg font-bold text-red-600 mt-1">
                        ${expense.total_amount?.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {expense.payment_method?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Expense Date *</Label>
                <Input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.expense_category}
                  onValueChange={(value) => setFormData({...formData, expense_category: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salaries">Salaries</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="supplies">Supplies</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="taxes">Taxes</SelectItem>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Vendor/Supplier</Label>
                <Input
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({...formData, vendor_name: e.target.value})}
                  placeholder="Vendor name"
                />
              </div>

              <div>
                <Label>Branch</Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => setFormData({...formData, branch_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Employee</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({...formData, employee_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Tax Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({...formData, tax_amount: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({...formData, payment_method: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="account_payable">Account Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payment Status *</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) => setFormData({...formData, payment_status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Expense description"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Amount:</span>
                <span className="text-2xl font-bold text-red-600">
                  ${((parseFloat(formData.amount) || 0) + (parseFloat(formData.tax_amount) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Add Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}