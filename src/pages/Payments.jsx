import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Plus, Search, CreditCard, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [filterType, setFilterType] = useState("all");

  const queryClient = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payment = await base44.entities.Payment.create(data);
      
      // Update invoice if payment is for an invoice
      if (data.invoice_id) {
        const invoice = invoices.find(i => i.id === data.invoice_id);
        if (invoice) {
          const newAmountPaid = (invoice.amount_paid || 0) + data.amount;
          const newBalanceDue = invoice.total_amount - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';
          
          await base44.entities.Invoice.update(invoice.id, {
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: newStatus,
            paid_date: newStatus === 'paid' ? new Date().toISOString() : null
          });
        }
      }
      
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['invoices']);
      setShowDialog(false);
    },
  });

  const [formData, setFormData] = useState({
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_type: 'customer_payment',
    payment_method: 'cash',
    customer_id: '',
    invoice_id: '',
    amount: 0,
    reference_number: '',
    notes: ''
  });

  const handleOpenDialog = () => {
    setFormData({
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      payment_type: 'customer_payment',
      payment_method: 'cash',
      customer_id: '',
      invoice_id: '',
      amount: 0,
      reference_number: '',
      notes: ''
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const customer = customers.find(c => c.id === formData.customer_id);
    const invoice = invoices.find(i => i.id === formData.invoice_id);
    
    const paymentData = {
      payment_number: `PAY-${Date.now()}`,
      payment_date: formData.payment_date,
      payment_type: formData.payment_type,
      payment_method: formData.payment_method,
      customer_id: formData.customer_id || null,
      customer_name: customer?.name || null,
      invoice_id: formData.invoice_id || null,
      invoice_number: invoice?.invoice_number || null,
      amount: parseFloat(formData.amount),
      reference_number: formData.reference_number,
      notes: formData.notes,
      status: 'cleared',
      reconciled: false
    };
    
    createMutation.mutate(paymentData);
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.payment_type === filterType;
    return matchesSearch && matchesType;
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    cleared: 'bg-green-100 text-green-700',
    bounced: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500'
  };

  const customerInvoices = formData.customer_id
    ? invoices.filter(i => i.customer_id === formData.customer_id && ['sent', 'partial', 'overdue'].includes(i.status))
    : [];

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-blue-600" />
              Payments
            </h1>
            <p className="text-slate-500 mt-1">Record and track payments</p>
          </div>
          <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Check className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                ${payments.filter(p => p.status === 'cleared').reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
              </p>
              <p className="text-sm opacity-90">Total Received</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <CreditCard className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{payments.filter(p => p.status === 'cleared').length}</p>
              <p className="text-sm opacity-90">Cleared Payments</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <DollarSign className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{payments.filter(p => !p.reconciled).length}</p>
              <p className="text-sm opacity-90">Unreconciled</p>
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
                  placeholder="Search payments..."
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
                  <SelectItem value="customer_payment">Customer Payment</SelectItem>
                  <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                  <SelectItem value="expense_payment">Expense Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>No payments found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map(payment => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-bold">{payment.payment_number}</p>
                      <p className="text-sm text-slate-600">
                        {payment.customer_name} 
                        {payment.invoice_number && ` • ${payment.invoice_number}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {payment.payment_date && format(parseISO(payment.payment_date), 'MMM d, yyyy')} • 
                        {' '}{payment.payment_method?.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={statusColors[payment.status]}>
                        {payment.status}
                      </Badge>
                      <p className="text-lg font-bold text-green-600 mt-1">
                        ${payment.amount?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Payment Type *</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) => setFormData({...formData, payment_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_payment">Customer Payment</SelectItem>
                    <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                    <SelectItem value="expense_payment">Expense Payment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
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

              {formData.payment_type === 'customer_payment' && (
                <>
                  <div>
                    <Label>Customer</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({...formData, customer_id: value, invoice_id: ''})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {customerInvoices.length > 0 && (
                    <div>
                      <Label>Invoice</Label>
                      <Select
                        value={formData.invoice_id}
                        onValueChange={(value) => {
                          const inv = customerInvoices.find(i => i.id === value);
                          setFormData({
                            ...formData, 
                            invoice_id: value,
                            amount: inv?.balance_due || 0
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                        <SelectContent>
                          {customerInvoices.map(i => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.invoice_number} - ${i.balance_due?.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>Reference Number</Label>
                <Input
                  value={formData.reference_number}
                  onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>

              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Payment notes..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}