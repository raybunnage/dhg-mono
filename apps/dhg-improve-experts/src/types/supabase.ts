export interface Database {
  public: {
    Tables: {
      expert_documents: {
        Row: {
          id: string;
          raw_content: string;
          source_id: string;
          processing_status: 'pending' | 'processing' | 'completed' | 'failed';
          processed_at: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          raw_content: string;
          source_id: string;
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
          processed_at?: string | null;
        };
        Update: {
          raw_content?: string;
          source_id?: string;
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expert_documents_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "sources"
            referencedColumns: ["id"]
          }
        ]
      };
      // ... other existing tables ...
    };
  };
} 