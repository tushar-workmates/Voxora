import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { 
  Phone, 
  Upload, 
  Eye, 
  Play,
  Users,
  PhoneCall,
  Clock,
  Plus,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { getAllLeads, createLead, deleteLead, makeCall, seedLeads, importCsvFile } from "@/services/api";

interface Lead {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function VoiceCalls() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [newLead, setNewLead] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
  });

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importCsvFile(file);
      if (result.success) {
        toast.success(`Successfully imported ${result.data?.insertedCount || 0} leads`);
        loadLeads();
      } else {
        toast.error("Failed to import CSV");
      }
    } catch (error) {
      console.error('CSV import error:', error);
      toast.error("Failed to import CSV");
    }
    event.target.value = '';
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setIsLoading(true);
      const result = await getAllLeads();
      if (result.success) {
        setLeads(result.data || []);
      } else {
        toast.error("Failed to load leads");
      }
    } catch (error) {
      console.error('Failed to load leads:', error);
      toast.error("Failed to load leads");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewLead(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createLead(newLead);
      if (result.success) {
        setNewLead({ fullName: "", email: "", phone: "", company: "" });
        toast.success("Lead added successfully");
        loadLeads();
      } else {
        toast.error("Failed to add lead");
      }
    } catch (error) {
      console.error('Failed to add lead:', error);
      toast.error("Failed to add lead");
    }
  };

  const handleCall = async (leadId: string, phone: string) => {
    try {
      const result = await makeCall(phone);
      // console.log('Call result:', result);
      
      // Check if call was successful - handle different response formats
      if (result && (result.success || result.message || result.call_uuid)) {
        toast.success("AI Voice Call initiated");
        loadLeads();
      } else {
        toast.error("Failed to initiate call");
      }
    } catch (error) {
      console.error('Failed to make call:', error);
      toast.error("Failed to initiate call");
    }
  };

  const handleBulkCall = async () => {
    try {
      const selectedLeadObjects = leads.filter(lead => selectedLeads.includes(lead._id));
      for (const lead of selectedLeadObjects) {
        await makeCall(lead.phone);
      }
      toast.success(`AI Voice Calls initiated for ${selectedLeads.length} leads`);
      setSelectedLeads([]);
      loadLeads();
    } catch (error) {
      console.error('Failed to make bulk calls:', error);
      toast.error("Failed to initiate calls");
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleViewTranscript = (leadName: string) => {
    toast.info(`Opening transcript for ${leadName}`);
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const result = await deleteLead(leadId);
      if (result.success) {
        toast.success("Lead deleted successfully");
        loadLeads();
      } else {
        toast.error("Failed to delete lead");
      }
    } catch (error) {
      console.error('Failed to delete lead:', error);
      toast.error("Failed to delete lead");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <UserCheck className="w-10 h-10 mr-3 text-blue-600" />
                Voice Calls
              </h1>
              <p className="text-muted-foreground">
                Manage leads and initiate AI-powered voice calls to grow your business
              </p>
            </div>
            <Button 
              onClick={loadLeads}
              disabled={isLoading}
              className="flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          <Card className="glass-card card-cyan hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700">Total Leads</CardTitle>
              <Users className="h-5 w-5 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-800">{leads.length}</div>
              <p className="text-xs text-cyan-600">
                Available for outreach
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-violet hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-violet-700">Calls Made</CardTitle>
              <PhoneCall className="h-5 w-5 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-800">{leads.filter(l => l.status === 'called').length}</div>
              <p className="text-xs text-violet-600">
                This month
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-emerald hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700">Success Rate</CardTitle>
              <Clock className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800">87%</div>
              <p className="text-xs text-emerald-600">
                Call completion rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Lead Form */}
        <Card className="glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add New Lead</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddLead} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <FormField
                id="fullName"
                name="fullName"
                label="Full Name"
                placeholder="John Doe"
                value={newLead.fullName}
                onChange={handleInputChange}
                required
              />
              <FormField
                id="email"
                name="email"
                type="email"
                label="Email"
                placeholder="john@company.com"
                value={newLead.email}
                onChange={handleInputChange}
                required
              />
              <FormField
                id="phone"
                name="phone"
                type="tel"
                label="Phone"
                placeholder="+1 (555) 123-4567"
                value={newLead.phone}
                onChange={handleInputChange}
                required
              />
              <FormField
                id="company"
                name="company"
                label="Company"
                placeholder="Company Inc"
                value={newLead.company}
                onChange={handleInputChange}
                required
              />
              <div className="flex items-end">
                <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-glow">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              </div>
            </form>
            
            <div className="mt-4 pt-4 border-t border-border flex gap-2">
              <div className="flex-1">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvImport}
                  className="hidden"
                  id="csv-upload"
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              </div>
              <Button 
                variant="outline" 
                onClick={async () => {
                  try {
                    const result = await seedLeads();
                    if (result.success) {
                      toast.success("Sample leads added");
                      loadLeads();
                    }
                  } catch (error) {
                    toast.error("Failed to add sample leads");
                  }
                }}
              >
                Add Sample Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedLeads.length > 0 && (
          <Card className="glass-card animate-scale-in border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                </span>
                <div className="space-x-2">
                  <Button onClick={handleBulkCall} className="gradient-primary text-primary-foreground shadow-glow">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Selected ({selectedLeads.length})
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedLeads([])}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leads Table */}
        <Card className="glass-card animate-slide-up delay-200">
          <CardHeader>
            <CardTitle>Lead Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={(e) => setSelectedLeads(e.target.checked ? leads.map(l => l._id) : [])}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">Company</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead._id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead._id)}
                          onChange={() => handleSelectLead(lead._id)}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{lead.fullName}</div>
                      </td>
                      <td className="p-4 text-muted-foreground">{lead.email}</td>
                      <td className="p-4 text-muted-foreground">{lead.phone}</td>
                      <td className="p-4 text-muted-foreground">{lead.company}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lead.status === 'called' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {lead.status === 'called' ? 'Called' : 'Pending'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleCall(lead._id, lead.phone)}
                            className="gradient-primary text-primary-foreground shadow-glow"
                            disabled={lead.status === 'called'}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                          {lead.status === 'called' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="hover:bg-accent/10 hover:text-accent"
                              onClick={() => handleViewTranscript(lead.fullName)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteLead(lead._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}