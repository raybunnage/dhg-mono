import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ExpertFormData, ExpertInterface, expertUtils } from '@/types/expert';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { expertServiceAdapter } from '@/services/expert-service-adapter';

const expertFormSchema = z.object({
  expert_name: z.string().min(2, {
    message: 'Expert name must be at least 2 characters.',
  }),
  full_name: z.string().min(2, {
    message: 'Full name must be at least 2 characters.',
  }),
  is_in_core_group: z.boolean().default(false),
  mnemonic: z.string().optional().nullable(),
  metadata: z.any().optional().nullable(),
});

interface ExpertFormProps {
  expert?: ExpertInterface;
  onSuccess?: (expert: ExpertInterface) => void;
  onCancel?: () => void;
}

export function ExpertForm({ expert, onSuccess, onCancel }: ExpertFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!expert;

  const form = useForm<z.infer<typeof expertFormSchema>>({
    resolver: zodResolver(expertFormSchema),
    defaultValues: {
      expert_name: expert?.expert_name || '',
      full_name: expert?.full_name || '',
      is_in_core_group: expert?.is_in_core_group || false,
      mnemonic: expert?.mnemonic || '',
      metadata: expert?.metadata || null,
    },
  });

  async function onSubmit(data: z.infer<typeof expertFormSchema>) {
    try {
      setIsSubmitting(true);
      
      // Prepare the expert data to save
      const expertData: Partial<ExpertInterface> = {
        ...data
      };
      
      if (isEditing && expert) {
        // Add ID for update
        expertData.id = expert.id;
      }
      
      // Use our expert service adapter
      const savedExpert = await expertServiceAdapter.upsertExpert(expertData);
      
      if (!savedExpert) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} expert`);
      }

      toast.success(`Expert ${isEditing ? 'updated' : 'created'} successfully`);
      
      if (onSuccess) {
        onSuccess(savedExpert);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} expert`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="expert_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expert Name</FormLabel>
              <FormControl>
                <Input placeholder="Expert identifier" {...field} />
              </FormControl>
              <FormDescription>
                Short name used to identify the expert in the system
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Dr. Jane Smith" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mnemonic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mnemonic</FormLabel>
              <FormControl>
                <Input placeholder="3-character code (e.g., WAG)" {...field} value={field.value || ''} />
              </FormControl>
              <FormDescription>
                A short 3-character code used to quickly identify this expert
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_in_core_group"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Core Group</FormLabel>
                <FormDescription>
                  Mark this expert as part of the core group
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
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
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Expert' : 'Create Expert'}
          </Button>
        </div>
      </form>
    </Form>
  );
}