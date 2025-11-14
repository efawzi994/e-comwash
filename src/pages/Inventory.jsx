import React, { useState, useEffect } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import { Package, Plus, TrendingDown, TrendingUp, AlertTriangle, DollarSign, ArrowRight, Edit } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";

export default function InventoryPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => base44.entities.StockMovement.list('-movement_date', 100),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: costLayers = [] } = useQuery({
    queryKey: ['costLayers'],
    queryFn: () => base44.entities.CostLayer.list('-purchase_date'),
  });

  const createMovementMutation = useMutation({
    mutationFn: async (data) => {
      const movement = await base44.entities.StockMovement.create(data);
      
      // Update product stock
      const product = products.find(p => p.id === data.product_id);
      if (product) {
        const newStock = product.current_stock + data.quantity;
        await base44.entities.Product.update(product.id, { current_stock: newStock });
      }

      // Handle COGS calculation for sales/consumption
      if (data.movement_type === 'sale' || data.movement_type === 'consumption') {
        const cost = await calculateFIFOCost(data.product_id, Math.abs(data.quantity));
        
        // Update cost layers
        await updateCostLayers(data.product_id, Math.abs(data.quantity));
      }

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['stockMovements']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['costLayers']);
      setShowMovementDialog(false);
    },
  });

  const updateProductCostingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      setShowCostDialog(false);
    },
  });

  const [movementForm, setMovementForm] = useState({
    product_id: '',
    movement_type: 'adjustment',
    quantity: 0,
    reason_code: 'count_discrepancy',
    reason_description: '',
    location: ''
  });

  // Calculate FIFO Cost
  const calculateFIFOCost = async (productId, quantity) => {
    const productLayers = costLayers
      .filter(l => l.product_id === productId && l.status === 'active' && l.quantity_remaining > 0)
      .sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));

    let remainingQty = quantity;
    let totalCost = 0;

    for (const layer of productLayers) {
      if (remainingQty <= 0) break;

      const qtyToUse = Math.min(remainingQty, layer.quantity_remaining);
      totalCost += qtyToUse * layer.unit_cost;
      remainingQty -= qtyToUse;
    }

    return { totalCost, avgCost: quantity > 0 ? totalCost / quantity : 0 };
  };

  // Update cost layers (FIFO consumption)
  const updateCostLayers = async (productId, quantity) => {
    const productLayers = costLayers
      .filter(l => l.product_id === productId && l.status === 'active' && l.quantity_remaining > 0)
      .sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));

    let remainingQty = quantity;

    for (const layer of productLayers) {
      if (remainingQty <= 0) break;

      const qtyToConsume = Math.min(remainingQty, layer.quantity_remaining);
      const newQty = layer.quantity_remaining - qtyToConsume;

      await base44.entities.CostLayer.update(layer.id, {
        quantity_remaining: newQty,
        total_cost: newQty * layer.unit_cost,
        status: newQty === 0 ? 'depleted' : 'active'
      });

      remainingQty -= qtyToConsume;
    }
  };

  // Calculate weighted average cost
  const calculateWeightedAvgCost = (product) => {
    const productLayers = costLayers.filter(
      l => l.product_id === product.id && l.status === 'active' && l.quantity_remaining > 0
    );

    if (productLayers.length === 0) return product.cost_price || 0;

    const totalCost = productLayers.reduce((sum, l) => sum + l.total_cost, 0);
    const totalQty = productLayers.reduce((sum, l) => sum + l.quantity_remaining, 0);

    return totalQty > 0 ? totalCost / totalQty : product.cost_price || 0;
  };

  const handleMovementSubmit = (e) => {
    e.preventDefault();
    const product = products.find(p => p.id === movementForm.product_id);
    if (!product) return;

    const quantity = movementForm.movement_type === 'sale' || movementForm.movement_type === 'consumption'
      ? -Math.abs(movementForm.quantity)
      : Math.abs(movementForm.quantity);

    const now = new Date().toISOString();

    createMovementMutation.mutate({
      movement_date: now,
      product_id: product.id,
      product_name: product.product_name,
      movement_type: movementForm.movement_type,
      quantity: quantity,
      unit_cost: product.cost_price || 0,
      total_cost: Math.abs(quantity) * (product.cost_price || 0),
      reference_type: 'adjustment',
      reason_code: movementForm.reason_code,
      reason_description: movementForm.reason_description,
      previous_stock: product.current_stock,
      new_stock: product.current_stock + quantity,
      to_location: movementForm.location,
      performed_by: 'system'
    });
  };

  // Inventory stats
  const lowStockProducts = products.filter(p => 
    p.current_stock <= p.min_stock_level && p.min_stock_level > 0
  );

  const totalInventoryValue = products.reduce((sum, p) => 
    sum + (p.current_stock * (p.cost_price || 0)), 0
  );

  const criticalLowStock = lowStockProducts.filter(p => p.current_stock <= (p.min_stock_level * 0.5));

  // Send email alert for critical low stock
  useEffect(() => {
    criticalLowStock.forEach(async (product) => {
      if (!dismissedAlerts.includes(product.id)) {
        try {
          const user = await base44.auth.me();
          if (user.email) {
            await base44.integrations.Core.SendEmail({
              to: user.email,
              subject: `URGENT: Critical Low Stock Alert - ${product.product_name}`,
              body: `Product ${product.product_name} is critically low on stock.\n\nCurrent: ${product.current_stock} ${product.uom}\nMinimum: ${product.min_stock_level} ${product.uom}\n\nPlease reorder immediately.`
            });
          }
        } catch (error) {
          console.error('Failed to send alert:', error);
        }
      }
    });
  }, [criticalLowStock.length]);

  const recentMovements = stockMovements.slice(0, 10);

  const movementTypeColors = {
    purchase: 'bg-green-100 text-green-700',
    sale: 'bg-blue-100 text-blue-700',
    adjustment: 'bg-yellow-100 text-yellow-700',
    return: 'bg-purple-100 text-purple-700',
    consumption: 'bg-orange-100 text-orange-700',
    transfer: 'bg-indigo-100 text-indigo-700'
  };

  const movementTypeIcons = {
    purchase: TrendingUp,
    sale: TrendingDown,
    adjustment: Edit,
    return: ArrowRight,
    consumption: Package,
    transfer: ArrowRight
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              Inventory Management
            </h1>
            <p className="text-slate-500 mt-1">Track stock levels and movements with FIFO costing</p>
          </div>
          <Button onClick={() => setShowMovementDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Record Movement
          </Button>
        </div>

        {/* Critical Alerts */}
        {criticalLowStock.length > 0 && (
          <Card className="border-red-300 bg-red-50 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 text-lg">Critical Low Stock Alert!</h3>
                  <p className="text-red-700 mt-1">
                    {criticalLowStock.length} product(s) are critically low. Immediate reorder required.
                  </p>
                  <div className="mt-3 space-y-1">
                    {criticalLowStock.map(p => (
                      <div key={p.id} className="text-sm text-red-800">
                        • {p.product_name}: {p.current_stock} {p.uom} (Min: {p.min_stock_level})
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDismissedAlerts([...dismissedAlerts, ...criticalLowStock.map(p => p.id)])}
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <Package className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold">{products.length}</p>
              <p className="text-sm text-slate-600">Total Products</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <AlertTriangle className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold">{lowStockProducts.length}</p>
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

          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold">{stockMovements.length}</p>
              <p className="text-sm text-slate-600">Total Movements</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="movements">
          <TabsList>
            <TabsTrigger value="movements">Recent Movements</TabsTrigger>
            <TabsTrigger value="stock">Stock Levels</TabsTrigger>
            <TabsTrigger value="costing">Costing Method</TabsTrigger>
          </TabsList>

          <TabsContent value="movements" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Recent Stock Movements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentMovements.map((movement, i) => {
                    const Icon = movementTypeIcons[movement.movement_type] || Package;
                    return (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <Icon className="w-5 h-5 text-slate-600" />
                          <div>
                            <p className="font-medium">{movement.product_name}</p>
                            <p className="text-sm text-slate-500">
                              {format(new Date(movement.movement_date), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge className={movementTypeColors[movement.movement_type]}>
                            {movement.movement_type}
                          </Badge>
                          {movement.reason_code && (
                            <Badge variant="outline">{movement.reason_code.replace('_', ' ')}</Badge>
                          )}
                          <span className={`font-bold ${movement.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {movement.quantity >= 0 ? '+' : ''}{movement.quantity}
                          </span>
                          <span className="text-sm text-slate-500">
                            Cost: {formatCurrency(movement.total_cost, currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Current Stock Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Product</th>
                        <th className="text-right py-2">Current Stock</th>
                        <th className="text-right py-2">Min Level</th>
                        <th className="text-right py-2">FIFO Cost</th>
                        <th className="text-right py-2">Avg Cost</th>
                        <th className="text-right py-2">Value</th>
                        <th className="text-center py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => {
                        const avgCost = calculateWeightedAvgCost(product);
                        const isLow = product.current_stock <= product.min_stock_level && product.min_stock_level > 0;
                        
                        return (
                          <tr key={product.id} className="border-b hover:bg-slate-50">
                            <td className="py-2">{product.product_name}</td>
                            <td className="text-right py-2">
                              {product.current_stock} {product.uom}
                            </td>
                            <td className="text-right py-2">
                              {product.min_stock_level} {product.uom}
                            </td>
                            <td className="text-right py-2">
                              {formatCurrency(product.cost_price || 0, currency)}
                            </td>
                            <td className="text-right py-2">
                              {formatCurrency(avgCost, currency)}
                            </td>
                            <td className="text-right py-2 font-bold">
                              {formatCurrency(product.current_stock * avgCost, currency)}
                            </td>
                            <td className="text-center py-2">
                              {isLow ? (
                                <Badge className="bg-orange-100 text-orange-700">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Low
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700">OK</Badge>
                              )}
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

          <TabsContent value="costing" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Inventory Costing Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-bold text-blue-900 mb-2">Current Method: FIFO (First-In, First-Out)</h3>
                    <p className="text-sm text-blue-800">
                      This system uses FIFO costing. When products are sold or consumed, 
                      the cost is calculated from the oldest purchases first. This ensures 
                      accurate cost of goods sold tracking and inventory valuation.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">How FIFO Works:</h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                      <li>Each purchase creates a cost layer with quantity and unit cost</li>
                      <li>Sales consume from oldest layers first</li>
                      <li>Weighted average cost is calculated for reporting</li>
                      <li>Accurate COGS calculation for profit tracking</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-2">Benefits:</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>✓ Reflects actual physical flow of inventory</li>
                      <li>✓ More accurate profit margins</li>
                      <li>✓ Better for perishable/time-sensitive products</li>
                      <li>✓ Complies with accounting standards</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Record Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Stock Movement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit} className="space-y-4">
            <div>
              <Label>Product *</Label>
              <Select 
                value={movementForm.product_id} 
                onValueChange={(v) => setMovementForm({...movementForm, product_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.product_name} (Stock: {p.current_stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Movement Type *</Label>
                <Select 
                  value={movementForm.movement_type} 
                  onValueChange={(v) => setMovementForm({...movementForm, movement_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="consumption">Consumption</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({...movementForm, quantity: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Reason Code *</Label>
              <Select 
                value={movementForm.reason_code} 
                onValueChange={(v) => setMovementForm({...movementForm, reason_code: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count_discrepancy">Count Discrepancy</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="service_consumption">Service Consumption</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Location</Label>
              <Select 
                value={movementForm.location} 
                onValueChange={(v) => setMovementForm({...movementForm, location: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason Description</Label>
              <Textarea
                value={movementForm.reason_description}
                onChange={(e) => setMovementForm({...movementForm, reason_description: e.target.value})}
                rows={3}
                placeholder="Detailed reason for movement..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMovementDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Record Movement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}