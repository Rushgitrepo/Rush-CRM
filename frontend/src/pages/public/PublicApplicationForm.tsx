import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function PublicApplicationForm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    fatherName: '',
    fatherOccupation: '',
    address: '',
    mobileNo: '',
    bloodGroup: '',
    religion: '',
    dateOfBirth: '',
    cnic: '',
    email: '',
    maritalStatus: '',
    numberOfChildren: '',
    residenceType: 'own',
    academicRecords: [
      { diploma: '', institution: '', from: '', to: '', division: '', majorSubjects: '' }
    ],
    workExperience: [
      { designation: '', companyName: '', from: '', to: '', salary: '', reasonForLeaving: '' }
    ],
    currentSalary: '',
    expectedSalary: '',
    joiningAvailability: ''
  });

  useEffect(() => {
    fetchCandidateData();
  }, [token]);

  const fetchCandidateData = async () => {
    try {
      setLoading(true);
      console.log('=== Fetching candidate data ===');
      console.log('Token:', token);
      console.log('URL:', `/api/recruitment/candidates/public/form/${token}`);
      
      const response = await fetch(`/api/recruitment/candidates/public/form/${token}`);
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', response.headers);
      
      // Get response text first
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse error response:', e);
          throw new Error('Server returned invalid response');
        }
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Invalid or expired form link');
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse success response:', e);
        throw new Error('Server returned invalid response');
      }
      
      console.log('Candidate data received:', data);
      setCandidate(data);
      
      // Pre-fill form with existing data
      setFormData(prev => ({
        ...prev,
        fullName: data.fullName || '',
        email: data.email || '',
        mobileNo: data.phone || '',
        fatherName: data.fatherName || '',
        fatherOccupation: data.fatherOccupation || '',
        address: data.address || '',
        bloodGroup: data.bloodGroup || '',
        religion: data.religion || '',
        dateOfBirth: data.dateOfBirth || '',
        cnic: data.cnic || '',
        maritalStatus: data.maritalStatus || '',
        numberOfChildren: data.numberOfChildren || '',
        residenceType: data.residenceType || 'own',
        currentSalary: data.currentSalary || '',
        expectedSalary: data.expectedSalary || ''
      }));
    } catch (error: any) {
      console.error('Error fetching form:', error);
      toast.error(error.message || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      const response = await fetch(`/api/recruitment/candidates/public/form/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      toast.success('Application form submitted successfully!');
      
      // Show success message
      setTimeout(() => {
        window.location.href = '/form-submitted';
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const addAcademicRecord = () => {
    setFormData(prev => ({
      ...prev,
      academicRecords: [
        ...prev.academicRecords,
        { diploma: '', institution: '', from: '', to: '', division: '', majorSubjects: '' }
      ]
    }));
  };

  const addWorkExperience = () => {
    setFormData(prev => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        { designation: '', companyName: '', from: '', to: '', salary: '', reasonForLeaving: '' }
      ]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-semibold text-red-600">Invalid or Expired Form Link</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please contact HR department for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <form onSubmit={handleSubmit}>
          <Card className="shadow-lg">
            <CardContent className="p-8">
              {/* Header */}
              <div className="text-center mb-8 border-b-4 border-primary pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">FC</span>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-primary mb-2">
                  FUSION CORTEX - Rush Group of Companies
                </h1>
                <h2 className="text-xl font-semibold">EMPLOYMENT APPLICATION FORM</h2>
                <p className="text-sm text-muted-foreground mt-2">HR Department</p>
              </div>

              {/* Position Applied For */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Position Applied For:</Label>
                  <Input value={candidate.position || 'N/A'} disabled className="bg-gray-100" />
                </div>
                <div>
                  <Label>Name: *</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Father's Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Father's Name:</Label>
                  <Input
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Father's Occupation:</Label>
                  <Input
                    value={formData.fatherOccupation}
                    onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                  />
                </div>
              </div>

              {/* Address & Mobile */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Address:</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Mobile No: *</Label>
                  <Input
                    value={formData.mobileNo}
                    onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Blood Group, Religion, DOB */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <Label>Blood Group:</Label>
                  <Input
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    placeholder="e.g., A+"
                  />
                </div>
                <div>
                  <Label>Religion:</Label>
                  <Input
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Date of Birth:</Label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
              </div>

              {/* CNIC & Email */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>CNIC No:</Label>
                  <Input
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    placeholder="xxxxx-xxxxxxx-x"
                  />
                </div>
                <div>
                  <Label>E-mail Address: *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Marital Status & Children */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Marital Status:</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>
                <div>
                  <Label>No. of Children:</Label>
                  <Input
                    type="number"
                    value={formData.numberOfChildren}
                    onChange={(e) => setFormData({ ...formData, numberOfChildren: e.target.value })}
                  />
                </div>
              </div>

              {/* Residence Type */}
              <div className="mb-6">
                <Label>Residence Type:</Label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="residenceType"
                      value="own"
                      checked={formData.residenceType === 'own'}
                      onChange={(e) => setFormData({ ...formData, residenceType: e.target.value })}
                    />
                    <span>Own</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="residenceType"
                      value="rented"
                      checked={formData.residenceType === 'rented'}
                      onChange={(e) => setFormData({ ...formData, residenceType: e.target.value })}
                    />
                    <span>Rented</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="residenceType"
                      value="parents"
                      checked={formData.residenceType === 'parents'}
                      onChange={(e) => setFormData({ ...formData, residenceType: e.target.value })}
                    />
                    <span>Parents</span>
                  </label>
                </div>
              </div>

              {/* Academic Records Table */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-lg font-semibold">Academic Record:</Label>
                  <Button type="button" onClick={addAcademicRecord} size="sm" variant="outline">
                    + Add Row
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">(Please commence with the highest qualification)</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2 text-sm">Sr</th>
                        <th className="border p-2 text-sm">Diploma/Degree/Projects</th>
                        <th className="border p-2 text-sm">Name of Institution</th>
                        <th className="border p-2 text-sm">From</th>
                        <th className="border p-2 text-sm">To</th>
                        <th className="border p-2 text-sm">Division</th>
                        <th className="border p-2 text-sm">Major Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.academicRecords.map((record, index) => (
                        <tr key={index}>
                          <td className="border p-1 text-center">{index + 1}</td>
                          <td className="border p-1">
                            <Input
                              value={record.diploma}
                              onChange={(e) => {
                                const newRecords = [...formData.academicRecords];
                                newRecords[index].diploma = e.target.value;
                                setFormData({ ...formData, academicRecords: newRecords });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={record.institution}
                              onChange={(e) => {
                                const newRecords = [...formData.academicRecords];
                                newRecords[index].institution = e.target.value;
                                setFormData({ ...formData, academicRecords: newRecords });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={record.from}
                              onChange={(e) => {
                                const newRecords = [...formData.academicRecords];
                                newRecords[index].from = e.target.value;
                                setFormData({ ...formData, academicRecords: newRecords });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={record.to}
                              onChange={(e) => {
                                const newRecords = [...formData.academicRecords];
                                newRecords[index].to = e.target.value;
                                setFormData({ ...formData, academicRecords: newRecords });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={record.division}
                              onChange={(e) => {
                                const newRecords = [...formData.academicRecords];
                                newRecords[index].division = e.target.value;
                                setFormData({ ...formData, academicRecords: newRecords });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={record.majorSubjects}
                              onChange={(e) => {
                                const newRecords = [...formData.academicRecords];
                                newRecords[index].majorSubjects = e.target.value;
                                setFormData({ ...formData, academicRecords: newRecords });
                              }}
                              className="border-0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Work Experience Table */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-lg font-semibold">Work Experience:</Label>
                  <Button type="button" onClick={addWorkExperience} size="sm" variant="outline">
                    + Add Row
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">(Please commence with current / last employment)</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2 text-sm">Sr</th>
                        <th className="border p-2 text-sm">Designation</th>
                        <th className="border p-2 text-sm">Company Name</th>
                        <th className="border p-2 text-sm">From</th>
                        <th className="border p-2 text-sm">To</th>
                        <th className="border p-2 text-sm">Salary</th>
                        <th className="border p-2 text-sm">Reason for leaving</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.workExperience.map((exp, index) => (
                        <tr key={index}>
                          <td className="border p-1 text-center">{index + 1}</td>
                          <td className="border p-1">
                            <Input
                              value={exp.designation}
                              onChange={(e) => {
                                const newExp = [...formData.workExperience];
                                newExp[index].designation = e.target.value;
                                setFormData({ ...formData, workExperience: newExp });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={exp.companyName}
                              onChange={(e) => {
                                const newExp = [...formData.workExperience];
                                newExp[index].companyName = e.target.value;
                                setFormData({ ...formData, workExperience: newExp });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={exp.from}
                              onChange={(e) => {
                                const newExp = [...formData.workExperience];
                                newExp[index].from = e.target.value;
                                setFormData({ ...formData, workExperience: newExp });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={exp.to}
                              onChange={(e) => {
                                const newExp = [...formData.workExperience];
                                newExp[index].to = e.target.value;
                                setFormData({ ...formData, workExperience: newExp });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={exp.salary}
                              onChange={(e) => {
                                const newExp = [...formData.workExperience];
                                newExp[index].salary = e.target.value;
                                setFormData({ ...formData, workExperience: newExp });
                              }}
                              className="border-0"
                            />
                          </td>
                          <td className="border p-1">
                            <Input
                              value={exp.reasonForLeaving}
                              onChange={(e) => {
                                const newExp = [...formData.workExperience];
                                newExp[index].reasonForLeaving = e.target.value;
                                setFormData({ ...formData, workExperience: newExp });
                              }}
                              className="border-0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Salary Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Previous/current Salary:</Label>
                  <Input
                    value={formData.currentSalary}
                    onChange={(e) => setFormData({ ...formData, currentSalary: e.target.value })}
                    placeholder="PKR"
                  />
                </div>
                <div>
                  <Label>Expected Salary:</Label>
                  <Input
                    value={formData.expectedSalary}
                    onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                    placeholder="PKR"
                  />
                </div>
              </div>

              {/* Joining Availability */}
              <div className="mb-6">
                <Label>If selected, how soon would you be able to join us?</Label>
                <Input
                  value={formData.joiningAvailability}
                  onChange={(e) => setFormData({ ...formData, joiningAvailability: e.target.value })}
                  placeholder="e.g., Immediately, 1 month notice, etc."
                  className="mt-2"
                />
              </div>

              {/* Declaration */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-2">Declaration:</h3>
                <p className="text-sm text-muted-foreground">
                  I hereby declare that information given in this application form are true to the best of my knowledge.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="px-12"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
                <p className="font-semibold">Head Office: 5800 Balcones Drive, STE 100 Austin, TX 78731, USA</p>
                <p>Development Center: 37, H3 Block, Johar Town, Lahore, 54000, Pakistan</p>
                <p className="mt-2">☎ +1 830-965-8926</p>
                <p>🌐 www.fusioncortex.com</p>
                <p>✉ info@fusioncortex.com</p>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
