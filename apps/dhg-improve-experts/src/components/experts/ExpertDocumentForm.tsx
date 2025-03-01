import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExpertDocument } from '@/types/expert';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const expertDocumentFormSchema = z.object({
  expert_id: z.string().min(1, { message: 'Expert is required' }),
  source_id: z.string().min(1, { message: 'Source document is required' }),
  document_type: z.string().min(1, { message: 'Document type is required' }),
  title: z.string().min(1, { message: 'Title is required' }),
  raw_content: z.string().optional(),
});

interface ExpertDocumentFormProps {
  document?: ExpertDocument;
  expertId?: string;
  onSuccess?: (document: ExpertDocument) => void;
  onCancel?: () => void;
}

export function ExpertDocumentForm({ document, expertId, onSuccess, onCancel }: ExpertDocumentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [experts, setExperts] = useState<{id: string, expert_name: string}[]>([]);
  const [sources, setSources] = useState<{id: string, title: string}[]>([]);
  const [documentTypes, setDocumentTypes] = useState<string[]>([
    'CV', 'Biography', 'Research Paper', 'Presentation', 'Website', 'Other'
  ]);
  
  const isEditing = !!document;

  const form = useForm<z.infer<typeof expertDocumentFormSchema>>({
    resolver: zodResolver(expertDocumentFormSchema),
    defaultValues: {
      expert_id: document?.expert_id || expertId || '',
      source_id: document?.source_id || '',
      document_type: document?.document_type || '',
      title: document?.title || '',
      raw_content: document?.raw_content || '',
    },
  });

  useEffect(() => {
    async function loadData() {
      try {
        // Load experts
        const { data: expertsData, error: expertsError } = await supabase
          .from('experts')
          .select('id, expert_name')
          .order('expert_name');
          
        if (expertsError) throw expertsError;
        setExperts(expertsData || []);
        
        // Load source documents
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('sources_google')
          .select('id, title')
          .order('title');
          
        if (sourcesError) throw sourcesError;
        setSources(sourcesData || []);
      } catch (error) {
        console.error('Error loading form data:', error);
        toast.error('Failed to load form data');
      }
    }
    
    loadData();
  }, []);

  async function onSubmit(data: z.infer<typeof expertDocumentFormSchema>) {
    try {
      setIsSubmitting(true);
      
      let response;
      
      // Set processing status
      const documentData = {
        ...data,
        processing_status: 'pending'
      };
      
      if (isEditing && document) {
        // Update existing document
        response = await supabase
          .from('expert_documents')
          .update(documentData)
          .eq('id', document.id)
          .select()
          .single();
      } else {
        // Create new document
        response = await supabase
          .from('expert_documents')
          .insert(documentData)
          .select()
          .single();
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success(`Document ${isEditing ? 'updated' : 'created'} successfully`);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} document`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="expert_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expert</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                disabled={!!expertId} // Disable if expertId is provided
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an expert" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {experts.map(expert => (
                    <SelectItem key={expert.id} value={expert.id}>
                      {expert.expert_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="source_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source Document</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a source document" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {sources.map(source => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="document_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Document title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="raw_content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Document content"
                  className="min-h-32"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional raw content or notes about the document
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Document' : 'Add Document'}
          </Button>
        </div>
      </form>
    </Form>
  );
}