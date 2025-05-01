import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExpertFormProps {
  expert?: {
    id: string;
    expert_name: string;
    full_name: string | null;
    mnemonic: string | null;
    is_in_core_group: boolean;
    metadata: any | null;
  };
  onSuccess: () => void;
}

interface FormValues {
  expert_name: string;
  full_name: string;
  mnemonic: string;
  is_in_core_group: boolean;
}

export function ExpertForm({ expert, onSuccess }: ExpertFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    defaultValues: {
      expert_name: expert?.expert_name || "",
      full_name: expert?.full_name || "",
      mnemonic: expert?.mnemonic || "",
      is_in_core_group: expert?.is_in_core_group || false,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      if (expert) {
        const { error } = await supabase
          .from("experts")
          .update(data)
          .eq("id", expert.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Expert updated successfully",
        });
      } else {
        const { error } = await supabase.from("experts").insert([data]);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Expert created successfully",
        });
      }
      onSuccess();
      form.reset();
    } catch (error) {
      console.error("Error saving expert:", error);
      toast({
        title: "Error",
        description: "Failed to save expert",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="expert_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expert Name *</FormLabel>
              <FormControl>
                <Input {...field} required />
              </FormControl>
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
                <Input {...field} />
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
                <Input placeholder="3-character code (e.g., WAG)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_in_core_group"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Core Group Member</FormLabel>
              <FormControl>
                <Input 
                  type="checkbox" 
                  checked={field.value} 
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="w-4 h-4"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : expert ? "Update Expert" : "Add Expert"}
        </Button>
      </form>
    </Form>
  );
}