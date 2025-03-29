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
import { expertService } from '@/services/expert-service';

const expertFormSchema = z.object({
  expert_name: z.string().min(2, {
    message: 'Expert name must be at least 2 characters.',
  }),
  full_name: z.string().min(2, {
    message: 'Full name must be at least 2 characters.',
  }),
  bio: z.string().optional(),
  email_address: z.string().email().optional().nullable(),
  expertise_area: z.string().optional().nullable(),
  experience_years: z.coerce.number().min(0).optional().nullable(),
  is_in_core_group: z.boolean().default(false),
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
      bio: expert?.bio || '',
      email_address: expert?.email_address || '',
      expertise_area: expert?.expertise_area || '',
      experience_years: expert?.experience_years || 0,
      is_in_core_group: expert?.is_in_core_group || false,
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
      
      // Use our expert service
      const savedExpert = await expertService.upsertExpert(expertData);
      
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
          name="email_address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input placeholder="email@example.com" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expertise_area"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expertise Area</FormLabel>
              <FormControl>
                <Input placeholder="Neuroscience, Machine Learning, etc." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="experience_years"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Years of Experience</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Biography</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Expert bio and background information"
                  className="min-h-32"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
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