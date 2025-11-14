import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PieChart, Plus, Search, Edit, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function ChartOfAccountsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [filterType, setFilterType] = useState("all");

  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['accounts']);
      setShowDialog(false);
      setEditingAccount(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Account.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['accounts']);
      setShowDialog(false);
      setEditingAccount(null);
    },
  });

  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset',
    account_subtype: 'current_asset',
    description: '',
    normal_balance: 'debit',
    is_active: true,
    tax_applicable: false
  });

  const handleOpenDialog = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData(account);
    } else {
      setEditingAccount(null);
      setFormData({
        account_code: '',
        account_name: '',
        account_type: 'asset',
        account_subtype: 'current_asset',
        description: '',
        normal_balance: 'debit',
        is_active: true,
        tax_applicable: false,
        current_balance: 0
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredAccounts = accounts.filter(a => {
    const matchesSearch = 
      a.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.account_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || a.account_type === filterType;
    return matchesSearch && matchesType;
  });

  // Group accounts by type
  const groupedAccounts = filteredAccounts.reduce((acc, account) => {
    const type = account.account_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {});

  const typeColors = {
    asset: 'bg-blue-100 text-blue-700 border-blue-200',
    liability: 'bg-red-100 text-red-700 border-red-200',
    equity: 'bg-purple-100 text-purple-700 border-purple-200',
    revenue: 'bg-green-100 text-green-700 border-green-200',
    expense: 'bg-orange-100 text-orange-700 border-orange-200',
    cogs: 'bg-yellow-100 text-yellow-700 border-yellow-200'
  };

  const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense', 'cogs'];

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <PieChart className="w-8 h-8 text-blue-600" />
              Chart of Accounts
            </h1>
            <p className="text-slate-500 mt-1">Manage your accounting structure</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="asset">Assets</SelectItem>
                  <SelectItem value="liability">Liabilities</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                  <SelectItem value="cogs">COGS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Accounts by Type */}
        {accountTypes.map(type => {
          const typeAccounts = groupedAccounts[type] || [];
          if (typeAccounts.length === 0) return null;

          const totalBalance = typeAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

          return (
            <Card key={type} className="border-none shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="capitalize flex items-center gap-2">
                    <Badge variant="outline" className={typeColors[type]}>
                      {type}
                    </Badge>
                    <span>{typeAccounts.length} accounts</span>
                  </CardTitle>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Total Balance</p>
                    <p className="text-xl font-bold text-slate-900">${totalBalance.toFixed(2)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {typeAccounts.map(account => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer group"
                      onClick={() => handleOpenDialog(account)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-slate-500">{account.account_code}</span>
                          <span className="font-medium">{account.account_name}</span>
                          {!account.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {account.description && (
                          <p className="text-sm text-slate-500 mt-1">{account.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">${(account.current_balance || 0).toFixed(2)}</p>
                          <p className="text-xs text-slate-500">{account.normal_balance}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(account);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredAccounts.length === 0 && (
          <Card className="border-none shadow-lg">
            <CardContent className="text-center py-12">
              <PieChart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No accounts found</p>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Account
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Account Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Account Code *</Label>
                <Input
                  value={formData.account_code}
                  onChange={(e) => setFormData({...formData, account_code: e.target.value})}
                  placeholder="e.g., 1000"
                  required
                />
              </div>

              <div>
                <Label>Account Name *</Label>
                <Input
                  value={formData.account_name}
                  onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                  placeholder="Account name"
                  required
                />
              </div>

              <div>
                <Label>Account Type *</Label>
                <Select 
                  value={formData.account_type} 
                  onValueChange={(value) => setFormData({...formData, account_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="cogs">Cost of Goods Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Account Subtype</Label>
                <Select 
                  value={formData.account_subtype} 
                  onValueChange={(value) => setFormData({...formData, account_subtype: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_asset">Current Asset</SelectItem>
                    <SelectItem value="fixed_asset">Fixed Asset</SelectItem>
                    <SelectItem value="current_liability">Current Liability</SelectItem>
                    <SelectItem value="long_term_liability">Long-term Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="operating_expense">Operating Expense</SelectItem>
                    <SelectItem value="cost_of_goods_sold">Cost of Goods Sold</SelectItem>
                    <SelectItem value="other_income">Other Income</SelectItem>
                    <SelectItem value="other_expense">Other Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Normal Balance *</Label>
                <Select 
                  value={formData.normal_balance} 
                  onValueChange={(value) => setFormData({...formData, normal_balance: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Is Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
              </div>

              <div className="flex items-center justify-between md:col-span-2">
                <Label>Tax Applicable</Label>
                <Switch
                  checked={formData.tax_applicable}
                  onCheckedChange={(checked) => setFormData({...formData, tax_applicable: checked})}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Account description..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                {editingAccount ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}