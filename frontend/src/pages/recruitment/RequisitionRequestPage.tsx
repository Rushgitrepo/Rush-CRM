import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';
import { DEPARTMENTS } from '@/lib/constants';

export default function RequisitionRequestPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    department: '',
    position: '',
    numberOfPositions: 1,
    jobDescription: '',
    requirements: '',
    urgency: 'medium',
    requestType: 'single',
    grade: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await recruitmentApi.createRequisition(formData);
      toast.success('Requisition request submitted successfully!');
      navigate('/recruitment/requisitions');
    } catch (error: any) {
      console.error('Error creating requisition:', error);
      toast.error(error.message || 'Failed to submit requisition request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New Requisition Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Request Type */}
            <div className="space-y-2">
              <Label htmlFor="requestType">Request Type</Label>
              <Select
                value={formData.requestType}
                onValueChange={(value) => setFormData({ ...formData, requestType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Position</SelectItem>
                  <SelectItem value="team">Team/Multiple Positions</SelectItem>
                  <SelectItem value="other">Other Requirement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position/Role */}
            <div className="space-y-2">
              <Label htmlFor="position">Position / Role</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g., Senior Software Engineer"
                required
              />
            </div>

            {/* Number of Positions */}
            <div className="space-y-2">
              <Label htmlFor="numberOfPositions">Number of Positions</Label>
              <Input
                id="numberOfPositions"
                type="number"
                min="1"
                value={formData.numberOfPositions}
                onChange={(e) => setFormData({ ...formData, numberOfPositions: parseInt(e.target.value) })}
                required
              />
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <Label htmlFor="jobDescription">Job Description (JD)</Label>
              <Textarea
                id="jobDescription"
                value={formData.jobDescription}
                onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                placeholder="Enter detailed job description, requirements, and qualifications..."
                rows={8}
                required
              />
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <Label htmlFor="requirements">Requirements & Qualifications</Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="Enter specific requirements, qualifications, and skills needed..."
                rows={4}
              />
            </div>

            {/* Grade */}
            <div className="space-y-2">
              <Label htmlFor="grade">Grade/Level</Label>
              <Select
                value={formData.grade}
                onValueChange={(value) => setFormData({ ...formData, grade: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GD1-3">Junior (GD 1-3)</SelectItem>
                  <SelectItem value="GD4-6">Mid-Level (GD 4-6)</SelectItem>
                  <SelectItem value="GD7-9">Senior (GD 7-9)</SelectItem>
                  <SelectItem value="GD10-12">Lead (GD 10-12)</SelectItem>
                  <SelectItem value="GD13+">Manager (GD 13+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData({ ...formData, urgency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/recruitment/requisitions')}
                className="flex-1"
                disabled={loading}
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
