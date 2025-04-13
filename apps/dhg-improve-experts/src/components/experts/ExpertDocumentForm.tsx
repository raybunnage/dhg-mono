import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExpertDocument } from '@/types/expert';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'sonner';
import { expertServiceAdapter } from '@/services/expert-service-adapter';
import { documentPipelineAdapter } from '@/services/document-pipeline-adapter';
import { PlayCircle } from 'lucide-react';

const expertDocumentFormSchema = z.object({
  expert_id: z.string().min(1, { message: 'Expert is required' }),
  source_id: z.string().min(1, { message: 'Source document is required' }),
  document_type: z.string().min(1, { message: 'Document type is required' }),
  title: z.string().min(1, { message: 'Title is required' }),
  raw_content: z.string().optional(),
  process_after_save: z.boolean().default(false),
});

interface ExpertDocumentFormProps {
  document?: ExpertDocument;
  expertId?: string;
  onSuccess?: (document: ExpertDocument) => void;
  onCancel?: () => void;
}

export function ExpertDocumentForm({ document, expertId, onSuccess, onCancel }: ExpertDocumentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
      process_after_save: false,
    },
  });

  useEffect(() => {
    async function loadData() {
      try {
        // Load experts using our service adapter
        const expertsData = await expertServiceAdapter.getAllExperts();
        const expertItems = expertsData.map(expert => ({
          id: expert.id,
          expert_name: expert.expert_name
        }));
        setExperts(expertItems);
        
        // Load source documents using our service adapter
        const sourcesData = await expertServiceAdapter.getSources();
        setSources(sourcesData);
      } catch (error) {
        console.error('Error loading form data:', error);
        toast.error('Failed to load form data');
      }
    }
    
    loadData();
  }, []);

  async function processDocument(documentId: string): Promise<boolean> {
    try {
      setIsProcessing(true);
      
      // Use the document pipeline adapter to process the document
      const success = await documentPipelineAdapter.processDocument(documentId);
      
      if (success) {
        toast.success('Document processed successfully');
        return true;
      } else {
        toast.error('Failed to process document');
        return false;
      }
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('An error occurred while processing the document');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }

  async function onSubmit(data: z.infer<typeof expertDocumentFormSchema>) {
    try {
      setIsSubmitting(true);
      
      // Set processing status
      const documentData = {
        ...data,
        processing_status: 'pending'
      };
      
      let result;
      
      if (isEditing && document) {
        // Update existing document using our service adapter
        result = await expertServiceAdapter.updateExpertDocument(document.id, documentData);
      } else {
        // Create new document using our service adapter
        result = await expertServiceAdapter.createExpertDocument(documentData);
      }

      if (!result) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} document`);
      }

      toast.success(`Document ${isEditing ? 'updated' : 'created'} successfully`);
      
      // Process the document if option is selected
      if (data.process_after_save) {
        await processDocument(result.id);
        
        // Refresh the document to get updated processed content
        const updatedDoc = await expertServiceAdapter.getExpertDocumentById(result.id);
        if (updatedDoc) {
          result = updatedDoc;
        }
      }
      
      if (onSuccess) {
        onSuccess(result);
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

        <FormField
          control={form.control}
          name="process_after_save"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="flex items-center">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Process document after saving
                </FormLabel>
                <FormDescription>
                  Automatically run content processing pipeline after saving
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || isProcessing}>
            {isSubmitting ? 'Saving...' : isProcessing ? 'Processing...' : isEditing ? 'Update Document' : 'Add Document'}
          </Button>
        </div>
      </form>
    </Form>
  );
}