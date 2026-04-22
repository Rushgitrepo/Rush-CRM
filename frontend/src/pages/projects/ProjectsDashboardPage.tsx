import { useState } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

export default function ProjectsDashboardPage() {
  const { data: projects, isLoading } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects?.filter((project: any) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading projects...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects?.map((project: any) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="block p-6 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {project.description}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Status: {project.status}
                </span>
                <span className="text-muted-foreground">
                  {project.progress}% Complete
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && filteredProjects?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No projects found
        </div>
      )}
    </div>
  );
}
