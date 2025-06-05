"""Supabase client for database operations."""

import os
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

class SupabaseClient:
    """Singleton Supabase client."""
    
    _instance: Optional['SupabaseClient'] = None
    _client: Optional[Client] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize Supabase client."""
        if self._client is None:
            self._setup_client()
            
    def _setup_client(self):
        """Setup the Supabase client."""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
            
        self._client = create_client(url, key)
        logging.info("Supabase client initialized")
        
    @property
    def client(self) -> Client:
        """Get the Supabase client."""
        if self._client is None:
            self._setup_client()
        return self._client
    
    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert data into a table.
        
        Args:
            table: Table name
            data: Data to insert
            
        Returns:
            Inserted data
        """
        result = self.client.table(table).insert(data).execute()
        return result.data[0] if result.data else None
    
    def batch_insert(self, table: str, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch insert data into a table.
        
        Args:
            table: Table name
            data: List of data to insert
            
        Returns:
            List of inserted data
        """
        result = self.client.table(table).insert(data).execute()
        return result.data
    
    def update(self, table: str, data: Dict[str, Any], match: Dict[str, Any]) -> Dict[str, Any]:
        """Update data in a table.
        
        Args:
            table: Table name
            data: Data to update
            match: Conditions to match
            
        Returns:
            Updated data
        """
        query = self.client.table(table).update(data)
        
        for key, value in match.items():
            query = query.eq(key, value)
            
        result = query.execute()
        return result.data[0] if result.data else None
    
    def select(self, table: str, columns: str = "*", filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Select data from a table.
        
        Args:
            table: Table name
            columns: Columns to select
            filters: Filter conditions
            
        Returns:
            List of selected data
        """
        query = self.client.table(table).select(columns)
        
        if filters:
            for key, value in filters.items():
                if isinstance(value, list):
                    query = query.in_(key, value)
                else:
                    query = query.eq(key, value)
                    
        result = query.execute()
        return result.data
    
    def delete(self, table: str, match: Dict[str, Any]) -> bool:
        """Delete data from a table.
        
        Args:
            table: Table name
            match: Conditions to match
            
        Returns:
            Success status
        """
        query = self.client.table(table).delete()
        
        for key, value in match.items():
            query = query.eq(key, value)
            
        result = query.execute()
        return True
    
    def upsert(self, table: str, data: Dict[str, Any], on_conflict: str = None) -> Dict[str, Any]:
        """Upsert data into a table.
        
        Args:
            table: Table name
            data: Data to upsert
            on_conflict: Column(s) to check for conflicts
            
        Returns:
            Upserted data
        """
        result = self.client.table(table).upsert(data, on_conflict=on_conflict).execute()
        return result.data[0] if result.data else None
    
    def rpc(self, function_name: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Call a Postgres function.
        
        Args:
            function_name: Name of the function
            params: Function parameters
            
        Returns:
            Function result
        """
        result = self.client.rpc(function_name, params or {}).execute()
        return result.data
