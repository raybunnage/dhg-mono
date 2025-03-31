#!/usr/bin/env python3
"""
Supabase Client for Python

This module provides a singleton client for connecting to Supabase
from Python applications, including Modal functions.
"""

import os
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    print("Supabase Python SDK not installed. Install with: pip install supabase")
    Client = Any  # Type placeholder


class SupabaseClient:
    """Singleton Supabase client for Python applications"""
    
    _instance = None
    _client: Optional[Client] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SupabaseClient, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Load environment variables and initialize the client"""
        # Try to load various env files
        for env_file in ['.env', '.env.local', '.env.development']:
            if os.path.exists(env_file):
                load_dotenv(env_file)
                print(f"Loaded environment from {env_file}")
        
        # Get Supabase credentials
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('CLI_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY') or os.getenv('CLI_SUPABASE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("Supabase URL and key must be provided in environment variables")
        
        # Initialize client
        self._client = create_client(supabase_url, supabase_key)
        print(f"Initialized Supabase client for {supabase_url}")
    
    def get_client(self) -> Client:
        """Get the Supabase client instance"""
        if self._client is None:
            self._initialize()
        return self._client
    
    def update_expert_document(self, document_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an expert document with new data"""
        response = self._client.table('expert_documents').update(data).eq('id', document_id).execute()
        return response.data
    
    def get_expert_document(self, document_id: str) -> Dict[str, Any]:
        """Get an expert document by ID"""
        response = self._client.table('expert_documents').select('*').eq('id', document_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return {}
    
    def find_pending_transcriptions(self, limit: int = 10) -> list:
        """Find expert documents that need transcription"""
        response = self._client.table('expert_documents').select('*') \
            .eq('content_type', 'presentation') \
            .eq('transcription_status', 'pending') \
            .order('created_at', desc=False) \
            .limit(limit) \
            .execute()
        return response.data
    
    def store_transcription(self, document_id: str, transcription: Dict[str, Any]) -> Dict[str, Any]:
        """Store transcription results for an expert document"""
        data = {
            'raw_content': transcription['text'],
            'transcription_status': 'transcribed',
            'processing_status': 'completed',
            'word_count': len(transcription['text'].split()),
            'processed_content': transcription,
            'last_processed_at': 'now()'
        }
        return self.update_expert_document(document_id, data)


# Singleton instance
supabase = SupabaseClient()


def main():
    """Simple test function"""
    print("Testing Supabase connection...")
    client = supabase.get_client()
    
    # Check connection
    response = client.table('document_types').select('id, document_type').limit(1).execute()
    print(f"Found document type: {json.dumps(response.data, indent=2)}")

if __name__ == "__main__":
    main()