
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import { ShoppingCart, Plus, Search, Edit, Save, X, AlertTriangle, Package } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

export default function ProductsPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      setShowDialog(false);
      setEditingProduct(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
      setShowDialog(false);
      setEditingProduct(null);
    },
  });

  const [formData, setFormData] = useState({
    product_name: '',
    product_type: 'retail_item',
    category: '',
    description: '',
    uom: 'piece',
    cost_price: 0,
    retail_price: 0,
    corporate_price: 0,
    tax_rate: 0,
    current_stock: 0,
    min_stock_level: 0,
    reorder_quantity: 0,
    is_consumable: false,
    consumption_per_wash: 0,
    status: 'active'
  });

  const handleOpenDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        product_name: '',
        product_type: 'retail_item',
        category: '',
        description: '',
        uom: 'piece',
        cost_price: 0,
        retail_price: 0,
        corporate_price: 0,
        tax_rate: 0,
        current_stock: 0,
        min_stock_level: 0,
        reorder_quantity: 0,
        is_consumable: false,
        consumption_per_wash: 0,
        status: 'active'
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const sku = formData.sku || `PRD-${Date.now()}`;

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: { ...formData, sku } });
    } else {
      createMutation.mutate({ ...formData, sku });
    }
  };

  const filteredProducts = products.filter(p =>
    p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockProducts = products.filter(p => 
    p.current_stock <= p.min_stock_level && p.min_stock_level > 0
  );

  const typeColors = {
    oil: 'bg-amber-100 text-amber-700',
    chemical: 'bg-blue-100 text-blue-700',
    accessory: 'bg-purple-100 text-purple-700',
    spare_part: 'bg-red-100 text-red-700',
    retail_item: 'bg-green-100 text-green-700',
    consumable: 'bg-orange-100 text-orange-700'
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              Products & Inventory
            </h1>
            <p className="text-slate-500 mt-1">Manage products, oils, and consumables</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-900">Low Stock Alert</h3>
                  <p className="text-sm text-orange-700 mt-1">
                    {lowStockProducts.length} product(s) are below minimum stock level and need reordering.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search products by name, SKU, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredProducts.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="text-center py-12">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No products found</p>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              const isLowStock = product.current_stock <= product.min_stock_level && product.min_stock_level > 0;
              return (
                <Card key={product.id} className={`border-none shadow-lg hover:shadow-xl transition-all duration-300 group ${isLowStock ? 'ring-2 ring-orange-300' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{product.product_name}</CardTitle>
                        <p className="text-xs text-slate-500 mt-1">SKU: {product.sku}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge className={`${typeColors[product.product_type]} text-xs`}>
                            {product.product_type.replace('_', ' ')}
                          </Badge>
                          {product.is_consumable && (
                            <Badge variant="outline" className="text-xs">
                              Consumable
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenDialog(product)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Retail Price:</span>
                        <span className="font-bold text-green-600">{formatCurrency(product.retail_price, currency)}</span>
                      </div>
                      {product.corporate_price && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Corporate:</span>
                          <span className="font-bold text-blue-600">{formatCurrency(product.corporate_price, currency)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-slate-600">Stock:</span>
                        <span className={`font-bold ${isLowStock ? 'text-orange-600' : 'text-slate-900'}`}>
                          {product.current_stock} {product.uom}
                          {isLowStock && <AlertTriangle className="w-4 h-4 inline ml-1" />}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Product Name *</Label>
                <Input
                  value={formData.product_name}
                  onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                  placeholder="Product name"
                  required
                />
              </div>

              <div>
                <Label>Product Type *</Label>
                <Select 
                  value={formData.product_type} 
                  onValueChange={(value) => setFormData({...formData, product_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oil">Oil</SelectItem>
                    <SelectItem value="chemical">Chemical</SelectItem>
                    <SelectItem value="accessory">Accessory</SelectItem>
                    <SelectItem value="spare_part">Spare Part</SelectItem>
                    <SelectItem value="retail_item">Retail Item</SelectItem>
                    <SelectItem value="consumable">Consumable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  placeholder="E.g., Engine Oils, Cleaners"
                />
              </div>

              <div>
                <Label>Unit of Measure</Label>
                <Select 
                  value={formData.uom} 
                  onValueChange={(value) => setFormData({...formData, uom: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="liter">Liter</SelectItem>
                    <SelectItem value="gallon">Gallon</SelectItem>
                    <SelectItem value="kg">Kilogram</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Retail Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.retail_price}
                  onChange={(e) => setFormData({...formData, retail_price: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Corporate Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.corporate_price}
                  onChange={(e) => setFormData({...formData, corporate_price: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Tax Rate %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({...formData, tax_rate: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({...formData, current_stock: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Min Stock Level</Label>
                <Input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({...formData, min_stock_level: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Reorder Quantity</Label>
                <Input
                  type="number"
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({...formData, reorder_quantity: parseFloat(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Is Consumable</Label>
                <Switch
                  checked={formData.is_consumable}
                  onCheckedChange={(checked) => setFormData({...formData, is_consumable: checked})}
                />
              </div>

              {formData.is_consumable && (
                <div>
                  <Label>Consumption per Wash</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.consumption_per_wash}
                    onChange={(e) => setFormData({...formData, consumption_per_wash: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Product description..."
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
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
