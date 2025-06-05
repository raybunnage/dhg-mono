"""Database module for NLP presentation analysis."""

from .supabase_client import SupabaseClient
from .queries import PresentationQueries

__all__ = ['SupabaseClient', 'PresentationQueries']
