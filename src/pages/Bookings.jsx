
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, formatCurrency, createPageUrl } from "@/components/utils";
import { Calendar, Clock, Plus, X, Save, Mail, MessageSquare, Check, XCircle, User, Car } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, startOfWeek, addWeeks, isSameDay, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function BookingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings } = useSettings(); // Initialize useSettings
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewType, setViewType] = useState("calendar");

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createBookingMutation = useMutation({
    mutationFn: (data) => base44.entities.Booking.create(data),
    onSuccess: async (booking) => {
      queryClient.invalidateQueries(['bookings']);
      
      // Send confirmation notification
      if (booking.customer_email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: booking.customer_email,
            subject: `Booking Confirmation - ${booking.booking_number}`,
            body: `Dear ${booking.customer_name},\n\nYour car wash booking has been confirmed!\n\nDetails:\n- Date: ${booking.booking_date}\n- Time: ${booking.booking_time}\n- Branch: ${booking.branch_name}\n- Vehicle: ${booking.plate_number}\n\nThank you for choosing E-COMWash!\n\nBest regards,\nE-COMWash Team`
          });
          
          // Update confirmation status
          await base44.entities.Booking.update(booking.id, { confirmation_sent: true });
        } catch (error) {
          console.error('Failed to send confirmation email:', error);
        }
      }
      
      setShowBookingDialog(false);
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      setShowDetailsDialog(false);
    },
  });

  const checkInBookingMutation = useMutation({
    mutationFn: async (booking) => {
      // Create wash ticket from booking
      const ticketData = {
        ticket_number: `TKT-${Date.now()}`,
        branch_id: booking.branch_id,
        branch_name: booking.branch_name,
        customer_id: booking.customer_id,
        customer_name: booking.customer_name,
        vehicle_id: booking.vehicle_id,
        plate_number: booking.plate_number,
        vehicle_category: booking.vehicle_category,
        services: booking.services,
        subtotal: booking.estimated_cost,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: booking.estimated_cost,
        status: 'queue',
        payment_status: 'pending',
        check_in_time: new Date().toISOString(),
        customer_notes: booking.special_requests
      };
      
      const ticket = await base44.entities.WashTicket.create(ticketData);
      
      // Update booking status
      await base44.entities.Booking.update(booking.id, {
        status: 'checked_in',
        wash_ticket_id: ticket.id
      });
      
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['washTickets']);
      setShowDetailsDialog(false);
      alert('Customer checked in! Wash ticket created.');
    },
  });

  const [bookingFormData, setBookingFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    branch_id: '',
    booking_date: format(new Date(), 'yyyy-MM-dd'),
    booking_time: '09:00',
    services: [],
    assigned_employee_id: '',
    special_requests: ''
  });

  const handleOpenBookingDialog = () => {
    setBookingFormData({
      customer_id: '',
      vehicle_id: '',
      branch_id: '',
      booking_date: format(selectedDate, 'yyyy-MM-dd'),
      booking_time: '09:00',
      services: [],
      assigned_employee_id: '',
      special_requests: ''
    });
    setShowBookingDialog(true);
  };

  const addServiceToBooking = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    if (service && !bookingFormData.services.find(s => s.service_id === serviceId)) {
      setBookingFormData({
        ...bookingFormData,
        services: [...bookingFormData.services, {
          service_id: service.id,
          service_name: service.service_name,
          price: service.retail_price,
          duration: service.duration_minutes
        }]
      });
    }
  };

  const removeServiceFromBooking = (serviceId) => {
    setBookingFormData({
      ...bookingFormData,
      services: bookingFormData.services.filter(s => s.service_id !== serviceId)
    });
  };

  const handleSubmitBooking = (e) => {
    e.preventDefault();
    
    const customer = customers.find(c => c.id === bookingFormData.customer_id);
    const vehicle = vehicles.find(v => v.id === bookingFormData.vehicle_id);
    const branch = branches.find(b => b.id === bookingFormData.branch_id);
    const employee = employees.find(e => e.id === bookingFormData.assigned_employee_id);
    
    const estimatedDuration = bookingFormData.services.reduce((sum, s) => sum + s.duration, 0);
    const estimatedCost = bookingFormData.services.reduce((sum, s) => sum + s.price, 0);
    
    const bookingData = {
      booking_number: `BK-${Date.now()}`,
      booking_date: bookingFormData.booking_date,
      booking_time: bookingFormData.booking_time,
      customer_id: bookingFormData.customer_id,
      customer_name: customer?.name,
      customer_email: customer?.email,
      customer_phone: customer?.phone,
      vehicle_id: bookingFormData.vehicle_id,
      plate_number: vehicle?.plate_number,
      vehicle_category: vehicle?.vehicle_category,
      branch_id: bookingFormData.branch_id,
      branch_name: branch?.branch_name,
      services: bookingFormData.services,
      estimated_duration: estimatedDuration,
      estimated_cost: estimatedCost,
      assigned_employee_id: bookingFormData.assigned_employee_id || null,
      assigned_employee_name: employee?.full_name || null,
      special_requests: bookingFormData.special_requests,
      status: 'confirmed',
      confirmation_sent: false,
      reminder_sent: false
    };
    
    createBookingMutation.mutate(bookingData);
  };

  const handleCancelBooking = async (booking) => {
    const reason = prompt('Cancellation reason:');
    if (reason) {
      await updateBookingMutation.mutateAsync({
        id: booking.id,
        data: {
          status: 'cancelled',
          cancelled_reason: reason,
          cancelled_by: 'staff'
        }
      });
      
      // Send cancellation email
      if (booking.customer_email) {
        await base44.integrations.Core.SendEmail({
          to: booking.customer_email,
          subject: `Booking Cancelled - ${booking.booking_number}`,
          body: `Dear ${booking.customer_name},\n\nYour booking has been cancelled.\n\nReason: ${reason}\n\nPlease contact us to reschedule.\n\nBest regards,\nE-COMWash Team`
        });
      }
    }
  };

  // Generate week view
  const startDate = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  
  const timeSlots = Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const getBookingsForDateTime = (date, time) => {
    return bookings.filter(b => 
      b.booking_date === format(date, 'yyyy-MM-dd') && 
      b.booking_time === time &&
      ['confirmed', 'pending'].includes(b.status)
    );
  };

  const todayBookings = bookings.filter(b => 
    b.booking_date === format(new Date(), 'yyyy-MM-dd') &&
    ['confirmed', 'pending', 'checked_in'].includes(b.status)
  );

  const upcomingBookings = bookings.filter(b => 
    new Date(b.booking_date) >= new Date() &&
    ['confirmed', 'pending'].includes(b.status)
  ).slice(0, 10);

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    checked_in: 'bg-green-100 text-green-800 border-green-200',
    in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-slate-100 text-slate-800 border-slate-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
    no_show: 'bg-orange-100 text-orange-800 border-orange-200'
  };

  const customerVehicles = bookingFormData.customer_id
    ? vehicles.filter(v => v.customer_id === bookingFormData.customer_id)
    : [];

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              Bookings & Appointments
            </h1>
            <p className="text-slate-500 mt-1">Manage customer appointments and schedules</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleOpenBookingDialog} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Calendar className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{todayBookings.length}</p>
              <p className="text-sm opacity-90">Today's Bookings</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Check className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                {bookings.filter(b => b.status === 'confirmed').length}
              </p>
              <p className="text-sm opacity-90">Confirmed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Clock className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                {bookings.filter(b => b.status === 'pending').length}
              </p>
              <p className="text-sm opacity-90">Pending</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Mail className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">
                {bookings.filter(b => !b.confirmation_sent && b.status === 'confirmed').length}
              </p>
              <p className="text-sm opacity-90">Pending Notifications</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={viewType} onValueChange={setViewType}>
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          </TabsList>

          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Week of {format(startDate, 'MMM d, yyyy')}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(addWeeks(selectedDate, -1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-2 mb-2">
                      <div className="font-semibold text-sm text-slate-600">Time</div>
                      {weekDays.map(day => (
                        <div key={day.toString()} className="font-semibold text-sm text-center">
                          <div>{format(day, 'EEE')}</div>
                          <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-blue-600' : ''}`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Time slots */}
                    <div className="space-y-1">
                      {timeSlots.map(time => (
                        <div key={time} className="grid grid-cols-8 gap-2">
                          <div className="text-sm text-slate-600 py-2">{time}</div>
                          {weekDays.map(day => {
                            const dayBookings = getBookingsForDateTime(day, time);
                            return (
                              <div
                                key={`${day}-${time}`}
                                className="border rounded p-1 min-h-[60px] hover:bg-slate-50 cursor-pointer"
                                onClick={() => {
                                  setSelectedDate(day);
                                  handleOpenBookingDialog();
                                }}
                              >
                                {dayBookings.map(booking => (
                                  <div
                                    key={booking.id}
                                    className="text-xs p-1 mb-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBooking(booking);
                                      setShowDetailsDialog(true);
                                    }}
                                  >
                                    <div className="font-medium truncate">{booking.customer_name}</div>
                                    <div className="truncate">{booking.plate_number}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>All Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bookings.filter(b => ['pending', 'confirmed', 'checked_in'].includes(b.status)).map(booking => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{booking.customer_name}</p>
                          <p className="text-sm text-slate-500">
                            {format(parseISO(booking.booking_date), 'MMM d, yyyy')} at {booking.booking_time}
                          </p>
                          <p className="text-sm text-slate-500">{booking.plate_number} • {booking.branch_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={statusColors[booking.status]}>
                          {booking.status}
                        </Badge>
                        <p className="text-sm font-bold text-green-600 mt-1">
                          {formatCurrency(booking.estimated_cost, settings.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upcoming */}
          <TabsContent value="upcoming" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Upcoming Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingBookings.map(booking => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium">{booking.customer_name}</p>
                        <p className="text-sm text-slate-500">
                          {format(parseISO(booking.booking_date), 'EEE, MMM d')} at {booking.booking_time}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {!booking.confirmation_sent && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                              <Mail className="w-3 h-3 mr-1" />
                              Send Confirmation
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowDetailsDialog(true);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select
                  value={bookingFormData.customer_id}
                  onValueChange={(value) => setBookingFormData({...bookingFormData, customer_id: value, vehicle_id: ''})}
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

              <div>
                <Label>Vehicle *</Label>
                <Select
                  value={bookingFormData.vehicle_id}
                  onValueChange={(value) => setBookingFormData({...bookingFormData, vehicle_id: value})}
                  disabled={!bookingFormData.customer_id}
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

              <div>
                <Label>Branch *</Label>
                <Select
                  value={bookingFormData.branch_id}
                  onValueChange={(value) => setBookingFormData({...bookingFormData, branch_id: value})}
                >
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
                <Label>Assigned Employee</Label>
                <Select
                  value={bookingFormData.assigned_employee_id}
                  onValueChange={(value) => setBookingFormData({...bookingFormData, assigned_employee_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.position === 'washer' && e.status === 'active').map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={bookingFormData.booking_date}
                  onChange={(e) => setBookingFormData({...bookingFormData, booking_date: e.target.value})}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>

              <div>
                <Label>Time *</Label>
                <Select
                  value={bookingFormData.booking_time}
                  onValueChange={(value) => setBookingFormData({...bookingFormData, booking_time: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Services *</Label>
              <div className="space-y-2 mt-2">
                {bookingFormData.services.map(service => (
                  <div key={service.service_id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="text-sm">{service.service_name} - {formatCurrency(service.price, settings.currency)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeServiceFromBooking(service.service_id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Select onValueChange={addServiceToBooking}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.filter(s => !bookingFormData.services.find(bs => bs.service_id === s.id)).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.service_name} - {formatCurrency(s.retail_price, settings.currency)} ({s.duration_minutes} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Special Requests</Label>
              <Textarea
                value={bookingFormData.special_requests}
                onChange={(e) => setBookingFormData({...bookingFormData, special_requests: e.target.value})}
                placeholder="Any special requests or notes..."
                rows={3}
              />
            </div>

            {bookingFormData.services.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Estimated Duration:</span>
                  <span className="font-medium">
                    {bookingFormData.services.reduce((sum, s) => sum + s.duration, 0)} minutes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Estimated Cost:</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(bookingFormData.services.reduce((sum, s) => sum + s.price, 0), settings.currency)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBookingDialog(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!bookingFormData.customer_id || !bookingFormData.vehicle_id || !bookingFormData.branch_id || bookingFormData.services.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                Create Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Booking Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Booking Number</p>
                  <p className="font-bold">{selectedBooking.booking_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={statusColors[selectedBooking.status]}>
                    {selectedBooking.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="font-medium">{selectedBooking.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Vehicle</p>
                  <p className="font-medium">{selectedBooking.plate_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date & Time</p>
                  <p className="font-medium">
                    {format(parseISO(selectedBooking.booking_date), 'MMM d, yyyy')} at {selectedBooking.booking_time}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Branch</p>
                  <p className="font-medium">{selectedBooking.branch_name}</p>
                </div>
              </div>

              {selectedBooking.services && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Services</p>
                  {selectedBooking.services.map((s, i) => (
                    <div key={i} className="flex justify-between p-2 bg-slate-50 rounded mb-1">
                      <span>{s.service_name}</span>
                      <span className="font-medium">{formatCurrency(s.price, settings.currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedBooking.special_requests && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Special Requests</p>
                  <p className="text-sm bg-yellow-50 p-3 rounded">{selectedBooking.special_requests}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Estimated Total</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(selectedBooking.estimated_cost, settings.currency)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {selectedBooking.status === 'confirmed' && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => checkInBookingMutation.mutate(selectedBooking)}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Check In
                  </Button>
                )}
                {['confirmed', 'pending'].includes(selectedBooking.status) && (
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => handleCancelBooking(selectedBooking)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Booking
                  </Button>
                )}
                {selectedBooking.wash_ticket_id && (
                  <Button
                    className="flex-1"
                    onClick={() => navigate(createPageUrl('Queue'))}
                  >
                    View Ticket
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
