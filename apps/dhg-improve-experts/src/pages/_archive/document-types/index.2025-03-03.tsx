import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DocumentTypeForm } from "@/components/document-types/DocumentTypeForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  category: string;
  mime_type: string | null;
  file_extension: string | null;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export default function DocumentTypesPage() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const { toast } = useToast();

  const fetchDocumentTypes = async () => {
    setLoading(true);
    try {
      console.log("Fetching document types...");
      const { data, error } = await supabase
        .from("document_types")
        .select("*")
        .order("document_type", { ascending: true });

      if (error) throw error;
      
      console.log(`Fetched ${data.length} document types`);
      setDocumentTypes(data || []);
    } catch (error) {
      console.error("Error fetching document types:", error);
      toast({
        title: "Error",
        description: "Failed to load document types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const handleAddNew = () => {
    setSelectedDocumentType(null);
    setOpenDialog(true);
  };

  const handleEdit = (documentType: DocumentType) => {
    setSelectedDocumentType(documentType);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("document_types")
        .delete()
        .eq("id", id);

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

  const handleFormSuccess = () => {
    setOpenDialog(false);
    fetchDocumentTypes();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Document Types</h1>
        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <PlusCircle size={16} />
          Add New Type
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : documentTypes.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-500">No document types found. Create your first one!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>MIME Type</TableHead>
                <TableHead>File Ext.</TableHead>
                <TableHead>AI Generated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentTypes.map((docType) => (
                <TableRow key={docType.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{docType.document_type}</span>
                      {docType.description && (
                        <span className="text-xs text-gray-500 mt-1">{docType.description}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{docType.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{docType.mime_type || "-"}</TableCell>
                  <TableCell>{docType.file_extension || "-"}</TableCell>
                  <TableCell>
                    {docType.is_ai_generated ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(docType)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(docType.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedDocumentType ? "Edit Document Type" : "Add New Document Type"}
            </DialogTitle>
          </DialogHeader>
          <DocumentTypeForm
            documentType={selectedDocumentType || undefined}
            onSuccess={handleFormSuccess}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}