import { supabase } from '@/integrations/supabase/client'
import { ApiResponse } from '@/types/supabase'

const FASTAPI_BASE_URL = 'YOUR_FASTAPI_URL' // This should be configured per environment

// Supabase service wrapper
export const supabaseService = {
  // Auth methods
  async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // Expert methods
  async getExperts(): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
      
      if (error) throw error
      return { data, error: null }
    } catch (error: any) {
      console.error('Error fetching experts:', error)
      return { data: null, error: error.message }
    }
  }
}

// FastAPI service wrapper
export const fastApiService = {
  // Helper method for FastAPI calls
  private: {
    async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
      const session = await supabaseService.getCurrentSession()
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        ...options.headers,
      }

      return fetch(`${FASTAPI_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      })
    }
  },

  // FastAPI methods
  async processDocument(file: File): Promise<ApiResponse<any>> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await this.private.fetchWithAuth('/process-document', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.detail || 'Failed to process document')
      
      return { data, error: null }
    } catch (error: any) {
      console.error('Error processing document:', error)
      return { data: null, error: error.message }
    }
  }
}