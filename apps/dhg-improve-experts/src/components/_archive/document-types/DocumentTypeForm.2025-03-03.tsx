import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DocumentTypeFormProps {
  documentType?: {
    id: string;
    document_type: string;
    description: string | null;
    category: string;
    mime_type: string | null;
    file_extension: string | null;
    is_ai_generated: boolean;
  };
  onSuccess: () => void;
}

interface FormData {
  document_type: string;
  description: string;
  category: string;
  mime_type: string;
  file_extension: string;
  is_ai_generated: boolean;
}

export function DocumentTypeForm({ documentType, onSuccess }: DocumentTypeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [mimeTypes, setMimeTypes] = useState<string[]>([]);
  const { toast } = useToast();

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      document_type: documentType?.document_type || "",
      description: documentType?.description || "",
      category: documentType?.category || "",
      mime_type: documentType?.mime_type || "",
      file_extension: documentType?.file_extension || "",
      is_ai_generated: documentType?.is_ai_generated || false,
    },
  });

  useEffect(() => {
    // Fetch unique categories and mime types from existing document types
    const fetchDocumentTypeOptions = async () => {
      try {
        console.log("Fetching document type options...");
        
        // Fetch categories
        const { data: categoryData, error: categoryError } = await supabase
          .from("document_types")
          .select("category")
          .not("category", "is", null);
        
        if (categoryError) throw categoryError;
        
        // Fetch mime types
        const { data: mimeTypeData, error: mimeTypeError } = await supabase
          .from("document_types")
          .select("mime_type")
          .not("mime_type", "is", null);
        
        if (mimeTypeError) throw mimeTypeError;
        
        // Extract unique values
        const uniqueCategories = Array.from(
          new Set(categoryData.map(item => item.category))
        ).filter(Boolean).sort();
        
        const uniqueMimeTypes = Array.from(
          new Set(mimeTypeData.map(item => item.mime_type))
        ).filter(Boolean).sort();
        
        console.log("Found categories:", uniqueCategories);
        console.log("Found mime types:", uniqueMimeTypes);
        
        setCategories(uniqueCategories.length > 0 ? uniqueCategories : ["Report", "Transcript", "Research"]);
        setMimeTypes(uniqueMimeTypes.length > 0 ? uniqueMimeTypes : [
          "application/pdf", 
          "text/plain", 
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]);
      } catch (error) {
        console.error("Error fetching document type options:", error);
        toast({
          title: "Error",
          description: "Failed to load document type options",
          variant: "destructive",
        });
        
        // Set default values in case of error
        setCategories(["Report", "Transcript", "Research"]);
        setMimeTypes([
          "application/pdf", 
          "text/plain", 
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]);
      }
    };
    
    fetchDocumentTypeOptions();
  }, [toast]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      if (documentType) {
        // Update existing document type
        const { error } = await supabase
          .from("document_types")
          .update({
            document_type: data.document_type,
            description: data.description,
            category: data.category,
            mime_type: data.mime_type || null,
            file_extension: data.file_extension || null,
            is_ai_generated: data.is_ai_generated,
            updated_at: new Date().toISOString()
          })
          .eq("id", documentType.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Document type updated successfully",
        });
      } else {
        // Create new document type
        const { error } = await supabase
          .from("document_types")
          .insert([{
            document_type: data.document_type,
            description: data.description,
            category: data.category,
            mime_type: data.mime_type || null,
            file_extension: data.file_extension || null,
            is_ai_generated: data.is_ai_generated,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Document type created successfully",
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving document type:", error);
      toast({
        title: "Error",
        description: "Failed to save document type",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="document_type">Document Type *</Label>
        <Input
          id="document_type"
          {...register("document_type", { required: "Document type is required" })}
        />
        {errors.document_type && (
          <p className="text-sm text-red-500">{errors.document_type.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <Controller
          name="category"
          control={control}
          rules={{ required: "Category is required" }}
          render={({ field }) => (
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                  {/* Allow custom input if needed */}
                  <div className="p-2 border-t">
                    <Input
                      placeholder="Or enter a new category"
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </div>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
        />
      </div>

      <div>
        <Label htmlFor="file_extension">File Extension</Label>
        <Input
          id="file_extension"
          {...register("file_extension")}
          placeholder=".pdf, .doc, etc."
        />
      </div>

      <div>
        <Label htmlFor="mime_type">MIME Type</Label>
        <Controller
          name="mime_type"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value || ""}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a MIME type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mimeTypes.map((mimeType) => (
                    <SelectItem key={mimeType} value={mimeType || ""}>
                      {mimeType}
                    </SelectItem>
                  ))}
                  {/* Allow custom input if needed */}
                  <div className="p-2 border-t">
                    <Input
                      placeholder="Or enter a new MIME type"
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </div>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Controller
          name="is_ai_generated"
          control={control}
          render={({ field }) => (
            <Switch
              id="is_ai_generated"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="is_ai_generated">AI Generated</Label>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : documentType ? "Update" : "Create"}
      </Button>
    </form>
  );
}