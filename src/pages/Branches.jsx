import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Search, Edit, Save, X, Phone, Mail, Droplets } from "lucide-react";
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

export default function BranchesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [showBayDialog, setShowBayDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const queryClient = useQueryClient();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list('-created_date'),
  });

  const { data: bays = [] } = useQuery({
    queryKey: ['bays'],
    queryFn: () => base44.entities.Bay.list(),
  });

  const createBranchMutation = useMutation({
    mutationFn: (data) => base44.entities.Branch.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['branches']);
      setShowDialog(false);
      setEditingBranch(null);
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Branch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['branches']);
      setShowDialog(false);
      setEditingBranch(null);
    },
  });

  const createBayMutation = useMutation({
    mutationFn: (data) => base44.entities.Bay.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bays']);
      setShowBayDialog(false);
    },
  });

  const [formData, setFormData] = useState({
    branch_name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    manager_name: '',
    number_of_bays: 1,
    operating_hours: '8:00 AM - 10:00 PM',
    is_mobile_unit: false,
    status: 'active'
  });

  const [bayFormData, setBayFormData] = useState({
    bay_number: '',
    bay_type: 'manual',
    capacity: 'medium',
    current_status: 'available',
    status: 'active'
  });

  const handleOpenDialog = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData(branch);
    } else {
      setEditingBranch(null);
      setFormData({
        branch_name: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        manager_name: '',
        number_of_bays: 1,
        operating_hours: '8:00 AM - 10:00 PM',
        is_mobile_unit: false,
        status: 'active'
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const branchCode = formData.branch_code || `BR-${Date.now()}`;

    if (editingBranch) {
      updateBranchMutation.mutate({ id: editingBranch.id, data: { ...formData, branch_code: branchCode } });
    } else {
      createBranchMutation.mutate({ ...formData, branch_code: branchCode });
    }
  };

  const handleAddBays = (branch) => {
    setSelectedBranch(branch);
    setBayFormData({
      bay_number: '',
      bay_type: 'manual',
      capacity: 'medium',
      current_status: 'available',
      status: 'active'
    });
    setShowBayDialog(true);
  };

  const handleBaySubmit = (e) => {
    e.preventDefault();
    createBayMutation.mutate({
      ...bayFormData,
      branch_id: selectedBranch.id,
      branch_name: selectedBranch.branch_name
    });
  };

  const filteredBranches = branches.filter(b =>
    b.branch_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBranchBays = (branchId) => bays.filter(b => b.branch_id === branchId);

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <MapPin className="w-8 h-8 text-blue-600" />
              Branches & Bays
            </h1>
            <p className="text-slate-500 mt-1">Manage locations and wash bays</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
        </div>

        {/* Search */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Branches Grid */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredBranches.length === 0 ? (
          <Card className="border-none shadow-lg">
            <CardContent className="text-center py-12">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No branches found</p>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Branch
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBranches.map(branch => {
              const branchBays = getBranchBays(branch.id);
              const activeBays = branchBays.filter(b => b.current_status === 'available').length;
              
              return (
                <Card key={branch.id} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{branch.branch_name}</CardTitle>
                          <Badge variant="outline" className={`mt-1 text-xs ${
                            branch.is_mobile_unit 
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {branch.is_mobile_unit ? 'Mobile Unit' : 'Fixed Location'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenDialog(branch)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {branch.city && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">City:</span> {branch.city}
                      </p>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{branch.email}</span>
                      </div>
                    )}
                    {branch.manager_name && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Manager:</span> {branch.manager_name}
                      </p>
                    )}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-slate-600">
                          {branchBays.length} bays ({activeBays} available)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddBays(branch)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Bay
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Branch Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? 'Edit Branch' : 'Add New Branch'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Branch Name *</Label>
                <Input
                  value={formData.branch_name}
                  onChange={(e) => setFormData({...formData, branch_name: e.target.value})}
                  placeholder="Branch name"
                  required
                />
              </div>

              <div>
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  placeholder="City"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Full address"
                />
              </div>

              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="branch@example.com"
                />
              </div>

              <div>
                <Label>Manager Name</Label>
                <Input
                  value={formData.manager_name}
                  onChange={(e) => setFormData({...formData, manager_name: e.target.value})}
                  placeholder="Branch manager"
                />
              </div>

              <div>
                <Label>Number of Bays</Label>
                <Input
                  type="number"
                  value={formData.number_of_bays}
                  onChange={(e) => setFormData({...formData, number_of_bays: parseInt(e.target.value) || 1})}
                  placeholder="1"
                  min="1"
                />
              </div>

              <div>
                <Label>Operating Hours</Label>
                <Input
                  value={formData.operating_hours}
                  onChange={(e) => setFormData({...formData, operating_hours: e.target.value})}
                  placeholder="8:00 AM - 10:00 PM"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Mobile Unit</Label>
                <Switch
                  checked={formData.is_mobile_unit}
                  onCheckedChange={(checked) => setFormData({...formData, is_mobile_unit: checked})}
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
                {editingBranch ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Bay Dialog */}
      <Dialog open={showBayDialog} onOpenChange={setShowBayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bay to {selectedBranch?.branch_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBaySubmit} className="space-y-4">
            <div>
              <Label>Bay Number *</Label>
              <Input
                value={bayFormData.bay_number}
                onChange={(e) => setBayFormData({...bayFormData, bay_number: e.target.value})}
                placeholder="Bay 1, Bay A, etc."
                required
              />
            </div>

            <div>
              <Label>Bay Type</Label>
              <Select 
                value={bayFormData.bay_type} 
                onValueChange={(value) => setBayFormData({...bayFormData, bay_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="detailing">Detailing</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Capacity</Label>
              <Select 
                value={bayFormData.capacity} 
                onValueChange={(value) => setBayFormData({...bayFormData, capacity: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (Sedan, Compact)</SelectItem>
                  <SelectItem value="medium">Medium (SUV, Sedan)</SelectItem>
                  <SelectItem value="large">Large (Truck, Van)</SelectItem>
                  <SelectItem value="xlarge">X-Large (Bus, Large Truck)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBayDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Add Bay
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}