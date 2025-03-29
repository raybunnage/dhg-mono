import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExpertInterface } from '@/types/expert';
import { toast } from 'sonner';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MoreHorizontal, Plus, Search, RefreshCw, Trash2, Edit, Eye } from 'lucide-react';

// Import our expert service
import { expertService } from '@/services/expert-service';

interface ExpertListProps {
  onSelectExpert: (expert: ExpertInterface) => void;
  onAddExpert: () => void;
  onEditExpert: (expert: ExpertInterface) => void;
  onDeleteExpert: (expert: ExpertInterface) => void;
}

export function ExpertList({
  onSelectExpert,
  onAddExpert,
  onEditExpert,
  onDeleteExpert
}: ExpertListProps) {
  const [experts, setExperts] = useState<ExpertInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadExperts();
  }, []);

  async function loadExperts() {
    try {
      setLoading(true);
      
      // Use our expert service
      const experts = await expertService.getAllExperts();
      setExperts(experts);
    } catch (error) {
      console.error('Error loading experts:', error);
      toast.error('Failed to load experts');
    } finally {
      setLoading(false);
    }
  }

  const refreshExperts = async () => {
    setIsRefreshing(true);
    await loadExperts();
    setIsRefreshing(false);
  };

  const filteredExperts = searchTerm
    ? experts.filter(expert => 
        expert.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (expert.full_name && expert.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (expert.expertise_area && expert.expertise_area.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : experts;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search experts..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshExperts}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={onAddExpert}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expert
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Expertise</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExperts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                      {searchTerm ? 'No experts match your search' : 'No experts found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExperts.map(expert => (
                    <TableRow 
                      key={expert.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => onSelectExpert(expert)}
                    >
                      <TableCell>
                        <div className="font-medium">{expert.expert_name}</div>
                        <div className="text-sm text-muted-foreground">{expert.full_name || '-'}</div>
                      </TableCell>
                      <TableCell>{expert.expertise_area || '-'}</TableCell>
                      <TableCell>{expert.experience_years ? `${expert.experience_years} years` : '-'}</TableCell>
                      <TableCell>
                        {expert.is_in_core_group && (
                          <Badge variant="default" className="bg-green-600">Core</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onSelectExpert(expert);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onEditExpert(expert);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteExpert(expert);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}