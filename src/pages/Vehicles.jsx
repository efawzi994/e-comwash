import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Plus, Search, Edit, Save, X } from "lucide-react";
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

export default function VehiclesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Vehicle.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicles']);
      setShowDialog(false);
      setEditingVehicle(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Vehicle.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicles']);
      setShowDialog(false);
      setEditingVehicle(null);
    },
  });

  const [formData, setFormData] = useState({
    plate_number: '',
    customer_id: '',
    customer_name: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vehicle_category: 'sedan',
    vin: '',
    notes: '',
    status: 'active'
  });

  const handleOpenDialog = (vehicle = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData(vehicle);
    } else {
      setEditingVehicle(null);
      setFormData({
        plate_number: '',
        customer_id: '',
        customer_name: '',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        vehicle_category: 'sedan',
        vin: '',
        notes: '',
        status: 'active',
        total_visits: 0
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedCustomer = customers.find(c => c.id === formData.customer_id);
    const dataToSubmit = {
      ...formData,
      customer_name: selectedCustomer?.name || formData.customer_name
    };

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryColors = {
    sedan: 'bg-blue-100 text-blue-700',
    suv: 'bg-green-100 text-green-700',
    truck: 'bg-orange-100 text-orange-700',
    van: 'bg-purple-100 text-purple-700',
    bus: 'bg-red-100 text-red-700',
    motorcycle: 'bg-yellow-100 text-yellow-700',
    other: 'bg-gray-100 text-gray-700'
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Car className="w-8 h-8 text-blue-600" />
              Vehicles
            </h1>
            <p className="text-slate-500 mt-1">Manage customer vehicles</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </div>

        {/* Search */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search by plate number, brand, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vehicles Grid */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredVehicles.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="text-center py-12">
              <Car className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No vehicles found</p>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Vehicle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map(vehicle => (
              <Card key={vehicle.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Car className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold">{vehicle.plate_number}</CardTitle>
                        <p className="text-sm text-slate-500">{vehicle.brand} {vehicle.model}</p>
                        <Badge className={`${categoryColors[vehicle.vehicle_category]} mt-1 text-xs`}>
                          {vehicle.vehicle_category}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(vehicle)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vehicle.customer_name && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Owner:</span> {vehicle.customer_name}
                    </p>
                  )}
                  {vehicle.year && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Year:</span> {vehicle.year}
                    </p>
                  )}
                  {vehicle.color && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Color:</span> {vehicle.color}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 pt-2 border-t">
                    <span className="font-medium">Total Visits:</span> {vehicle.total_visits || 0}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Plate Number *</Label>
                <Input
                  value={formData.plate_number}
                  onChange={(e) => setFormData({...formData, plate_number: e.target.value})}
                  placeholder="ABC-1234"
                  required
                />
              </div>

              <div>
                <Label>Customer</Label>
                <Select 
                  value={formData.customer_id} 
                  onValueChange={(value) => setFormData({...formData, customer_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Brand</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                  placeholder="Toyota, Honda, etc."
                />
              </div>

              <div>
                <Label>Model</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder="Camry, Accord, etc."
                />
              </div>

              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})}
                  placeholder="2024"
                />
              </div>

              <div>
                <Label>Color</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  placeholder="White, Black, etc."
                />
              </div>

              <div>
                <Label>Vehicle Category *</Label>
                <Select 
                  value={formData.vehicle_category} 
                  onValueChange={(value) => setFormData({...formData, vehicle_category: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="bus">Bus</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>VIN</Label>
                <Input
                  value={formData.vin}
                  onChange={(e) => setFormData({...formData, vin: e.target.value})}
                  placeholder="Vehicle Identification Number"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Special notes or preferences..."
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
                {editingVehicle ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}