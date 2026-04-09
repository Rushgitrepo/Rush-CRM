import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Eye, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  FileText,
  Calendar,
  Building,
  User,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';

interface Offer {
  id: string;
  offer_number: string;
  candidate_name: string;
  candidate_email: string;
  position: string;
  department: string;
  base_salary: number;
  currency: string;
  salary_frequency: string;
  employment_type: string;
  status: string;
  start_date: string;
  response_deadline?: string;
  created_at: string;
  offer_sent_date?: string;
  accepted_date?: string;
  rejected_date?: string;
}

interface OfferStats {
  draft_count: number;
  pending_approval_count: number;
  sent_count: number;
  accepted_count: number;
  rejected_count: number;
  expired_count: number;
  avg_accepted_salary: number;
  sent_last_30_days: number;
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [stats, setStats] = useState<OfferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  // Create Offer Form State
  const [offerForm, setOfferForm] = useState({
    candidateId: '',
    requisitionId: '',
    position: '',
    department: '',
    grade: '',
    reportingManager: '',
    workLocation: '',
    employmentType: 'full_time',
    baseSalary: '',
    currency: 'PKR',
    salaryFrequency: 'monthly',
    bonusPercentage: '',
    allowances: '',
    benefits: '',
    startDate: '',
    probationPeriod: '3',
    noticePeriod: '30',
    workingHours: '9:00 AM - 6:00 PM',
    responseDeadline: '',
    specialConditions: ''
  });

  const fetchCandidates = async () => {
    try {
      // Fetch candidates who have completed interviews or are in final stages
      const data = await recruitmentApi.getCandidates({ 
        status: 'interviewed,final_round,selected' 
      });
      console.log('Fetched candidates for offers:', data);
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    }
  };

  const fetchRequisitions = async () => {
    try {
      const data = await recruitmentApi.getRequisitions({ status: 'approved' });
      console.log('Fetched requisitions:', data);
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Failed to load requisitions');
    }
  };

  useEffect(() => {
    if (createDialogOpen) {
      fetchCandidates();
      fetchRequisitions();
    }
  }, [createDialogOpen]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedStatus !== 'all') params.status = selectedStatus;
      
      const data = await recruitmentApi.getAllOffers(params);
      setOffers(data);
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await recruitmentApi.getOfferStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching offer stats:', error);
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchStats();
  }, [selectedStatus]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      pending_approval: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { color: 'bg-blue-100 text-blue-800', label: 'Approved' },
      sent: { color: 'bg-purple-100 text-purple-800', label: 'Sent' },
      accepted: { color: 'bg-green-100 text-green-800', label: 'Accepted' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      withdrawn: { color: 'bg-orange-100 text-orange-800', label: 'Withdrawn' },
      expired: { color: 'bg-gray-100 text-gray-800', label: 'Expired' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleSendOffer = async (offerId: string) => {
    try {
      await recruitmentApi.sendOfferLetter(offerId);
      toast.success('Offer letter sent successfully!');
      fetchOffers();
    } catch (error) {
      console.error('Error sending offer:', error);
      toast.error('Failed to send offer letter');
    }
  };

  const handleUpdateStatus = async (offerId: string, status: string, comments?: string) => {
    try {
      await recruitmentApi.updateOfferStatus(offerId, { status, comments });
      toast.success(`Offer ${status} successfully!`);
      fetchOffers();
    } catch (error) {
      console.error('Error updating offer status:', error);
      toast.error('Failed to update offer status');
    }
  };

  const handleCreateOffer = async () => {
    if (!offerForm.candidateId || !offerForm.requisitionId || !offerForm.baseSalary || !offerForm.startDate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setCreating(true);
      
      // Parse allowances if provided
      let allowancesObj = null;
      if (offerForm.allowances) {
        try {
          allowancesObj = JSON.parse(offerForm.allowances);
        } catch (e) {
          // If not valid JSON, treat as simple text
          allowancesObj = { other: offerForm.allowances };
        }
      }

      await recruitmentApi.createOffer({
        candidateId: offerForm.candidateId,
        requisitionId: offerForm.requisitionId,
        position: offerForm.position,
        department: offerForm.department,
        grade: offerForm.grade || undefined,
        reportingManager: offerForm.reportingManager || undefined,
        workLocation: offerForm.workLocation,
        employmentType: offerForm.employmentType,
        baseSalary: parseFloat(offerForm.baseSalary),
        currency: offerForm.currency,
        salaryFrequency: offerForm.salaryFrequency,
        bonusPercentage: offerForm.bonusPercentage ? parseFloat(offerForm.bonusPercentage) : undefined,
        allowances: allowancesObj,
        benefits: offerForm.benefits || undefined,
        startDate: offerForm.startDate,
        probationPeriod: offerForm.probationPeriod ? parseInt(offerForm.probationPeriod) : undefined,
        noticePeriod: offerForm.noticePeriod ? parseInt(offerForm.noticePeriod) : undefined,
        workingHours: offerForm.workingHours || undefined,
        responseDeadline: offerForm.responseDeadline || undefined,
        specialConditions: offerForm.specialConditions || undefined
      });

      toast.success('Job offer created successfully!');
      setCreateDialogOpen(false);
      
      // Reset form
      setOfferForm({
        candidateId: '',
        requisitionId: '',
        position: '',
        department: '',
        grade: '',
        reportingManager: '',
        workLocation: '',
        employmentType: 'full_time',
        baseSalary: '',
        currency: 'PKR',
        salaryFrequency: 'monthly',
        bonusPercentage: '',
        allowances: '',
        benefits: '',
        startDate: '',
        probationPeriod: '3',
        noticePeriod: '30',
        workingHours: '9:00 AM - 6:00 PM',
        responseDeadline: '',
        specialConditions: ''
      });
      
      fetchOffers();
      fetchStats();
    } catch (error: any) {
      console.error('Error creating offer:', error);
      toast.error(error.message || 'Failed to create job offer');
    } finally {
      setCreating(false);
    }
  };

  const handleCandidateChange = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      setOfferForm({
        ...offerForm,
        candidateId,
        position: candidate.applied_position || '',
        requisitionId: candidate.requisition_id || ''
      });
    }
  };

  const handleRequisitionChange = (requisitionId: string) => {
    const requisition = requisitions.find(r => r.id === requisitionId);
    if (requisition) {
      setOfferForm({
        ...offerForm,
        requisitionId,
        position: requisition.position || offerForm.position,
        department: requisition.department || ''
      });
    }
  };

  const filteredOffers = offers.filter(offer =>
    offer.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.offer_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Job Offers</h1>
          <p className="text-muted-foreground">Manage job offers and compensation packages</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Offer
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">{stats.sent_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold">{stats.accepted_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending_approval_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Salary</p>
                  <p className="text-2xl font-bold">
                    {stats.avg_accepted_salary ? `${Math.round(stats.avg_accepted_salary).toLocaleString()}` : '0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search offers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchOffers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Offers List */}
      <Card>
        <CardHeader>
          <CardTitle>Job Offers ({filteredOffers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading offers...</div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No offers found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOffers.map((offer) => (
                <div key={offer.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold">{offer.offer_number}</h3>
                        {getStatusBadge(offer.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>{offer.candidate_name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4" />
                          <span>{offer.position} - {offer.department}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4" />
                          <span>
                            {offer.currency} {offer.base_salary.toLocaleString()} / {offer.salary_frequency}
                          </span>
                        </div>
                      </div>
                      
                      {offer.response_deadline && (
                        <div className="flex items-center space-x-2 text-sm text-orange-600">
                          <Calendar className="h-4 w-4" />
                          <span>Response by: {new Date(offer.response_deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOffer(offer);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      
                      {offer.status === 'approved' && (
                        <Button
                          size="sm"
                          onClick={() => handleSendOffer(offer.id)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Offer Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Offer Details - {selectedOffer?.offer_number}</DialogTitle>
          </DialogHeader>
          
          {selectedOffer && (
            <div className="space-y-6">
              {/* Candidate Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Candidate</Label>
                  <p className="text-sm">{selectedOffer.candidate_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm">{selectedOffer.candidate_email}</p>
                </div>
              </div>
              
              {/* Position Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Position</Label>
                  <p className="text-sm">{selectedOffer.position}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <p className="text-sm">{selectedOffer.department}</p>
                </div>
              </div>
              
              {/* Compensation */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Base Salary</Label>
                  <p className="text-sm">{selectedOffer.currency} {selectedOffer.base_salary.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Frequency</Label>
                  <p className="text-sm capitalize">{selectedOffer.salary_frequency}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Employment Type</Label>
                  <p className="text-sm capitalize">{selectedOffer.employment_type.replace('_', ' ')}</p>
                </div>
              </div>
              
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <p className="text-sm">{new Date(selectedOffer.start_date).toLocaleDateString()}</p>
                </div>
                {selectedOffer.response_deadline && (
                  <div>
                    <Label className="text-sm font-medium">Response Deadline</Label>
                    <p className="text-sm">{new Date(selectedOffer.response_deadline).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              
              {/* Status Actions */}
              <div className="flex space-x-2 pt-4 border-t">
                {selectedOffer.status === 'sent' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedOffer.id, 'accepted')}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Accepted
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedOffer.id, 'rejected')}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark Rejected
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Offer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Offer</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Loading State */}
            {(candidates.length === 0 || requisitions.length === 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Loading candidates and requisitions...</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {candidates.length === 0 && 'Fetching eligible candidates... '}
                      {requisitions.length === 0 && 'Fetching approved requisitions...'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate & Requisition Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidateId">Select Candidate *</Label>
                <Select
                  value={offerForm.candidateId}
                  onValueChange={handleCandidateChange}
                  disabled={candidates.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      candidates.length === 0 
                        ? "No candidates available" 
                        : "Choose candidate"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No eligible candidates found</p>
                        <p className="text-xs mt-1">Candidates must complete interviews first</p>
                      </div>
                    ) : (
                      candidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.full_name} - {candidate.applied_position || 'N/A'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {candidates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tip: Complete interviews to make candidates eligible for offers
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="requisitionId">Requisition *</Label>
                <Select
                  value={offerForm.requisitionId}
                  onValueChange={handleRequisitionChange}
                  disabled={requisitions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      requisitions.length === 0 
                        ? "No requisitions available" 
                        : "Choose requisition"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {requisitions.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No approved requisitions found</p>
                      </div>
                    ) : (
                      requisitions.map((req) => (
                        <SelectItem key={req.id} value={req.id}>
                          {req.requisition_id} - {req.position}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Position Details */}            {/* Position Details */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Position Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    value={offerForm.position}
                    onChange={(e) => setOfferForm({ ...offerForm, position: e.target.value })}
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={offerForm.department}
                    onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })}
                    placeholder="e.g., IT"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade">Grade/Level</Label>
                  <Input
                    id="grade"
                    value={offerForm.grade}
                    onChange={(e) => setOfferForm({ ...offerForm, grade: e.target.value })}
                    placeholder="e.g., GD 7-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportingManager">Reporting Manager</Label>
                  <Input
                    id="reportingManager"
                    value={offerForm.reportingManager}
                    onChange={(e) => setOfferForm({ ...offerForm, reportingManager: e.target.value })}
                    placeholder="Manager name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workLocation">Work Location *</Label>
                  <Input
                    id="workLocation"
                    value={offerForm.workLocation}
                    onChange={(e) => setOfferForm({ ...offerForm, workLocation: e.target.value })}
                    placeholder="e.g., Lahore, Pakistan"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type *</Label>
                  <Select
                    value={offerForm.employmentType}
                    onValueChange={(value) => setOfferForm({ ...offerForm, employmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Compensation */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Compensation Package</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseSalary">Base Salary *</Label>
                  <Input
                    id="baseSalary"
                    type="number"
                    value={offerForm.baseSalary}
                    onChange={(e) => setOfferForm({ ...offerForm, baseSalary: e.target.value })}
                    placeholder="150000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={offerForm.currency}
                    onValueChange={(value) => setOfferForm({ ...offerForm, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryFrequency">Frequency</Label>
                  <Select
                    value={offerForm.salaryFrequency}
                    onValueChange={(value) => setOfferForm({ ...offerForm, salaryFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bonusPercentage">Bonus Percentage (%)</Label>
                  <Input
                    id="bonusPercentage"
                    type="number"
                    value={offerForm.bonusPercentage}
                    onChange={(e) => setOfferForm({ ...offerForm, bonusPercentage: e.target.value })}
                    placeholder="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowances">Allowances (JSON or text)</Label>
                  <Input
                    id="allowances"
                    value={offerForm.allowances}
                    onChange={(e) => setOfferForm({ ...offerForm, allowances: e.target.value })}
                    placeholder='{"transport": 5000, "medical": 3000}'
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">Benefits & Perks</Label>
                <Textarea
                  id="benefits"
                  value={offerForm.benefits}
                  onChange={(e) => setOfferForm({ ...offerForm, benefits: e.target.value })}
                  placeholder="Health insurance, provident fund, annual leaves..."
                  rows={3}
                />
              </div>
            </div>

            {/* Employment Terms */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Employment Terms</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={offerForm.startDate}
                    onChange={(e) => setOfferForm({ ...offerForm, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responseDeadline">Response Deadline</Label>
                  <Input
                    id="responseDeadline"
                    type="date"
                    value={offerForm.responseDeadline}
                    onChange={(e) => setOfferForm({ ...offerForm, responseDeadline: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="probationPeriod">Probation Period (months)</Label>
                  <Input
                    id="probationPeriod"
                    type="number"
                    value={offerForm.probationPeriod}
                    onChange={(e) => setOfferForm({ ...offerForm, probationPeriod: e.target.value })}
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="noticePeriod">Notice Period (days)</Label>
                  <Input
                    id="noticePeriod"
                    type="number"
                    value={offerForm.noticePeriod}
                    onChange={(e) => setOfferForm({ ...offerForm, noticePeriod: e.target.value })}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="workingHours">Working Hours</Label>
                  <Input
                    id="workingHours"
                    value={offerForm.workingHours}
                    onChange={(e) => setOfferForm({ ...offerForm, workingHours: e.target.value })}
                    placeholder="9:00 AM - 6:00 PM"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialConditions">Special Conditions</Label>
                <Textarea
                  id="specialConditions"
                  value={offerForm.specialConditions}
                  onChange={(e) => setOfferForm({ ...offerForm, specialConditions: e.target.value })}
                  placeholder="Any special terms or conditions..."
                  rows={3}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateOffer} disabled={creating}>
                {creating ? 'Creating...' : 'Create Offer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}