export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sources_google: {
        Row: {
          metadata: Json
          // ... other fields
        }
      }
      expert_documents: {
        Row: {
          processed_content: string | null
          processing_status: string | null
          // ... other fields
        }
      }
      // ... other tables
    }
  }
}
