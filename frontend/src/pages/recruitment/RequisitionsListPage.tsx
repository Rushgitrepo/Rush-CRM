import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Eye, RefreshCw } from 'lucide-react';
import { recruitmentApi } from '@/lib/api';
import { toast } from 'sonner';

export default function RequisitionsListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequisitions();
    
    // Refresh when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRequisitions();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const data = await recruitmentApi.getRequisitions({ search: searchQuery });
      console.log('Fetched requisitions:', data); // Debug log
      setRequisitions(data);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      toast.error('Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchRequisitions();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      pending_dept_head: { label: 'Pending Dept Head', variant: 'secondary' },
      pending_management: { label: 'Pending Management', variant: 'default' },
      approved: { label: 'Approved', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' },
      in_advertisement: { label: 'In Advertisement', variant: 'default' },
      shortlisting: { label: 'Shortlisting', variant: 'default' },
      interviewing: { label: 'Interviewing', variant: 'default' },
      completed: { label: 'Completed', variant: 'default' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig: Record<string, { variant: any }> = {
      low: { variant: 'secondary' },
      medium: { variant: 'default' },
      high: { variant: 'default' },
      urgent: { variant: 'destructive' }
    };
    
    const config = urgencyConfig[urgency] || { variant: 'secondary' };
    return <Badge variant={config.variant}>{urgency.toUpperCase()}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Requisitions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRequisitions} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/recruitment/requisitions/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Requisition
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by position, department, or requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Requisitions List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading requisitions...</div>
      ) : requisitions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No requisitions found</div>
      ) : (
        <div className="space-y-4">
          {requisitions.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{req.position}</h3>
                      {getStatusBadge(req.status)}
                      {getUrgencyBadge(req.urgency)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mt-4">
                      <div>
                        <span className="font-medium">Department:</span>
                        <p className="text-foreground">{req.department}</p>
                      </div>
                      <div>
                        <span className="font-medium">Positions:</span>
                        <p className="text-foreground">{req.number_of_positions}</p>
                      </div>
                      <div>
                        <span className="font-medium">Requested By:</span>
                        <p className="text-foreground">{req.requested_by_name}</p>
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>
                        <p className="text-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/recruitment/requisitions/${req.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
