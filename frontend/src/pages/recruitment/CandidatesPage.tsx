import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Upload, Eye, FileCheck, CheckCircle, RefreshCw, UserCheck, X, Copy, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [formLinkDialogOpen, setFormLinkDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [generatedFormData, setGeneratedFormData] = useState<any>(null);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [uploadData, setUploadData] = useState({
    requisitionId: '',
    source: 'cv_upload'
  });
  const [screeningData, setScreeningData] = useState({
    screeningResult: 'passed' as 'passed' | 'failed',
    screeningNotes: ''
  });
  const [interviewData, setInterviewData] = useState({
    interviewType: 'technical',
    interviewDate: '',
    interviewTime: '',
    interviewerName: ''
  });

  useEffect(() => {
    fetchCandidates();
    fetchRequisitions();
  }, []);

  const fetchRequisitions = async () => {
    try {
      const data = await recruitmentApi.getRequisitions({ status: 'approved' });
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getCandidates({ search: searchQuery });
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchCandidates();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      cv_received: { label: 'CV Received', variant: 'secondary' },
      screened_passed: { label: 'Screening Passed', variant: 'default' },
      screened_failed: { label: 'Screening Failed', variant: 'destructive' },
      shortlisted: { label: 'Shortlisted', variant: 'default' },
      interview_scheduled: { label: 'Interview Scheduled', variant: 'default' },
      interviewed: { label: 'Interviewed', variant: 'default' },
      final_round: { label: 'Final Round', variant: 'default' },
      form_generated: { label: 'Form Generated', variant: 'default' },
      selected: { label: 'Selected', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleUploadCV = async () => {
    if (!uploadData.requisitionId) {
      toast.error('Please select a requisition');
      return;
    }

    if (!selectedFile) {
      toast.error('Please select a CV file to upload');
      return;
    }

    try {
      console.log('=== Uploading CV ===');
      console.log('Requisition ID:', uploadData.requisitionId);
      console.log('File:', selectedFile.name, selectedFile.type, selectedFile.size);
      
      const formData = new FormData();
      formData.append('cv', selectedFile);
      formData.append('requisitionId', uploadData.requisitionId);
      formData.append('source', uploadData.source);

      console.log('Calling recruitmentApi.uploadCV...');
      
      const result = await recruitmentApi.uploadCV(formData);
      
      toast.success('CV uploaded and parsed successfully!');
      console.log('Upload result:', result);
      console.log('Parsed data:', result.parsedData);
      
      setUploadDialogOpen(false);
      setUploadData({
        requisitionId: '',
        source: 'cv_upload'
      });
      setSelectedFile(null);
      fetchCandidates();
    } catch (error: any) {
      console.error('=== Upload Error ===');
      console.error('Error:', error);
      toast.error(error.message || 'Failed to upload CV');
    }
  };

  const handleShortlist = async (candidateId: string) => {
    try {
      // First find the candidate before API call
      const candidate = candidates.find(c => c.id === candidateId);
      
      await recruitmentApi.shortlistCandidate(candidateId);
      toast.success('Candidate shortlisted!');
      
      // Open interview scheduling dialog
      if (candidate) {
        setSelectedCandidate(candidate);
        setInterviewDialogOpen(true);
      }
      
      // Don't fetch immediately - let dialog close first
      // fetchCandidates will be called after interview is scheduled
    } catch (error: any) {
      console.error('Error shortlisting candidate:', error);
      toast.error(error.message || 'Failed to shortlist candidate');
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedCandidate) return;
    
    try {
      console.log('Selected candidate:', selectedCandidate);
      console.log('Requisition ID:', selectedCandidate.requisition_id);
      
      // Ensure requisition_id is a valid UUID string
      const requisitionId = selectedCandidate.requisition_id?.toString() || selectedCandidate.requisition_id;
      
      if (!requisitionId) {
        toast.error('Requisition ID is missing for this candidate');
        return;
      }
      
      await recruitmentApi.scheduleInterview({
        candidateId: selectedCandidate.id,
        requisitionId: requisitionId,
        interviewType: interviewData.interviewType,
        interviewDate: interviewData.interviewDate,
        interviewTime: interviewData.interviewTime,
        interviewerName: interviewData.interviewerName
      });
      
      toast.success('Interview scheduled successfully!');
      setInterviewDialogOpen(false);
      setInterviewData({
        interviewType: 'technical',
        interviewDate: '',
        interviewTime: '',
        interviewerName: ''
      });
      setSelectedCandidate(null);
      fetchCandidates();
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      toast.error(error.message || 'Failed to schedule interview');
    }
  };

  // New Workflow Functions
  const handleScreening = async () => {
    if (!selectedCandidate) return;
    
    try {
      await recruitmentApi.screenCandidate(selectedCandidate.id, screeningData);
      toast.success(`Candidate screening ${screeningData.screeningResult}!`);
      setScreeningDialogOpen(false);
      setScreeningData({ screeningResult: 'passed', screeningNotes: '' });
      setSelectedCandidate(null);
      fetchCandidates();
    } catch (error: any) {
      console.error('Error screening candidate:', error);
      toast.error(error.message || 'Failed to screen candidate');
    }
  };

  const handleGenerateForm = async (candidateId: string) => {
    try {
      console.log('=== Frontend: Generating form for candidate:', candidateId);
      
      // Use the API client instead of direct fetch
      const result = await recruitmentApi.generateApplicationForm(candidateId);
      console.log('Success result:', result);
      
      // Find the candidate for display
      const candidate = candidates.find(c => c.id === candidateId);
      
      // Set the form data and open modal
      setGeneratedFormData({
        ...result,
        candidateName: candidate?.full_name || 'Unknown',
        candidatePosition: candidate?.applied_position || 'Unknown'
      });
      setFormLinkDialogOpen(true);
      
      fetchCandidates();
    } catch (error: any) {
      console.error('=== Frontend Error ===');
      console.error('Error:', error);
      toast.error(error.message || 'Failed to generate form link');
    }
  };

  const copyFormLink = () => {
    if (generatedFormData?.formUrl) {
      navigator.clipboard.writeText(generatedFormData.formUrl);
      toast.success('Form link copied to clipboard!');
    }
  };

  const openFormLink = () => {
    if (generatedFormData?.formUrl) {
      window.open(generatedFormData.formUrl, '_blank');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Candidates</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCandidates} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload CV
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Candidate CV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  📄 Upload a CV and we'll automatically extract candidate information like name, email, phone, skills, experience, and education!
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requisition">Select Requisition *</Label>
                <Select
                  value={uploadData.requisitionId}
                  onValueChange={(value) => setUploadData({ ...uploadData, requisitionId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select requisition" />
                  </SelectTrigger>
                  <SelectContent>
                    {requisitions.map((req) => (
                      <SelectItem key={req.id} value={req.id}>
                        {req.requisition_id} - {req.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cv-file">CV File *</Label>
                <Input
                  id="cv-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                {selectedFile && (
                  <p className="text-sm text-green-600">
                    ✓ Selected: {selectedFile.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX, TXT (Max 10MB)
                </p>
              </div>

              <Button 
                onClick={handleUploadCV} 
                className="w-full"
                disabled={!uploadData.requisitionId || !selectedFile}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload & Parse CV
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Candidates List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading candidates...</div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No candidates found</div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{candidate.full_name}</h3>
                      {getStatusBadge(candidate.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mt-4">
                      <div>
                        <span className="font-medium">Position:</span>
                        <p className="text-foreground">{candidate.applied_position}</p>
                      </div>
                      <div>
                        <span className="font-medium">Email:</span>
                        <p className="text-foreground">{candidate.email}</p>
                      </div>
                      <div>
                        <span className="font-medium">Experience:</span>
                        <p className="text-foreground">{candidate.total_experience || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium">Applied:</span>
                        <p className="text-foreground">{new Date(candidate.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {/* Step 1: CV Received -> Screening */}
                    {candidate.status === 'cv_received' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCandidate(candidate);
                          setScreeningDialogOpen(true);
                        }}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Screen CV
                      </Button>
                    )}
                    
                    {/* Step 2: Screening Passed -> Shortlist */}
                    {candidate.status === 'screened_passed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShortlist(candidate.id)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Shortlist
                      </Button>
                    )}
                    
                    {/* Step 3: Interview Scheduled -> Generate Form */}
                    {candidate.status === 'interview_scheduled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateForm(candidate.id)}
                      >
                        <FileCheck className="mr-2 h-4 w-4" />
                        Generate Form
                      </Button>
                    )}
                    
                    {/* Also allow form generation for shortlisted candidates */}
                    {(candidate.status === 'shortlisted' || candidate.status === 'screened_passed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateForm(candidate.id)}
                      >
                        <FileCheck className="mr-2 h-4 w-4" />
                        Generate Form
                      </Button>
                    )}
                    
                    {/* Screening Failed -> Show Status */}
                    {candidate.status === 'screened_failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        <X className="mr-2 h-4 w-4" />
                        Screening Failed
                      </Button>
                    )}
                    
                    {/* Always show View button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/recruitment/candidates/${candidate.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Screening Dialog */}
      <Dialog open={screeningDialogOpen} onOpenChange={setScreeningDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Screen Candidate CV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedCandidate?.full_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {selectedCandidate?.applied_position}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="screeningResult">Screening Result *</Label>
              <Select
                value={screeningData.screeningResult}
                onValueChange={(value: 'passed' | 'failed') => 
                  setScreeningData({ ...screeningData, screeningResult: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">✅ Passed - Proceed to Shortlist</SelectItem>
                  <SelectItem value="failed">❌ Failed - Reject Application</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="screeningNotes">Screening Notes</Label>
              <Textarea
                id="screeningNotes"
                value={screeningData.screeningNotes}
                onChange={(e) => setScreeningData({ ...screeningData, screeningNotes: e.target.value })}
                placeholder="Add notes about the screening decision..."
                rows={3}
              />
            </div>

            <Button onClick={handleScreening} className="w-full">
              Complete Screening
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interview Scheduling Dialog */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedCandidate?.full_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {selectedCandidate?.applied_position}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewType">Interview Type *</Label>
              <Select
                value={interviewData.interviewType}
                onValueChange={(value) => 
                  setInterviewData({ ...interviewData, interviewType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical Interview</SelectItem>
                  <SelectItem value="hr">HR Interview</SelectItem>
                  <SelectItem value="final">Final Interview</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewDate">Interview Date *</Label>
              <Input
                id="interviewDate"
                type="date"
                value={interviewData.interviewDate}
                onChange={(e) => setInterviewData({ ...interviewData, interviewDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewTime">Interview Time *</Label>
              <Input
                id="interviewTime"
                type="time"
                value={interviewData.interviewTime}
                onChange={(e) => setInterviewData({ ...interviewData, interviewTime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interviewerName">Interviewer Name *</Label>
              <Input
                id="interviewerName"
                value={interviewData.interviewerName}
                onChange={(e) => setInterviewData({ ...interviewData, interviewerName: e.target.value })}
                placeholder="Enter interviewer name"
              />
            </div>

            <Button 
              onClick={handleScheduleInterview} 
              className="w-full"
              disabled={!interviewData.interviewDate || !interviewData.interviewTime || !interviewData.interviewerName}
            >
              Schedule Interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Link Dialog */}
      <Dialog open={formLinkDialogOpen} onOpenChange={setFormLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Form Generated</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800">Form Successfully Generated!</span>
              </div>
              <p className="text-sm text-green-700">
                Application form has been created for <strong>{generatedFormData?.candidateName}</strong> 
                applying for <strong>{generatedFormData?.candidatePosition}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <Label>Form Link</Label>
              <div className="flex gap-2">
                <Input 
                  value={generatedFormData?.formUrl || ''} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" onClick={copyFormLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={openFormLink}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Expires:</strong> {generatedFormData?.expiresAt ? new Date(generatedFormData.expiresAt).toLocaleDateString() : 'N/A'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Share this link with the candidate to complete their application form.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={copyFormLink} className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="outline" onClick={openFormLink} className="flex-1">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Form
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
