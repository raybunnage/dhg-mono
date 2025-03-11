export interface DocumentType {
  id: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}