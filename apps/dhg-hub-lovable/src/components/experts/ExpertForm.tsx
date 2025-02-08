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
    email_address: string | null;
    expertise_area: string | null;
    experience_years: number | null;
  };
  onSuccess: () => void;
}

interface FormValues {
  expert_name: string;
  full_name: string;
  email_address: string;
  expertise_area: string;
  experience_years: number;
}

export function ExpertForm({ expert, onSuccess }: ExpertFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    defaultValues: {
      expert_name: expert?.expert_name || "",
      full_name: expert?.full_name || "",
      email_address: expert?.email_address || "",
      expertise_area: expert?.expertise_area || "",
      experience_years: expert?.experience_years || 0,
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
          name="email_address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
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
                <Input {...field} />
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
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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