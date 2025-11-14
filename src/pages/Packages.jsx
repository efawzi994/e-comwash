
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import { Gift, Plus, Search, Edit, Save, X, Package, Users } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays } from "date-fns";

export default function PackagesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => base44.entities.Package.list('-created_date'),
  });

  const { data: customerPackages = [] } = useQuery({
    queryKey: ['customerPackages'],
    queryFn: () => base44.entities.CustomerPackage.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createPackageMutation = useMutation({
    mutationFn: (data) => base44.entities.Package.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['packages']);
      setShowPackageDialog(false);
      setEditingPackage(null);
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Package.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['packages']);
      setShowPackageDialog(false);
      setEditingPackage(null);
    },
  });

  const assignPackageMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomerPackage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customerPackages']);
      setShowAssignDialog(false);
    },
  });

  const [packageFormData, setPackageFormData] = useState({
    package_name: '',
    package_type: 'prepaid_washes',
    description: '',
    number_of_washes: 10,
    price: 0,
    validity_days: 180,
    is_unlimited: false,
    auto_renew: false,
    status: 'active'
  });

  const [assignFormData, setAssignFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    purchase_date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleOpenPackageDialog = (pkg = null) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageFormData(pkg);
    } else {
      setEditingPackage(null);
      setPackageFormData({
        package_name: '',
        package_type: 'prepaid_washes',
        description: '',
        number_of_washes: 10,
        price: 0,
        validity_days: 180,
        is_unlimited: false,
        auto_renew: false,
        status: 'active'
      });
    }
    setShowPackageDialog(true);
  };

  const handlePackageSubmit = (e) => {
    e.preventDefault();
    const packageCode = packageFormData.package_code || `PKG-${Date.now()}`;

    if (editingPackage) {
      updatePackageMutation.mutate({ id: editingPackage.id, data: { ...packageFormData, package_code: packageCode } });
    } else {
      createPackageMutation.mutate({ ...packageFormData, package_code: packageCode });
    }
  };

  const handleAssignPackage = (pkg) => {
    setSelectedPackage(pkg);
    setAssignFormData({
      customer_id: '',
      vehicle_id: '',
      purchase_date: format(new Date(), 'yyyy-MM-dd')
    });
    setShowAssignDialog(true);
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === assignFormData.customer_id);
    const vehicle = vehicles.find(v => v.id === assignFormData.vehicle_id);
    const purchaseDate = new Date(assignFormData.purchase_date);
    const expiryDate = addDays(purchaseDate, selectedPackage.validity_days);

    assignPackageMutation.mutate({
      customer_id: assignFormData.customer_id,
      customer_name: customer?.name,
      vehicle_id: assignFormData.vehicle_id || null,
      plate_number: vehicle?.plate_number || null,
      package_id: selectedPackage.id,
      package_name: selectedPackage.package_name,
      package_type: selectedPackage.package_type,
      purchase_date: format(purchaseDate, 'yyyy-MM-dd'),
      expiry_date: format(expiryDate, 'yyyy-MM-dd'),
      total_washes: selectedPackage.number_of_washes,
      used_washes: 0,
      remaining_washes: selectedPackage.number_of_washes,
      amount_paid: selectedPackage.price,
      status: 'active',
      auto_renew: selectedPackage.auto_renew
    });
  };

  const filteredPackages = packages.filter(p =>
    p.package_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const typeColors = {
    prepaid_washes: 'bg-blue-100 text-blue-700',
    subscription_monthly: 'bg-green-100 text-green-700',
    subscription_annual: 'bg-purple-100 text-purple-700'
  };

  const customerVehicles = assignFormData.customer_id 
    ? vehicles.filter(v => v.customer_id === assignFormData.customer_id)
    : [];

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Gift className="w-8 h-8 text-blue-600" />
              Packages & Memberships
            </h1>
            <p className="text-slate-500 mt-1">Manage prepaid and subscription packages</p>
          </div>
          <Button onClick={() => handleOpenPackageDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Create Package
          </Button>
        </div>

        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="customer-packages">Customer Packages</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="mt-6 space-y-6">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search packages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {filteredPackages.length === 0 ? (
              <Card className="border-none shadow-lg">
                <CardContent className="text-center py-12">
                  <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500 mb-4">No packages found</p>
                  <Button onClick={() => handleOpenPackageDialog()} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Package
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPackages.map(pkg => (
                  <Card key={pkg.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{pkg.package_name}</CardTitle>
                          <Badge className={`${typeColors[pkg.package_type]} mt-2 text-xs`}>
                            {pkg.package_type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenPackageDialog(pkg)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pkg.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">{pkg.description}</p>
                      )}
                      <div className="space-y-2">
                        {pkg.package_type === 'prepaid_washes' && (
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Washes:</span> {pkg.number_of_washes}
                          </p>
                        )}
                        {pkg.is_unlimited && (
                          <Badge variant="outline" className="text-xs">Unlimited</Badge>
                        )}
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Validity:</span> {pkg.validity_days} days
                        </p>
                        <div className="pt-3 border-t">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(pkg.price, settings?.currency_symbol)}
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleAssignPackage(pkg)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Assign to Customer
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="customer-packages" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                {customerPackages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p>No customer packages yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerPackages.map(cp => {
                      const isExpired = new Date(cp.expiry_date) < new Date();
                      const isUsedUp = cp.remaining_washes <= 0;

                      return (
                        <div key={cp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                          <div className="flex-1">
                            <p className="font-medium">{cp.customer_name}</p>
                            <p className="text-sm text-slate-500">
                              {cp.plate_number} • {cp.package_name}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {cp.remaining_washes} / {cp.total_washes} washes remaining
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={
                              isExpired || isUsedUp 
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-green-100 text-green-700 border-green-200'
                            }>
                              {isExpired ? 'Expired' : isUsedUp ? 'Used Up' : 'Active'}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              Expires: {format(new Date(cp.expiry_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Package Dialog */}
      <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? 'Edit Package' : 'Create New Package'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePackageSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Package Name *</Label>
                <Input
                  value={packageFormData.package_name}
                  onChange={(e) => setPackageFormData({...packageFormData, package_name: e.target.value})}
                  placeholder="E.g., 10 Wash Package"
                  required
                />
              </div>

              <div>
                <Label>Package Type *</Label>
                <Select 
                  value={packageFormData.package_type} 
                  onValueChange={(value) => setPackageFormData({...packageFormData, package_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid_washes">Prepaid Washes</SelectItem>
                    <SelectItem value="subscription_monthly">Monthly Subscription</SelectItem>
                    <SelectItem value="subscription_annual">Annual Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Number of Washes</Label>
                <Input
                  type="number"
                  value={packageFormData.number_of_washes}
                  onChange={(e) => setPackageFormData({...packageFormData, number_of_washes: parseInt(e.target.value) || 0})}
                  placeholder="10"
                />
              </div>

              <div>
                <Label>Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={packageFormData.price}
                  onChange={(e) => setPackageFormData({...packageFormData, price: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Validity (Days)</Label>
                <Input
                  type="number"
                  value={packageFormData.validity_days}
                  onChange={(e) => setPackageFormData({...packageFormData, validity_days: parseInt(e.target.value) || 180})}
                  placeholder="180"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={packageFormData.description}
                  onChange={(e) => setPackageFormData({...packageFormData, description: e.target.value})}
                  placeholder="Package description..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPackageDialog(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                {editingPackage ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Package Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Package to Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div>
              <Label>Package</Label>
              <Input value={selectedPackage?.package_name || ''} disabled />
            </div>

            <div>
              <Label>Customer *</Label>
              <Select 
                value={assignFormData.customer_id} 
                onValueChange={(value) => setAssignFormData({...assignFormData, customer_id: value, vehicle_id: ''})}
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

            {customerVehicles.length > 0 && (
              <div>
                <Label>Vehicle (Optional)</Label>
                <Select 
                  value={assignFormData.vehicle_id} 
                  onValueChange={(value) => setAssignFormData({...assignFormData, vehicle_id: value})}
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

            <div>
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={assignFormData.purchase_date}
                onChange={(e) => setAssignFormData({...assignFormData, purchase_date: e.target.value})}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Assign Package
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
