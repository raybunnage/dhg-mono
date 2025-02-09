import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      document_type: documentType?.document_type || "",
      description: documentType?.description || "",
      category: documentType?.category || "",
      mime_type: documentType?.mime_type || "",
      file_extension: documentType?.file_extension || "",
      is_ai_generated: documentType?.is_ai_generated || false,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      if (documentType) {
        // Update existing document type
        const { error } = await supabase
          .from("uni_document_types")
          .update(data)
          .eq("id", documentType.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Document type updated successfully",
        });
      } else {
        // Create new document type
        const { error } = await supabase
          .from("uni_document_types")
          .insert([data]);
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
        <Input
          id="category"
          {...register("category", { required: "Category is required" })}
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
        <Input
          id="mime_type"
          {...register("mime_type")}
          placeholder="application/pdf, text/plain, etc."
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_ai_generated"
          {...register("is_ai_generated")}
        />
        <Label htmlFor="is_ai_generated">AI Generated</Label>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : documentType ? "Update" : "Create"}
      </Button>
    </form>
  );
}