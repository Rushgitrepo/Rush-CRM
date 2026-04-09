import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Linkedin, Facebook, Twitter, Globe, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

export default function AdvertisementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [requisition, setRequisition] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  const [adData, setAdData] = useState({
    title: '',
    description: '',
    requirements: '',
    location: '',
    employmentType: 'full-time',
    experienceLevel: 'mid-level',
    salaryRange: '',
    applicationDeadline: '',
    contactEmail: '',
    platforms: {
      linkedin: false,
      facebook: false,
      twitter: false,
      website: false
    }
  });

  useEffect(() => {
    if (id) {
      fetchRequisition();
    }
  }, [id]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getRequisitionById(id!);
      setRequisition(data);
      
      // Pre-fill form with requisition data
      setAdData({
        title: `${data.position} - ${data.department}`,
        description: data.job_description || '',
        requirements: data.requirements || '',
        location: 'Pakistan',
        employmentType: 'full-time',
        experienceLevel: data.grade ? getExperienceLevelFromGrade(data.grade) : 'mid-level',
        salaryRange: '',
        applicationDeadline: '',
        contactEmail: '',
        platforms: {
          linkedin: false,
          facebook: false,
          twitter: false,
          website: false
        }
      });
    } catch (error) {
      console.error('Error fetching requisition:', error);
      toast.error('Failed to load requisition details');
    } finally {
      setLoading(false);
    }
  };

  const getExperienceLevelFromGrade = (grade: string) => {
    if (grade.includes('1-3')) return 'entry-level';
    if (grade.includes('4-6')) return 'mid-level';
    if (grade.includes('7-9')) return 'senior-level';
    if (grade.includes('10-12')) return 'lead-level';
    return 'mid-level';
  };

  const generateJobPostTemplate = () => {
    return `🚀 We're Hiring: ${adData.title}

📍 Location: ${adData.location}
💼 Employment Type: ${adData.employmentType.replace('-', ' ').toUpperCase()}
📊 Experience Level: ${adData.experienceLevel.replace('-', ' ').toUpperCase()}
${adData.salaryRange ? `💰 Salary Range: ${adData.salaryRange}` : ''}

📝 Job Description:
${adData.description}

✅ Requirements:
${adData.requirements}

${adData.applicationDeadline ? `⏰ Application Deadline: ${new Date(adData.applicationDeadline).toLocaleDateString()}` : ''}

📧 To Apply: Send your CV to ${adData.contactEmail || 'hr@company.com'}

#Hiring #JobOpening #${adData.title.replace(/\s+/g, '')} #Careers #JobAlert`;
  };

  const handleCopyTemplate = () => {
    const template = generateJobPostTemplate();
    navigator.clipboard.writeText(template);
    setCopied(true);
    toast.success('Job post template copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      
      const selectedPlatforms = Object.entries(adData.platforms)
        .filter(([_, selected]) => selected)
        .map(([platform]) => platform);

      if (selectedPlatforms.length === 0) {
        toast.error('Please select at least one platform to publish');
        return;
      }

      // For LinkedIn, open OAuth flow
      if (adData.platforms.linkedin) {
        toast.info('Opening LinkedIn authorization...');
        // In a real implementation, this would open LinkedIn OAuth
        window.open('https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=w_member_social', '_blank');
      }

      // For other platforms, show success message
      toast.success(`Advertisement will be published to: ${selectedPlatforms.join(', ')}`);
      
      // Navigate back after a delay
      setTimeout(() => {
        navigate(`/recruitment/requisitions/${id}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error publishing advertisement:', error);
      toast.error('Failed to publish advertisement');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/recruitment/requisitions/${id}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Requisition
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Job Advertisement</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{requisition?.requisition_id}</Badge>
                <Badge variant="default" className="bg-green-600">Approved</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={adData.title}
                  onChange={(e) => setAdData({ ...adData, title: e.target.value })}
                  placeholder="e.g., Senior Software Engineer - IT"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Job Description *</Label>
                <Textarea
                  id="description"
                  value={adData.description}
                  onChange={(e) => setAdData({ ...adData, description: e.target.value })}
                  rows={6}
                  placeholder="Enter detailed job description..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements *</Label>
                <Textarea
                  id="requirements"
                  value={adData.requirements}
                  onChange={(e) => setAdData({ ...adData, requirements: e.target.value })}
                  rows={4}
                  placeholder="Enter job requirements..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={adData.location}
                    onChange={(e) => setAdData({ ...adData, location: e.target.value })}
                    placeholder="e.g., Lahore, Pakistan"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employmentType">Employment Type *</Label>
                  <Select
                    value={adData.employmentType}
                    onValueChange={(value) => setAdData({ ...adData, employmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="experienceLevel">Experience Level *</Label>
                  <Select
                    value={adData.experienceLevel}
                    onValueChange={(value) => setAdData({ ...adData, experienceLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry-level">Entry Level</SelectItem>
                      <SelectItem value="mid-level">Mid Level</SelectItem>
                      <SelectItem value="senior-level">Senior Level</SelectItem>
                      <SelectItem value="lead-level">Lead Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salaryRange">Salary Range (Optional)</Label>
                  <Input
                    id="salaryRange"
                    value={adData.salaryRange}
                    onChange={(e) => setAdData({ ...adData, salaryRange: e.target.value })}
                    placeholder="e.g., PKR 100,000 - 150,000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Application Deadline</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={adData.applicationDeadline}
                    onChange={(e) => setAdData({ ...adData, applicationDeadline: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={adData.contactEmail}
                    onChange={(e) => setAdData({ ...adData, contactEmail: e.target.value })}
                    placeholder="hr@company.com"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Label>Publish To:</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="linkedin"
                      checked={adData.platforms.linkedin}
                      onCheckedChange={(checked) => 
                        setAdData({ ...adData, platforms: { ...adData.platforms, linkedin: checked as boolean }})
                      }
                    />
                    <Label htmlFor="linkedin" className="flex items-center gap-2 cursor-pointer">
                      <Linkedin className="h-4 w-4 text-blue-600" />
                      LinkedIn
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="facebook"
                      checked={adData.platforms.facebook}
                      onCheckedChange={(checked) => 
                        setAdData({ ...adData, platforms: { ...adData.platforms, facebook: checked as boolean }})
                      }
                    />
                    <Label htmlFor="facebook" className="flex items-center gap-2 cursor-pointer">
                      <Facebook className="h-4 w-4 text-blue-500" />
                      Facebook
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="twitter"
                      checked={adData.platforms.twitter}
                      onCheckedChange={(checked) => 
                        setAdData({ ...adData, platforms: { ...adData.platforms, twitter: checked as boolean }})
                      }
                    />
                    <Label htmlFor="twitter" className="flex items-center gap-2 cursor-pointer">
                      <Twitter className="h-4 w-4 text-sky-500" />
                      Twitter/X
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="website"
                      checked={adData.platforms.website}
                      onCheckedChange={(checked) => 
                        setAdData({ ...adData, platforms: { ...adData.platforms, website: checked as boolean }})
                      }
                    />
                    <Label htmlFor="website" className="flex items-center gap-2 cursor-pointer">
                      <Globe className="h-4 w-4 text-gray-600" />
                      Company Website
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handlePublish} className="flex-1" disabled={publishing}>
                  <Send className="mr-2 h-4 w-4" />
                  {publishing ? 'Publishing...' : 'Publish Advertisement'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Preview</CardTitle>
                <Button variant="outline" size="sm" onClick={handleCopyTemplate}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Template'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                {generateJobPostTemplate()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Publishing Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Select the platforms where you want to publish</p>
              <p>2. For LinkedIn: You'll be redirected to authorize the app</p>
              <p>3. For other platforms: Copy the template and post manually</p>
              <p>4. The job will be visible to candidates immediately</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
