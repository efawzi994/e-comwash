
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import { Wrench, Plus, Search, Edit, Save, X, Clock, DollarSign } from "lucide-react";
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
import { Switch } from "@/components/ui/switch"; // Keeping this import as per original file, even if usage is removed by outline.

export default function ServicesPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('-created_date'),
  });

  const createServiceMutation = useMutation({
    mutationFn: (data) => base44.entities.Service.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
      setShowDialog(false);
      setEditingService(null);
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Service.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['services']);
      setShowDialog(false);
      setEditingService(null);
    },
  });

  const [formData, setFormData] = useState({
    service_name: '',
    service_type: 'basic_wash',
    description: '',
    duration_minutes: 30,
    retail_price: 0,
    corporate_price: 0,
    cost: 0,
    status: 'active'
  });

  const handleOpenDialog = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData(service);
    } else {
      setEditingService(null);
      setFormData({
        service_name: '',
        service_type: 'basic_wash',
        description: '',
        duration_minutes: 30,
        retail_price: 0,
        corporate_price: 0,
        cost: 0,
        status: 'active'
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const serviceCode = formData.service_code || `SVC-${Date.now()}`;

    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, data: { ...formData, service_code: serviceCode } });
    } else {
      createServiceMutation.mutate({ ...formData, service_code: serviceCode });
    }
  };

  const filteredServices = services.filter(s =>
    s.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.service_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const serviceTypeColors = {
    basic_wash: 'bg-blue-100 text-blue-700',
    premium_wash: 'bg-purple-100 text-purple-700',
    detailing: 'bg-green-100 text-green-700',
    express: 'bg-orange-100 text-orange-700',
    specialty: 'bg-pink-100 text-pink-700'
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Wrench className="w-8 h-8 text-blue-600" />
              Services
            </h1>
            <p className="text-slate-500 mt-1">Manage wash services and pricing</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>

        {/* Search */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Services Grid */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredServices.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="text-center py-12">
              <Wrench className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No services found</p>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map(service => (
              <Card key={service.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Wrench className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{service.service_name}</CardTitle>
                        <Badge variant="outline" className={`mt-1 text-xs ${serviceTypeColors[service.service_type] || 'bg-slate-100 text-slate-700'}`}>
                          {service.service_type?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(service)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {service.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{service.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{service.duration_minutes} min</span>
                  </div>
                  <div className="pt-3 border-t space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Retail:</span>
                      <span className="font-bold text-green-600">{formatCurrency(service.retail_price || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Corporate:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(service.corporate_price || 0, currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Service' : 'Add New Service'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Service Name *</Label>
                <Input
                  value={formData.service_name}
                  onChange={(e) => setFormData({...formData, service_name: e.target.value})}
                  placeholder="e.g., Basic Exterior Wash"
                  required
                />
              </div>

              <div>
                <Label>Service Type *</Label>
                <Select
                  value={formData.service_type}
                  onValueChange={(value) => setFormData({...formData, service_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic_wash">Basic Wash</SelectItem>
                    <SelectItem value="premium_wash">Premium Wash</SelectItem>
                    <SelectItem value="detailing">Detailing</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                    <SelectItem value="specialty">Specialty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Duration (minutes) *</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})}
                  required
                />
              </div>

              <div>
                <Label>Retail Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.retail_price}
                  onChange={(e) => setFormData({...formData, retail_price: parseFloat(e.target.value) || 0})}
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
                />
              </div>

              <div>
                <Label>Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({...formData, cost: parseFloat(e.target.value) || 0})}
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Service description..."
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
                {editingService ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
