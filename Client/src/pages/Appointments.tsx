import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar,
  Clock,
  Phone,
  Target,
  Search,
  RefreshCw,
  User,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { getAppointments, confirmAppointment } from "@/services/api";

interface Appointment {
  _id: string;
  name: string;
  phoneNumber: string;
  date: string;
  purpose: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading appointments...');
      const result = await getAppointments();
      console.log('📋 Appointments API response:', result);
      if (result.success) {
        setAppointments(result.appointments || []);
        console.log('✅ Appointments loaded:', result.appointments?.length || 0);
      } else {
        console.log('❌ API returned error:', result);
        toast.error("Failed to load appointments");
      }
    } catch (error) {
      console.error('❌ Failed to load appointments:', error);
      toast.error("Failed to load appointments");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    try {
      const result = await confirmAppointment(appointmentId);
      if (result.success) {
        toast.success("Appointment confirmed successfully");
        loadAppointments(); // Reload to show updated status
      } else {
        toast.error("Failed to confirm appointment");
      }
    } catch (error) {
      console.error('❌ Failed to confirm appointment:', error);
      toast.error("Failed to confirm appointment");
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    appointment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.phoneNumber.includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Appointments</h1>
          <p className="text-muted-foreground">
            Manage and view all appointments booked through voice calls
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
          <Card className="glass-card card-blue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total</CardTitle>
              <Calendar className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800">{appointments.length}</div>
            </CardContent>
          </Card>

          <Card className="glass-card card-amber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">Pending</CardTitle>
              <Clock className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-800">
                {appointments.filter(a => a.status === 'pending').length}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card card-emerald">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700">Confirmed</CardTitle>
              <Calendar className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800">
                {appointments.filter(a => a.status === 'confirmed').length}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card card-purple">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">This Week</CardTitle>
              <Target className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-800">
                {appointments.filter(a => {
                  const appointmentDate = new Date(a.date);
                  const now = new Date();
                  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                  return appointmentDate >= now && appointmentDate <= weekFromNow;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="glass-card animate-slide-up">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Search & Filter</CardTitle>
              <Button 
                onClick={loadAppointments}
                disabled={isLoading}
                className="flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search appointments by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </CardContent>
        </Card>

        {/* Appointments Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-slide-up">
          {filteredAppointments.map(appointment => (
            <Card key={appointment._id} className="glass-card hover:shadow-lg transition-all duration-200 hover:border-blue-300 group">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{appointment.name}</h3>
                      <div className="flex items-center text-gray-600 text-sm mt-1">
                        <Phone className="w-4 h-4 mr-1" />
                        <span className="font-mono">{appointment.phoneNumber}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      appointment.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      appointment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                      appointment.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                      'bg-gray-100 text-gray-800 border-gray-200'
                    }`}>
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex items-center text-gray-700">
                    <Target className="w-4 h-4 mr-3 text-blue-500 flex-shrink-0" />
                    <span className="text-sm">{appointment.purpose}</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <Calendar className="w-4 h-4 mr-3 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      {new Date(appointment.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <Clock className="w-4 h-4 mr-3 flex-shrink-0" />
                    <span className="text-xs">
                      Created {new Date(appointment.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Confirm Button */}
                {appointment.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button 
                      onClick={() => handleConfirmAppointment(appointment._id)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirm Appointment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredAppointments.length === 0 && !isLoading && (
          <Card className="glass-card">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No matching appointments' : 'No appointments yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Appointments will appear here once booked through voice calls.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
