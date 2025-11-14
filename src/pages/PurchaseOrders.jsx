import React, { useState } from "react";
import { get, post } from '@/api/http';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import { FileText, Plus, Search, Edit, Save, X, Check, Package, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function PurchaseOrdersPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [receivingPO, setReceivingPO] = useState(null);

  const queryClient = useQueryClient();

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const createPOMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      setShowDialog(false);
      setEditingPO(null);
    },
  });

  const updatePOMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      setShowDialog(false);
      setShowReceiveDialog(false);
      setEditingPO(null);
      setReceivingPO(null);
    },
  });

  const createStockMovementMutation = useMutation({
    mutationFn: (data) => base44.entities.StockMovement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stockMovements']);
    },
  });

  const createCostLayerMutation = useMutation({
    mutationFn: (data) => base44.entities.CostLayer.create(data),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
    },
  });

  const [formData, setFormData] = useState({
    supplier_id: '',
    order_date: format(new Date(), 'yyyy-MM-dd'),
    expected_delivery_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    items: [],
    notes: ''
  });

  const [receiveData, setReceiveData] = useState({});

  const handleOpenDialog = (po = null) => {
    if (po) {
      setEditingPO(po);
      setFormData({
        supplier_id: po.supplier_id,
        order_date: po.order_date,
        expected_delivery_date: po.expected_delivery_date,
        items: po.items || [],
        notes: po.notes || ''
      });
    } else {
      setEditingPO(null);
      setFormData({
        supplier_id: '',
        order_date: format(new Date(), 'yyyy-MM-dd'),
        expected_delivery_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        items: [],
        notes: ''
      });
    }
    setShowDialog(true);
  };

  const addItem = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product && !formData.items.find(i => i.product_id === productId)) {
      setFormData({
        ...formData,
        items: [...formData.items, {
          product_id: product.id,
          product_name: product.product_name,
          quantity: 1,
          unit_cost: product.cost_price || 0,
          total_cost: product.cost_price || 0,
          received_quantity: 0
        }]
      });
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_cost') {
      newItems[index].total_cost = newItems[index].quantity * newItems[index].unit_cost;
    }
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total_cost, 0);
    const tax = subtotal * 0; // Can be adjusted based on settings
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const supplier = suppliers.find(s => s.id === formData.supplier_id);
    const { subtotal, tax, total } = calculateTotals();
    const poNumber = `PO-${Date.now()}`;

    const poData = {
      po_number: poNumber,
      supplier_id: formData.supplier_id,
      supplier_name: supplier?.supplier_name,
      order_date: formData.order_date,
      expected_delivery_date: formData.expected_delivery_date,
      items: formData.items,
      subtotal,
      tax_amount: tax,
      total_amount: total,
      status: 'sent',
      payment_status: 'unpaid',
      notes: formData.notes
    };

    if (editingPO) {
      updatePOMutation.mutate({ id: editingPO.id, data: poData });
    } else {
      createPOMutation.mutate(poData);
    }
  };

  const handleReceive = (po) => {
    setReceivingPO(po);
    const initialReceiveData = {};
    po.items.forEach(item => {
      initialReceiveData[item.product_id] = item.quantity - (item.received_quantity || 0);
    });
    setReceiveData(initialReceiveData);
    setShowReceiveDialog(true);
  };

  const handleReceiveSubmit = async () => {
    if (!receivingPO) return;

    const updates = [];
    const now = new Date().toISOString();

    // Process each item
    for (const item of receivingPO.items) {
      const receiveQty = receiveData[item.product_id] || 0;
      if (receiveQty <= 0) continue;

      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;

      // Update product stock
      const newStock = (product.current_stock || 0) + receiveQty;
      await updateProductMutation.mutateAsync({
        id: product.id,
        data: { current_stock: newStock }
      });

      // Create stock movement
      await createStockMovementMutation.mutateAsync({
        movement_date: now,
        product_id: item.product_id,
        product_name: item.product_name,
        movement_type: 'purchase',
        quantity: receiveQty,
        unit_cost: item.unit_cost,
        total_cost: receiveQty * item.unit_cost,
        reference_type: 'purchase_order',
        reference_id: receivingPO.id,
        reference_number: receivingPO.po_number,
        reason_code: 'purchase',
        previous_stock: product.current_stock || 0,
        new_stock: newStock,
        performed_by: 'system'
      });

      // Create FIFO cost layer
      await createCostLayerMutation.mutateAsync({
        product_id: item.product_id,
        product_name: item.product_name,
        purchase_date: now,
        quantity_purchased: receiveQty,
        quantity_remaining: receiveQty,
        unit_cost: item.unit_cost,
        total_cost: receiveQty * item.unit_cost,
        reference_type: 'purchase_order',
        reference_id: receivingPO.id,
        status: 'active'
      });

      // Update item received quantity
      item.received_quantity = (item.received_quantity || 0) + receiveQty;
    }

    // Update PO status
    const allReceived = receivingPO.items.every(item => 
      (item.received_quantity || 0) >= item.quantity
    );
    const partiallyReceived = receivingPO.items.some(item => 
      (item.received_quantity || 0) > 0
    );

    await updatePOMutation.mutateAsync({
      id: receivingPO.id,
      data: {
        ...receivingPO,
        actual_delivery_date: format(new Date(), 'yyyy-MM-dd'),
        status: allReceived ? 'received' : (partiallyReceived ? 'partially_received' : receivingPO.status)
      }
    });

    setShowReceiveDialog(false);
    setReceivingPO(null);
  };

  const filteredPOs = purchaseOrders.filter(po =>
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    partially_received: 'bg-yellow-100 text-yellow-700',
    received: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Purchase Orders
            </h1>
            <p className="text-slate-500 mt-1">Create and manage purchase orders</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            New Purchase Order
          </Button>
        </div>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search purchase orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredPOs.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No purchase orders found</p>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create First PO
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPOs.map(po => (
              <Card key={po.id} className="border-none shadow-lg hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold">{po.po_number}</h3>
                        <Badge className={statusColors[po.status]}>
                          {po.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-slate-600">Supplier: {po.supplier_name}</p>
                      <p className="text-sm text-slate-500">
                        Order Date: {format(new Date(po.order_date), 'MMM d, yyyy')} | 
                        Expected: {format(new Date(po.expected_delivery_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">
                        Items: {po.items?.length || 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(po.total_amount, currency)}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {['sent', 'confirmed', 'partially_received'].includes(po.status) && (
                          <Button size="sm" onClick={() => handleReceive(po)} className="bg-green-600 hover:bg-green-700">
                            <Package className="w-4 h-4 mr-1" />
                            Receive
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleOpenDialog(po)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Supplier *</Label>
                <Select 
                  value={formData.supplier_id} 
                  onValueChange={(value) => setFormData({...formData, supplier_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Order Date</Label>
                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                />
              </div>

              <div>
                <Label>Expected Delivery</Label>
                <Input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label>Items</Label>
              <Select onValueChange={addItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Add product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => !formData.items.find(i => i.product_id === p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4 space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center p-3 bg-slate-50 rounded">
                    <span className="flex-1 font-medium">{item.product_name}</span>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-24"
                      placeholder="Qty"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                      className="w-32"
                      placeholder="Cost"
                    />
                    <span className="w-32 text-right font-bold">
                      {formatCurrency(item.total_cost, currency)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>

              {formData.items.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold">{formatCurrency(calculateTotals().subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(calculateTotals().total, currency)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingPO ? 'Update' : 'Create'} PO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive Purchase Order: {receivingPO?.po_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {receivingPO?.items.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded">
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-slate-500">
                    Ordered: {item.quantity} | Received: {item.received_quantity || 0}
                  </p>
                </div>
                <div className="w-32">
                  <Label className="text-xs">Receive Qty</Label>
                  <Input
                    type="number"
                    value={receiveData[item.product_id] || 0}
                    onChange={(e) => setReceiveData({
                      ...receiveData,
                      [item.product_id]: parseFloat(e.target.value) || 0
                    })}
                    max={item.quantity - (item.received_quantity || 0)}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveSubmit} className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}