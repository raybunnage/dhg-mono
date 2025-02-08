import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Edit, Trash } from "lucide-react";
import { ExpertForm } from "@/components/experts/ExpertForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Expert {
  id: string;
  expert_name: string;
  full_name: string | null;
  email_address: string | null;
  expertise_area: string | null;
  experience_years: number | null;
}

export default function Experts() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const { toast } = useToast();

  const fetchExperts = async () => {
    try {
      const { data, error } = await supabase
        .from("experts")
        .select("*")
        .order("expert_name");

      if (error) throw error;
      setExperts(data);
    } catch (error) {
      console.error("Error fetching experts:", error);
      toast({
        title: "Error",
        description: "Failed to load experts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("experts").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Expert deleted successfully",
      });
      
      fetchExperts();
    } catch (error) {
      console.error("Error deleting expert:", error);
      toast({
        title: "Error",
        description: "Failed to delete expert",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchExperts();
  }, []);

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Experts Management</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <User className="mr-2 h-4 w-4" />
                Add Expert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Expert</DialogTitle>
              </DialogHeader>
              <ExpertForm onSuccess={fetchExperts} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Expertise</TableHead>
                <TableHead>Experience (Years)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experts.map((expert) => (
                <TableRow key={expert.id}>
                  <TableCell>{expert.expert_name}</TableCell>
                  <TableCell>{expert.full_name}</TableCell>
                  <TableCell>{expert.email_address}</TableCell>
                  <TableCell>{expert.expertise_area}</TableCell>
                  <TableCell>{expert.experience_years}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setSelectedExpert(expert)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Expert</DialogTitle>
                          </DialogHeader>
                          <ExpertForm expert={expert} onSuccess={fetchExperts} />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(expert.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}