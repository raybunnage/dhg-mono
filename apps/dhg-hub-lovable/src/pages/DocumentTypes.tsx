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
import { FileText, Edit, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DocumentTypeForm } from "@/components/document-types/DocumentTypeForm";

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  category: string;
  mime_type: string | null;
  file_extension: string | null;
  is_ai_generated: boolean;
}

export default function DocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const { toast } = useToast();

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("uni_document_types")
        .select("*")
        .order("document_type");

      if (error) throw error;
      setDocumentTypes(data);
    } catch (error) {
      console.error("Error fetching document types:", error);
      toast({
        title: "Error",
        description: "Failed to load document types",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("uni_document_types").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Document type deleted successfully",
      });
      
      fetchDocumentTypes();
    } catch (error) {
      console.error("Error deleting document type:", error);
      toast({
        title: "Error",
        description: "Failed to delete document type",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Document Types Management</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Add Document Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Document Type</DialogTitle>
              </DialogHeader>
              <DocumentTypeForm onSuccess={fetchDocumentTypes} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>File Extension</TableHead>
                <TableHead>MIME Type</TableHead>
                <TableHead>AI Generated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentTypes.map((docType) => (
                <TableRow key={docType.id}>
                  <TableCell>{docType.document_type}</TableCell>
                  <TableCell>{docType.category}</TableCell>
                  <TableCell>{docType.description}</TableCell>
                  <TableCell>{docType.file_extension}</TableCell>
                  <TableCell>{docType.mime_type}</TableCell>
                  <TableCell>{docType.is_ai_generated ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setSelectedDocType(docType)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Document Type</DialogTitle>
                          </DialogHeader>
                          <DocumentTypeForm documentType={docType} onSuccess={fetchDocumentTypes} />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(docType.id)}
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