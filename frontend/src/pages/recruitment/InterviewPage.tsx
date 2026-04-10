import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function InterviewPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  
  const [interviewData, setInterviewData] = useState({
    interviewDate: '',
    interviewTime: '',
    interviewType: 'technical',
    interviewer: '',
    technicalSkills: '',
    communication: '',
    problemSolving: '',
    cultureFit: '',
    overallRemarks: '',
    recommendation: 'pending'
  });

  // Mock candidate data
  const candidate = {
    id: parseInt(candidateId || '1'),
    name: 'Ahmed Ali',
    position: 'Senior Software Engineer',
    email: 'ahmed@example.com'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // API call will be added here
      toast.success('Interview feedback saved successfully!');
      navigate('/recruitment/candidates');
    } catch (error) {
      toast.error('Failed to save interview feedback');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/recruitment/candidates')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Candidates
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Interview Feedback</CardTitle>
          <div className="text-sm text-muted-foreground">
            <p>Candidate: {candidate.name}</p>
            <p>Position: {candidate.position}</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Interview Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interviewDate">Interview Date</Label>
                <Input
                  id="interviewDate"
                  type="date"
                  value={interviewData.interviewDate}
                  onChange={(e) => setInterviewData({ ...interviewData, interviewDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interviewTime">Interview Time</Label>
                <Input
                  id="interviewTime"
                  type="time"
                  value={interviewData.interviewTime}
                  onChange={(e) => setInterviewData({ ...interviewData, interviewTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interviewType">Interview Type</Label>
                <Select
                  value={interviewData.interviewType}
                  onValueChange={(value) => setInterviewData({ ...interviewData, interviewType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="final">Final Round</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interviewer">Interviewer Name</Label>
                <Input
                  id="interviewer"
                  value={interviewData.interviewer}
                  onChange={(e) => setInterviewData({ ...interviewData, interviewer: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Evaluation Criteria */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg">Evaluation</h3>
              
              <div className="space-y-2">
                <Label htmlFor="technicalSkills">Technical Skills</Label>
                <Textarea
                  id="technicalSkills"
                  value={interviewData.technicalSkills}
                  onChange={(e) => setInterviewData({ ...interviewData, technicalSkills: e.target.value })}
                  placeholder="Evaluate technical knowledge and skills..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="communication">Communication Skills</Label>
                <Textarea
                  id="communication"
                  value={interviewData.communication}
                  onChange={(e) => setInterviewData({ ...interviewData, communication: e.target.value })}
                  placeholder="Evaluate communication and presentation skills..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="problemSolving">Problem Solving</Label>
                <Textarea
                  id="problemSolving"
                  value={interviewData.problemSolving}
                  onChange={(e) => setInterviewData({ ...interviewData, problemSolving: e.target.value })}
                  placeholder="Evaluate problem-solving approach..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cultureFit">Culture Fit</Label>
                <Textarea
                  id="cultureFit"
                  value={interviewData.cultureFit}
                  onChange={(e) => setInterviewData({ ...interviewData, cultureFit: e.target.value })}
                  placeholder="Evaluate alignment with company culture..."
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overallRemarks">Overall Remarks</Label>
                <Textarea
                  id="overallRemarks"
                  value={interviewData.overallRemarks}
                  onChange={(e) => setInterviewData({ ...interviewData, overallRemarks: e.target.value })}
                  placeholder="Overall assessment and additional comments..."
                  rows={4}
                  required
                />
              </div>
            </div>

            {/* Recommendation */}
            <div className="space-y-2 border-t pt-6">
              <Label htmlFor="recommendation">Recommendation</Label>
              <Select
                value={interviewData.recommendation}
                onValueChange={(value) => setInterviewData({ ...interviewData, recommendation: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strongly_recommend">Strongly Recommend</SelectItem>
                  <SelectItem value="recommend">Recommend</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                  <SelectItem value="not_recommend">Not Recommend</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Save Feedback
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/recruitment/candidates')}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
