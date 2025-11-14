import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Search, Eye, Mail, Download, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, parseISO } from "date-fns";

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: washTickets = [] } = useQuery({
    queryKey: ['washTickets'],
    queryFn: () => base44.entities.WashTicket.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: async (invoice) => {
      queryClient.invalidateQueries(['invoices']);
      
      // Send invoice email
      if (invoice.customer_email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: invoice.customer_email,
            subject: `Invoice ${invoice.invoice_number} from E-COMWash`,
            body: `Dear ${invoice.customer_name},\n\nPlease find your invoice attached.\n\nInvoice Number: ${invoice.invoice_number}\nInvoice Date: ${invoice.invoice_date}\nTotal Amount: $${invoice.total_amount}\nDue Date: ${invoice.due_date}\n\nThank you for your business!\n\nBest regards,\nE-COMWash Team`
          });
          
          await base44.entities.Invoice.update(invoice.id, { 
            status: 'sent',
            sent_date: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to send invoice email:', error);
        }
      }
      
      setShowDialog(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoices']);
      setShowDetailsDialog(false);
    },
  });

  const [formData, setFormData] = useState({
    customer_id: '',
    wash_ticket_id: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    payment_terms: 'due_on_receipt',
    line_items: [],
    notes: ''
  });

  const handleOpenDialog = () => {
    setFormData({
      customer_id: '',
      wash_ticket_id: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      payment_terms: 'due_on_receipt',
      line_items: [],
      notes: ''
    });
    setShowDialog(true);
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [...formData.line_items, {
        description: '',
        quantity: 1,
        unit_price: 0,
        amount: 0,
        tax_rate: 0,
        tax_amount: 0
      }]
    });
  };

  const updateLineItem = (index, field, value) => {
    const newLineItems = [...formData.line_items];
    newLineItems[index][field] = value;
    
    // Recalculate amounts
    if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
      const qty = parseFloat(newLineItems[index].quantity) || 0;
      const price = parseFloat(newLineItems[index].unit_price) || 0;
      const taxRate = parseFloat(newLineItems[index].tax_rate) || 0;
      
      newLineItems[index].amount = qty * price;
      newLineItems[index].tax_amount = (qty * price * taxRate) / 100;
    }
    
    setFormData({...formData, line_items: newLineItems});
  };

  const removeLineItem = (index) => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index)
    });
  };

  const handleLoadFromTicket = (ticketId) => {
    const ticket = washTickets.find(t => t.id === ticketId);
    if (ticket) {
      const lineItems = [];
      
      // Add services
      ticket.services?.forEach(service => {
        lineItems.push({
          description: service.service_name,
          quantity: 1,
          unit_price: service.price,
          amount: service.price,
          tax_rate: 0,
          tax_amount: 0
        });
      });
      
      // Add products
      ticket.products?.forEach(product => {
        lineItems.push({
          description: product.product_name,
          quantity: product.quantity,
          unit_price: product.price,
          amount: product.quantity * product.price,
          tax_rate: 0,
          tax_amount: 0
        });
      });
      
      setFormData({
        ...formData,
        customer_id: ticket.customer_id || '',
        wash_ticket_id: ticketId,
        line_items: lineItems
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const customer = customers.find(c => c.id === formData.customer_id);
    const ticket = washTickets.find(t => t.id === formData.wash_ticket_id);
    
    const subtotal = formData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmount = formData.line_items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
    const totalAmount = subtotal + taxAmount;
    
    const dueDate = formData.payment_terms === 'due_on_receipt' 
      ? formData.invoice_date
      : formData.payment_terms === 'net_7'
        ? format(addDays(new Date(formData.invoice_date), 7), 'yyyy-MM-dd')
        : formData.payment_terms === 'net_15'
          ? format(addDays(new Date(formData.invoice_date), 15), 'yyyy-MM-dd')
          : formData.payment_terms === 'net_30'
            ? format(addDays(new Date(formData.invoice_date), 30), 'yyyy-MM-dd')
            : format(addDays(new Date(formData.invoice_date), 60), 'yyyy-MM-dd');
    
    const invoiceData = {
      invoice_number: `INV-${Date.now()}`,
      invoice_date: formData.invoice_date,
      due_date: dueDate,
      customer_id: formData.customer_id,
      customer_name: customer?.name,
      customer_email: customer?.email,
      billing_address: customer?.address,
      wash_ticket_id: formData.wash_ticket_id || null,
      wash_ticket_number: ticket?.ticket_number || null,
      line_items: formData.line_items,
      subtotal: subtotal,
      tax_amount: taxAmount,
      discount_amount: 0,
      total_amount: totalAmount,
      amount_paid: 0,
      balance_due: totalAmount,
      status: 'draft',
      payment_terms: formData.payment_terms,
      notes: formData.notes
    };
    
    createMutation.mutate(invoiceData);
  };

  const handleMarkAsPaid = async (invoice) => {
    await updateMutation.mutateAsync({
      id: invoice.id,
      data: {
        status: 'paid',
        amount_paid: invoice.total_amount,
        balance_due: 0,
        paid_date: new Date().toISOString()
      }
    });
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-purple-100 text-purple-700',
    partial: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500'
  };

  const customerTickets = formData.customer_id
    ? washTickets.filter(t => t.customer_id === formData.customer_id && t.status === 'delivered')
    : [];

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Invoices
            </h1>
            <p className="text-slate-500 mt-1">Manage customer invoices and billing</p>
          </div>
          <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{invoices.filter(i => i.status === 'sent').length}</p>
              <p className="text-sm opacity-90">Sent</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{invoices.filter(i => i.status === 'paid').length}</p>
              <p className="text-sm opacity-90">Paid</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{invoices.filter(i => i.status === 'overdue').length}</p>
              <p className="text-sm opacity-90">Overdue</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                ${invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.balance_due || 0), 0).toFixed(2)}
              </p>
              <p className="text-sm opacity-90">Outstanding</p>
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
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>No invoices found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map(invoice => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setShowDetailsDialog(true);
                    }}
                  >
                    <div>
                      <p className="font-bold">{invoice.invoice_number}</p>
                      <p className="text-sm text-slate-600">{invoice.customer_name}</p>
                      <p className="text-xs text-slate-500">
                        Date: {invoice.invoice_date && format(parseISO(invoice.invoice_date), 'MMM d, yyyy')} • 
                        Due: {invoice.due_date && format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={statusColors[invoice.status]}>
                        {invoice.status}
                      </Badge>
                      <p className="text-lg font-bold text-green-600 mt-1">
                        ${invoice.total_amount?.toFixed(2)}
                      </p>
                      {invoice.balance_due > 0 && (
                        <p className="text-xs text-slate-500">
                          Balance: ${invoice.balance_due?.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({...formData, customer_id: value, wash_ticket_id: ''})}
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

              {customerTickets.length > 0 && (
                <div>
                  <Label>Load from Wash Ticket</Label>
                  <Select
                    value={formData.wash_ticket_id}
                    onValueChange={handleLoadFromTicket}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ticket (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerTickets.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.ticket_number} - ${t.total_amount}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({...formData, invoice_date: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Payment Terms *</Label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => setFormData({...formData, payment_terms: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                    <SelectItem value="net_7">Net 7 Days</SelectItem>
                    <SelectItem value="net_15">Net 15 Days</SelectItem>
                    <SelectItem value="net_30">Net 30 Days</SelectItem>
                    <SelectItem value="net_60">Net 60 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Line Items *</Label>
                <Button type="button" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {formData.line_items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg">
                    <div className="col-span-4">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Tax %"
                        value={item.tax_rate}
                        onChange={(e) => updateLineItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1">
                      <p className="text-sm font-medium text-center pt-2">
                        ${(item.amount + item.tax_amount).toFixed(2)}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeLineItem(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Invoice notes..."
                rows={3}
              />
            </div>

            {formData.line_items.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">
                      ${formData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-medium">
                      ${formData.line_items.reduce((sum, item) => sum + (item.tax_amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-green-600">
                      ${formData.line_items.reduce((sum, item) => sum + (item.amount || 0) + (item.tax_amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!formData.customer_id || formData.line_items.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                Create & Send Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Invoice Number</p>
                  <p className="font-bold">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={statusColors[selectedInvoice.status]}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="font-medium">{selectedInvoice.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Invoice Date</p>
                  <p className="font-medium">
                    {selectedInvoice.invoice_date && format(parseISO(selectedInvoice.invoice_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Due Date</p>
                  <p className="font-medium">
                    {selectedInvoice.due_date && format(parseISO(selectedInvoice.due_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {selectedInvoice.line_items && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Line Items</p>
                  {selectedInvoice.line_items.map((item, i) => (
                    <div key={i} className="flex justify-between p-2 bg-slate-50 rounded mb-1">
                      <div>
                        <span className="font-medium">{item.description}</span>
                        <span className="text-sm text-slate-500 ml-2">
                          {item.quantity} × ${item.unit_price}
                        </span>
                      </div>
                      <span className="font-medium">
                        ${(item.amount + item.tax_amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium">${selectedInvoice.subtotal?.toFixed(2)}</span>
                </div>
                {selectedInvoice.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-medium">${selectedInvoice.tax_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total Amount:</span>
                  <span className="text-green-600">${selectedInvoice.total_amount?.toFixed(2)}</span>
                </div>
                {selectedInvoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Amount Paid:</span>
                      <span className="font-medium">${selectedInvoice.amount_paid?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Balance Due:</span>
                      <span className="font-bold text-red-600">${selectedInvoice.balance_due?.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {['draft', 'sent', 'partial'].includes(selectedInvoice.status) && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleMarkAsPaid(selectedInvoice)}
                  >
                    Mark as Paid
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}