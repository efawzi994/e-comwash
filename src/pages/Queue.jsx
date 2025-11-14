
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettings, formatCurrency } from "@/components/utils";
import { 
  Droplets, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause,
  XCircle,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function QueuePage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBayAssignment, setShowBayAssignment] = useState(false);
  const [ticketToStart, setTicketToStart] = useState(null);
  const [selectedBayId, setSelectedBayId] = useState("");

  const queryClient = useQueryClient();

  const { data: washTickets = [], isLoading } = useQuery({
    queryKey: ['washTickets'],
    queryFn: () => base44.entities.WashTicket.list('-created_date'),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: bays = [] } = useQuery({
    queryKey: ['bays'],
    queryFn: () => base44.entities.Bay.list(),
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WashTicket.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['washTickets']);
      queryClient.invalidateQueries(['bays']);
    },
  });

  const updateBayMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bay.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bays']);
    },
  });

  const handleStartTicket = (ticket) => {
    const availableBays = bays.filter(b => 
      b.branch_id === ticket.branch_id && 
      b.current_status === 'available' && 
      b.status === 'active'
    );

    if (availableBays.length === 0) {
      alert('No available bays at this branch. Please wait for a bay to become available.');
      return;
    }

    // If only one bay available, auto-assign it
    if (availableBays.length === 1) {
      assignBayAndStart(ticket, availableBays[0]);
    } else {
      // Multiple bays - let user choose
      setTicketToStart(ticket);
      setSelectedBayId(availableBays[0].id);
      setShowBayAssignment(true);
    }
  };

  const assignBayAndStart = async (ticket, bay) => {
    const now = new Date().toISOString();
    
    try {
      // Update ticket with bay assignment and start
      await updateTicketMutation.mutateAsync({
        id: ticket.id,
        data: {
          status: 'in_progress',
          start_time: now,
          bay_id: bay.id,
          bay_number: bay.bay_number
        }
      });

      // Update bay to occupied
      await updateBayMutation.mutateAsync({
        id: bay.id,
        data: {
          current_status: 'occupied',
          current_ticket_id: ticket.id
        }
      });

      setShowBayAssignment(false);
      setTicketToStart(null);
      setSelectedBayId("");
    } catch (error) {
      alert('Failed to start ticket. Please try again.');
      console.error(error);
    }
  };

  const handleBayAssignmentConfirm = () => {
    const selectedBay = bays.find(b => b.id === selectedBayId);
    if (selectedBay && ticketToStart) {
      assignBayAndStart(ticketToStart, selectedBay);
    }
  };

  const handleStatusChange = async (ticket, newStatus) => {
    const now = new Date().toISOString();
    let updates = { status: newStatus };

    if (newStatus === 'quality_check' && !ticket.finish_time) {
      updates.finish_time = now;
    } else if (newStatus === 'completed') {
      if (!ticket.finish_time) {
        updates.finish_time = now;
      }
    } else if (newStatus === 'delivered' && !ticket.delivery_time) {
      updates.delivery_time = now;
      // Free up the bay
      if (ticket.bay_id) {
        updateBayMutation.mutate({
          id: ticket.bay_id,
          data: { current_status: 'available', current_ticket_id: null }
        });
      }
    }

    updateTicketMutation.mutate({ id: ticket.id, data: updates });
  };

  const filteredTickets = washTickets.filter(t => {
    const matchesBranch = selectedBranch === 'all' || t.branch_id === selectedBranch;
    const isActive = ['queue', 'in_progress', 'quality_check', 'completed'].includes(t.status);
    return matchesBranch && isActive;
  });

  const queueTickets = filteredTickets.filter(t => t.status === 'queue');
  const inProgressTickets = filteredTickets.filter(t => t.status === 'in_progress');
  const qualityCheckTickets = filteredTickets.filter(t => t.status === 'quality_check');
  const completedTickets = filteredTickets.filter(t => t.status === 'completed');

  const statusColors = {
    queue: "bg-yellow-100 text-yellow-800 border-yellow-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    quality_check: "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
  };

  const statusIcons = {
    queue: Clock,
    in_progress: Droplets,
    quality_check: AlertCircle,
    completed: CheckCircle2,
  };

  const TicketCard = ({ ticket }) => {
    const StatusIcon = statusIcons[ticket.status] || Clock;
    const availableBays = bays.filter(b => 
      b.branch_id === ticket.branch_id && 
      b.current_status === 'available' && 
      b.status === 'active'
    );

    return (
      <Card className="border-none shadow-md hover:shadow-lg transition-all cursor-pointer" onClick={() => {
        setSelectedTicket(ticket);
        setShowDetails(true);
      }}>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-lg">{ticket.ticket_number}</p>
              <p className="text-sm text-slate-600">{ticket.plate_number || 'N/A'}</p>
            </div>
            <Badge variant="outline" className={`${statusColors[ticket.status]} border`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {ticket.status.replace('_', ' ')}
            </Badge>
          </div>

          {ticket.customer_name && (
            <p className="text-sm text-slate-600">
              <span className="font-medium">Customer:</span> {ticket.customer_name}
            </p>
          )}

          {ticket.services && ticket.services.length > 0 && (
            <div className="text-xs text-slate-500">
              {ticket.services.map((s, i) => s.service_name).join(', ')}
            </div>
          )}

          {ticket.bay_number && (
            <p className="text-sm text-blue-600 font-medium">
              Bay: {ticket.bay_number}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-slate-500">
              {ticket.created_date && format(new Date(ticket.created_date), 'h:mm a')}
            </span>
            <span className="font-bold text-green-600">
              {formatCurrency(ticket.total_amount || 0, currency)}
            </span>
          </div>

          <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            {ticket.status === 'queue' && (
              <Button 
                size="sm" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => handleStartTicket(ticket)}
                disabled={availableBays.length === 0}
              >
                <Play className="w-3 h-3 mr-1" />
                {availableBays.length === 0 ? 'No Bays' : 'Start'}
              </Button>
            )}
            {ticket.status === 'in_progress' && (
              <Button 
                size="sm" 
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={() => handleStatusChange(ticket, 'quality_check')}
              >
                <AlertCircle className="w-3 h-3 mr-1" />
                QC
              </Button>
            )}
            {ticket.status === 'quality_check' && (
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusChange(ticket, 'completed')}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Button>
            )}
            {ticket.status === 'completed' && (
              <Button 
                size="sm" 
                className="flex-1 bg-slate-600 hover:bg-slate-700"
                onClick={() => handleStatusChange(ticket, 'delivered')}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Deliver
              </Button>
            )}
          </div>

          {ticket.status === 'queue' && availableBays.length === 0 && (
            <Alert className="mt-2 bg-orange-50 border-orange-200">
              <AlertDescription className="text-xs text-orange-800">
                No bays available. {inProgressTickets.filter(t => t.branch_id === ticket.branch_id).length} wash(es) in progress.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Droplets className="w-8 h-8 text-blue-600" />
              Queue & Bay Management
            </h1>
            <p className="text-slate-500 mt-1">Real-time wash operations</p>
          </div>
          <div className="flex gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-none shadow-lg">
            <CardContent className="pt-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">{queueTickets.length}</p>
              <p className="text-sm opacity-90">In Queue</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <CardContent className="pt-6 text-center">
              <Droplets className="w-8 h-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">{inProgressTickets.length}</p>
              <p className="text-sm opacity-90">In Progress</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">{qualityCheckTickets.length}</p>
              <p className="text-sm opacity-90">QC</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">{completedTickets.length}</p>
              <p className="text-sm opacity-90">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Queue Columns */}
        <div className="grid md:grid-cols-4 gap-6">
          {/* Queue */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              Queue ({queueTickets.length})
            </h3>
            <div className="space-y-3">
              {queueTickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              {queueTickets.length === 0 && (
                <Card className="border-dashed border-2 border-slate-200">
                  <CardContent className="p-8 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No tickets in queue</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* In Progress */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-600" />
              In Progress ({inProgressTickets.length})
            </h3>
            <div className="space-y-3">
              {inProgressTickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              {inProgressTickets.length === 0 && (
                <Card className="border-dashed border-2 border-slate-200">
                  <CardContent className="p-8 text-center text-slate-400">
                    <Droplets className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No active washes</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Quality Check */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              Quality Check ({qualityCheckTickets.length})
            </h3>
            <div className="space-y-3">
              {qualityCheckTickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              {qualityCheckTickets.length === 0 && (
                <Card className="border-dashed border-2 border-slate-200">
                  <CardContent className="p-8 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No QC pending</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Completed */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Completed ({completedTickets.length})
            </h3>
            <div className="space-y-3">
              {completedTickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              {completedTickets.length === 0 && (
                <Card className="border-dashed border-2 border-slate-200">
                  <CardContent className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No completed washes</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bay Assignment Dialog */}
      <Dialog open={showBayAssignment} onOpenChange={setShowBayAssignment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Bay & Start Wash</DialogTitle>
          </DialogHeader>
          {ticketToStart && (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  <p className="font-medium">Ticket: {ticketToStart.ticket_number}</p>
                  <p className="text-sm">{ticketToStart.plate_number || 'N/A'} - {ticketToStart.customer_name || 'Walk-in'}</p>
                </AlertDescription>
              </Alert>

              <div>
                <Label>Select Bay</Label>
                <Select value={selectedBayId} onValueChange={setSelectedBayId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an available bay" />
                  </SelectTrigger>
                  <SelectContent>
                    {bays
                      .filter(b => 
                        b.branch_id === ticketToStart.branch_id && 
                        b.current_status === 'available' && 
                        b.status === 'active'
                      )
                      .map(bay => (
                        <SelectItem key={bay.id} value={bay.id}>
                          {bay.bay_number} - {bay.bay_type} ({bay.capacity})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-sm">
                <p className="text-slate-600">
                  This will:
                </p>
                <ul className="list-disc list-inside text-slate-600 mt-2 space-y-1">
                  <li>Assign the selected bay to this ticket</li>
                  <li>Mark the bay as occupied</li>
                  <li>Move the ticket to "In Progress" status</li>
                  <li>Start the wash timer</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBayAssignment(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleBayAssignmentConfirm}
              disabled={!selectedBayId}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Wash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Wash Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Ticket Number</p>
                  <p className="font-bold">{selectedTicket.ticket_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={statusColors[selectedTicket.status]}>
                    {selectedTicket.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="font-medium">{selectedTicket.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Vehicle</p>
                  <p className="font-medium">{selectedTicket.plate_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Branch</p>
                  <p className="font-medium">{selectedTicket.branch_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Bay</p>
                  <p className="font-medium">{selectedTicket.bay_number || 'Not assigned'}</p>
                </div>
              </div>

              {selectedTicket.services && selectedTicket.services.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Services</p>
                  <div className="space-y-2">
                    {selectedTicket.services.map((service, i) => (
                      <div key={i} className="flex justify-between p-2 bg-slate-50 rounded">
                        <span>{service.service_name}</span>
                        <span className="font-medium">{formatCurrency(service.price, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(selectedTicket.total_amount || 0, currency)}
                  </span>
                </div>
              </div>

              {selectedTicket.customer_notes && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Customer Notes</p>
                  <p className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200">
                    {selectedTicket.customer_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
