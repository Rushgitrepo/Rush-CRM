import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Play, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Star,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';

export default function InterviewsPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scheduled');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [feedbackData, setFeedbackData] = useState({
    technicalSkills: '',
    communication: '',
    problemSolving: '',
    cultureFit: '',
    overallRemarks: '',
    recommendation: 'recommend'
  });
  const [recommendRemarks, setRecommendRemarks] = useState('');

  useEffect(() => {
    fetchInterviews();
    fetchStats();
  }, [activeTab]);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      console.log('Fetching interviews with activeTab:', activeTab);
      
      const params: any = {};
      
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      
      console.log('API call params:', params);
      const data = await recruitmentApi.getAllInterviews(params);
      console.log('Interviews fetched:', data);
      setInterviews(data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await recruitmentApi.getInterviewStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
      scheduled: { label: 'Scheduled', variant: 'default', icon: Calendar },
      in_progress: { label: 'In Progress', variant: 'default', icon: Play },
      completed: { label: 'Completed', variant: 'default', icon: CheckCircle },
      cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary', icon: Calendar };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getInterviewTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; color: string }> = {
      technical: { label: 'Technical', color: 'bg-blue-100 text-blue-800' },
      hr: { label: 'HR', color: 'bg-green-100 text-green-800' },
      final: { label: 'Final', color: 'bg-purple-100 text-purple-800' }
    };
    
    const config = typeConfig[type] || { label: type, color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleConductInterview = async (interviewId: string) => {
    try {
      await recruitmentApi.conductInterview(interviewId);
      toast.success('Interview started!');
      fetchInterviews();
    } catch (error: any) {
      console.error('Error conducting interview:', error);
      toast.error(error.message || 'Failed to start interview');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedInterview) return;
    
    try {
      await recruitmentApi.submitFeedback(selectedInterview.id, feedbackData);
      toast.success('Interview feedback submitted!');
      setFeedbackDialogOpen(false);
      setFeedbackData({
        technicalSkills: '',
        communication: '',
        problemSolving: '',
        cultureFit: '',
        overallRemarks: '',
        recommendation: 'recommend'
      });
      setSelectedInterview(null);
      fetchInterviews();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.message || 'Failed to submit feedback');
    }
  };

  const handleRecommendFinal = async () => {
    if (!selectedInterview) return;
    
    try {
      await recruitmentApi.recommendFinalInterview(selectedInterview.candidate_id, recommendRemarks);
      toast.success('Candidate recommended for final interview!');
      setRecommendDialogOpen(false);
      setRecommendRemarks('');
      setSelectedInterview(null);
      fetchInterviews();
    } catch (error: any) {
      console.error('Error recommending final interview:', error);
      toast.error(error.message || 'Failed to recommend for final interview');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Interviews</h1>
        <Button variant="outline" onClick={fetchInterviews} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">{stats.scheduled_count || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.in_progress_count || 0}</p>
              </div>
              <Play className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed_count || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{stats.today_count || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interview Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scheduled">Scheduled ({stats.scheduled_count || 0})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({stats.in_progress_count || 0})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed_count || 0})</TabsTrigger>
          <TabsTrigger value="all">All Interviews</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading interviews...</div>
          ) : interviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No {activeTab === 'all' ? '' : activeTab} interviews found
            </div>
          ) : (
            <div className="space-y-4">
              {interviews.map((interview) => (
                <Card key={interview.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-semibold">{interview.candidate_name}</h3>
                          {getStatusBadge(interview.status)}
                          {getInterviewTypeBadge(interview.interview_type)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <div>
                              <span className="font-medium">Date:</span>
                              <p className="text-foreground">{formatDate(interview.interview_date)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <div>
                              <span className="font-medium">Time:</span>
                              <p className="text-foreground">{formatTime(interview.interview_time)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <span className="font-medium">Position:</span>
                              <p className="text-foreground">{interview.position}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <div>
                              <span className="font-medium">Interviewer:</span>
                              <p className="text-foreground">{interview.interviewer_name}</p>
                            </div>
                          </div>
                        </div>

                        {interview.recommendation && (
                          <div className="mt-3 p-3 bg-muted rounded-lg">
                            <p className="text-sm">
                              <span className="font-medium">Recommendation:</span> {interview.recommendation}
                            </p>
                            {interview.overall_remarks && (
                              <p className="text-sm mt-1 text-muted-foreground">{interview.overall_remarks}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {/* Scheduled -> Start Interview */}
                        {interview.status === 'scheduled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConductInterview(interview.id)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Start Interview
                          </Button>
                        )}
                        
                        {/* In Progress -> Submit Feedback */}
                        {interview.status === 'in_progress' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInterview(interview);
                              setFeedbackDialogOpen(true);
                            }}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Submit Feedback
                          </Button>
                        )}
                        
                        {/* Completed + Technical/HR -> Recommend Final */}
                        {interview.status === 'completed' && 
                         interview.interview_type !== 'final' && 
                         ['strongly_recommend', 'recommend'].includes(interview.recommendation) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInterview(interview);
                              setRecommendDialogOpen(true);
                            }}
                          >
                            <Star className="mr-2 h-4 w-4" />
                            Recommend Final
                          </Button>
                        )}
                        
                        {/* View Candidate */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/recruitment/candidates/${interview.candidate_id}`)}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          View Candidate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Interview Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedInterview?.candidate_name}</Label>
              <p className="text-sm text-muted-foreground">
                {selectedInterview?.interview_type} Interview - {selectedInterview?.position}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="technicalSkills">Technical Skills</Label>
                <Textarea
                  id="technicalSkills"
                  value={feedbackData.technicalSkills}
                  onChange={(e) => setFeedbackData({ ...feedbackData, technicalSkills: e.target.value })}
                  placeholder="Evaluate technical competency..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="communication">Communication</Label>
                <Textarea
                  id="communication"
                  value={feedbackData.communication}
                  onChange={(e) => setFeedbackData({ ...feedbackData, communication: e.target.value })}
                  placeholder="Assess communication skills..."
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="problemSolving">Problem Solving</Label>
                <Textarea
                  id="problemSolving"
                  value={feedbackData.problemSolving}
                  onChange={(e) => setFeedbackData({ ...feedbackData, problemSolving: e.target.value })}
                  placeholder="Evaluate problem-solving approach..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cultureFit">Culture Fit</Label>
                <Textarea
                  id="cultureFit"
                  value={feedbackData.cultureFit}
                  onChange={(e) => setFeedbackData({ ...feedbackData, cultureFit: e.target.value })}
                  placeholder="Assess cultural alignment..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overallRemarks">Overall Remarks</Label>
              <Textarea
                id="overallRemarks"
                value={feedbackData.overallRemarks}
                onChange={(e) => setFeedbackData({ ...feedbackData, overallRemarks: e.target.value })}
                placeholder="Overall assessment and key observations..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendation">Recommendation</Label>
              <Select
                value={feedbackData.recommendation}
                onValueChange={(value) => setFeedbackData({ ...feedbackData, recommendation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strongly_recommend">⭐ Strongly Recommend</SelectItem>
                  <SelectItem value="recommend">✅ Recommend</SelectItem>
                  <SelectItem value="maybe">🤔 Maybe</SelectItem>
                  <SelectItem value="not_recommend">❌ Not Recommend</SelectItem>
                  <SelectItem value="reject">🚫 Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSubmitFeedback} className="w-full">
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recommend Final Interview Dialog */}
      <Dialog open={recommendDialogOpen} onOpenChange={setRecommendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recommend for Final Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Candidate: {selectedInterview?.candidate_name}</Label>
              <p className="text-sm text-muted-foreground">
                Position: {selectedInterview?.position}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendRemarks">Additional Remarks</Label>
              <Textarea
                id="recommendRemarks"
                value={recommendRemarks}
                onChange={(e) => setRecommendRemarks(e.target.value)}
                placeholder="Why do you recommend this candidate for final interview?"
                rows={4}
              />
            </div>

            <Button onClick={handleRecommendFinal} className="w-full">
              Recommend for Final Interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}