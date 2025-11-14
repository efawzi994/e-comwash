
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency, createPageUrl } from "@/components/utils";
import { 
  CreditCard, 
  Plus, 
  Minus, 
  X, 
  Search,
  ShoppingCart,
  User,
  Car,
  Trash2,
  Save
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

export default function POSPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const createTicketMutation = useMutation({
    mutationFn: (data) => base44.entities.WashTicket.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['washTickets']);
      setShowSuccess(true);
      setTimeout(() => {
        resetForm();
        setShowSuccess(false);
      }, 2000);
    },
  });

  const addService = (service) => {
    const priceToUse = selectedCustomer?.price_list === 'corporate' 
      ? (service.corporate_price || service.retail_price)
      : service.retail_price;

    setSelectedServices([...selectedServices, {
      service_id: service.id,
      service_name: service.service_name,
      price: priceToUse,
      duration: service.duration_minutes
    }]);
  };

  const removeService = (index) => {
    setSelectedServices(selectedServices.filter((_, i) => i !== index));
  };

  const addProduct = (product) => {
    const existing = selectedProducts.find(p => p.product_id === product.id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => 
        p.product_id === product.id 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      const priceToUse = selectedCustomer?.price_list === 'corporate'
        ? (product.corporate_price || product.retail_price)
        : product.retail_price;

      setSelectedProducts([...selectedProducts, {
        product_id: product.id,
        product_name: product.product_name,
        quantity: 1,
        price: priceToUse
      }]);
    }
  };

  const updateProductQuantity = (index, delta) => {
    setSelectedProducts(selectedProducts.map((p, i) => 
      i === index 
        ? { ...p, quantity: Math.max(0, p.quantity + delta) }
        : p
    ).filter(p => p.quantity > 0));
  };

  const removeProduct = (index) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    const servicesTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const productsTotal = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    return servicesTotal + productsTotal;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = (subtotal * discount) / 100;
    return subtotal - discountAmount;
  };

  const handleSubmit = () => {
    if (!selectedBranch || selectedServices.length === 0) {
      alert("Please select a branch and at least one service");
      return;
    }

    const branch = branches.find(b => b.id === selectedBranch);
    const ticketNumber = `TKT-${Date.now()}`;
    const subtotal = calculateSubtotal();
    const discountAmount = (subtotal * discount) / 100;
    const total = subtotal - discountAmount;

    const ticketData = {
      ticket_number: ticketNumber,
      branch_id: selectedBranch,
      branch_name: branch?.branch_name,
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || null,
      customer_type: selectedCustomer?.customer_type || 'retail',
      vehicle_id: selectedVehicle?.id || null,
      plate_number: selectedVehicle?.plate_number || null,
      vehicle_category: selectedVehicle?.vehicle_category || null,
      services: selectedServices,
      products: selectedProducts,
      subtotal: subtotal,
      discount_amount: discountAmount,
      tax_amount: 0,
      total_amount: total,
      status: 'queue',
      payment_status: paymentMethod === 'credit_account' ? 'credit' : 'paid',
      payment_method: paymentMethod,
      check_in_time: new Date().toISOString(),
      customer_notes: notes
    };

    createTicketMutation.mutate(ticketData);
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setSelectedVehicle(null);
    setSelectedServices([]);
    setSelectedProducts([]);
    setDiscount(0);
    setNotes("");
    setPaymentMethod("cash");
  };

  const customerVehicles = selectedCustomer 
    ? vehicles.filter(v => v.customer_id === selectedCustomer.id)
    : [];

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-blue-600" />
              Point of Sale
            </h1>
            <p className="text-slate-500 mt-1">Create new wash tickets</p>
          </div>
          <Button variant="outline" onClick={() => navigate(createPageUrl("Queue"))}>
            View Queue
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Vehicle Selection */}
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Customer & Vehicle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Branch *</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Customer (Optional)</Label>
                  <Select 
                    value={selectedCustomer?.id || ""} 
                    onValueChange={(val) => {
                      const cust = customers.find(c => c.id === val);
                      setSelectedCustomer(cust);
                      setSelectedVehicle(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Walk-in customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Walk-in customer</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.customer_type === 'corporate' && '(Corporate)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCustomer && customerVehicles.length > 0 && (
                  <div>
                    <Label>Vehicle</Label>
                    <Select 
                      value={selectedVehicle?.id || ""} 
                      onValueChange={(val) => {
                        const veh = customerVehicles.find(v => v.id === val);
                        setSelectedVehicle(veh);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerVehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.plate_number} - {v.brand} {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedCustomer && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Type:</span> {selectedCustomer.customer_type}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Loyalty Points:</span> {selectedCustomer.loyalty_points || 0}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Services & Products */}
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Services & Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="services">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                  </TabsList>

                  <TabsContent value="services" className="space-y-2 mt-4">
                    {services.filter(s => s.status === 'active').map(service => (
                      <div key={service.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-medium">{service.service_name}</p>
                          <p className="text-sm text-slate-500">{service.duration_minutes} min</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-600">
                            {formatCurrency(
                              selectedCustomer?.price_list === 'corporate' 
                                ? (service.corporate_price || service.retail_price)
                                : service.retail_price,
                              currency
                            )}
                          </span>
                          <Button size="sm" onClick={() => addService(service)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="products" className="space-y-2 mt-4">
                    {products.filter(p => p.status === 'active').map(product => (
                      <div key={product.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-medium">{product.product_name}</p>
                          <p className="text-sm text-slate-500">Stock: {product.current_stock}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-600">
                            {formatCurrency(
                              selectedCustomer?.price_list === 'corporate'
                                ? (product.corporate_price || product.retail_price)
                                : product.retail_price,
                              currency
                            )}
                          </span>
                          <Button size="sm" onClick={() => addProduct(product)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right: Cart */}
          <div className="space-y-6">
            <Card className="border-none shadow-lg sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Cart
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Services */}
                {selectedServices.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-600 mb-2">Services</p>
                    <div className="space-y-2">
                      {selectedServices.map((service, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{service.service_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{formatCurrency(service.price, currency)}</span>
                            <Button size="sm" variant="ghost" onClick={() => removeService(index)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Products */}
                {selectedProducts.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-600 mb-2">Products</p>
                    <div className="space-y-2">
                      {selectedProducts.map((product, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.product_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => updateProductQuantity(index, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-sm font-bold w-8 text-center">{product.quantity}</span>
                            <Button size="sm" variant="ghost" onClick={() => updateProductQuantity(index, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                            <span className="font-bold text-sm">{formatCurrency(product.price * product.quantity, currency)}</span>
                            <Button size="sm" variant="ghost" onClick={() => removeProduct(index)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedServices.length === 0 && selectedProducts.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">Cart is empty</p>
                  </div>
                )}

                {/* Discount */}
                <div>
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                    min="0"
                    max="100"
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions..."
                    rows={2}
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="transfer">Bank Transfer</SelectItem>
                      <SelectItem value="ewallet">E-Wallet</SelectItem>
                      {selectedCustomer?.customer_type === 'corporate' && (
                        <SelectItem value="credit_account">Credit Account</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Totals */}
                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(calculateSubtotal(), currency)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount ({discount}%):</span>
                      <span>-{formatCurrency((calculateSubtotal() * discount) / 100, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(calculateTotal(), currency)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={handleSubmit}
                    disabled={!selectedBranch || selectedServices.length === 0 || createTicketMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createTicketMutation.isPending ? 'Processing...' : 'Create Ticket'}
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={resetForm}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-green-600 text-2xl">Success!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Save className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-medium">Wash ticket created successfully</p>
            <p className="text-sm text-slate-500 mt-2">The vehicle has been added to the queue</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
