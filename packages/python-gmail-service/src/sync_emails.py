#!/usr/bin/env python3
"""
Main email sync script that integrates Gmail API with Supabase
Supports incremental sync and batch processing
"""

import asyncio
import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from gmail_service import GmailService
from database_service import GmailDatabaseService


class EmailSyncManager:
    """Manage the email synchronization process"""
    
    def __init__(self, credentials_path: str = None):
        """Initialize sync manager with services"""
        # Try to find credentials
        if not credentials_path:
            # Check for service account first
            if Path('.service-account.json').exists():
                credentials_path = '.service-account.json'
            elif Path('credentials.json').exists():
                credentials_path = 'credentials.json'
            else:
                raise ValueError("No Gmail credentials found. Please provide credentials.json or .service-account.json")
        
        self.gmail_service = GmailService(credentials_path)
        self.db_service = GmailDatabaseService()
        
    async def sync_emails(
        self,
        days_back: int = 7,
        importance_level: Optional[int] = None,
        max_results: int = 500,
        incremental: bool = True
    ) -> Dict[str, Any]:
        """
        Sync emails from Gmail to database
        
        Args:
            days_back: Number of days to look back (if not incremental)
            importance_level: Minimum importance level for addresses
            max_results: Maximum number of emails to sync
            incremental: Use incremental sync based on last sync date
            
        Returns:
            Sync statistics
        """
        stats = {
            'start_time': datetime.now(),
            'emails_fetched': 0,
            'emails_inserted': 0,
            'attachments_found': 0,
            'urls_extracted': 0,
            'errors': []
        }
        
        try:
            # Get important addresses
            important_addresses = await self.db_service.get_important_addresses(importance_level)
            if not important_addresses:
                print("Warning: No important addresses found. Syncing all emails.")
                email_addresses = None
            else:
                email_addresses = [addr['email_address'] for addr in important_addresses]
                print(f"Syncing emails from {len(email_addresses)} important addresses")
            
            # Determine sync date
            if incremental:
                last_sync = await self.db_service.get_last_sync_date()
                if last_sync:
                    # Add a small buffer to avoid missing emails
                    after_date = last_sync - timedelta(hours=1)
                    print(f"Incremental sync from {after_date}")
                else:
                    after_date = datetime.now() - timedelta(days=days_back)
                    print(f"No previous sync found. Syncing last {days_back} days")
            else:
                after_date = datetime.now() - timedelta(days=days_back)
                print(f"Full sync for last {days_back} days")
            
            # Build query
            query = 'is:unread OR is:important'  # Start with unread and important
            
            # Fetch emails
            print("Fetching emails from Gmail...")
            emails = await self.gmail_service.fetch_emails_batch(
                query=query,
                max_results=max_results,
                important_addresses=email_addresses,
                after_date=after_date
            )
            
            stats['emails_fetched'] = len(emails)
            print(f"Fetched {len(emails)} emails")
            
            if emails:
                # Count attachments and URLs
                for email in emails:
                    stats['attachments_found'] += len(email.get('attachments', []))
                    stats['urls_extracted'] += len(email.get('urls', []))
                
                # Insert emails into database
                print("Inserting emails into database...")
                inserted_ids = await self.db_service.insert_emails_batch(emails)
                stats['emails_inserted'] = len(inserted_ids)
                
                # Mark for AI processing if requested
                if inserted_ids:
                    marked = await self.db_service.mark_emails_for_processing(inserted_ids)
                    print(f"Marked {marked} emails for AI processing")
            
            stats['end_time'] = datetime.now()
            stats['duration'] = (stats['end_time'] - stats['start_time']).total_seconds()
            
            # Print summary
            self._print_summary(stats)
            
            return stats
            
        except Exception as e:
            stats['errors'].append(str(e))
            print(f"Error during sync: {e}")
            return stats
    
    def _print_summary(self, stats: Dict):
        """Print sync summary"""
        print("\n" + "="*50)
        print("SYNC SUMMARY")
        print("="*50)
        print(f"Duration: {stats['duration']:.2f} seconds")
        print(f"Emails fetched: {stats['emails_fetched']}")
        print(f"Emails inserted: {stats['emails_inserted']}")
        print(f"Attachments found: {stats['attachments_found']}")
        print(f"URLs extracted: {stats['urls_extracted']}")
        
        if stats['errors']:
            print(f"\nErrors: {len(stats['errors'])}")
            for error in stats['errors']:
                print(f"  - {error}")
        
        print("="*50)
    
    async def process_unprocessed_emails(self, limit: int = 50) -> Dict[str, Any]:
        """Process emails that haven't been analyzed yet"""
        stats = {
            'emails_processed': 0,
            'errors': []
        }
        
        try:
            # Get unprocessed emails
            emails = await self.db_service.get_unprocessed_emails(limit)
            print(f"Found {len(emails)} unprocessed emails")
            
            # Here you would integrate with Claude API for processing
            # For now, we'll just mark them as ready
            for email in emails:
                # Placeholder for AI processing
                processed_data = {
                    'participants_count': 1,
                    'participants': [email['sender']],
                    'summary': f"Email about: {email['subject'][:100]}",
                    'is_science_discussion': 'research' in email['subject'].lower(),
                    'is_science_material': 'paper' in email['subject'].lower(),
                    'is_meeting_focused': 'meeting' in email['subject'].lower(),
                    'notable_quotes': []
                }
                
                await self.db_service.insert_processed_content(email['id'], processed_data)
                stats['emails_processed'] += 1
            
            print(f"Processed {stats['emails_processed']} emails")
            
        except Exception as e:
            stats['errors'].append(str(e))
            print(f"Error processing emails: {e}")
        
        return stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Sync emails from Gmail to database')
    parser.add_argument('--days', type=int, default=7, help='Number of days to sync')
    parser.add_argument('--importance', type=int, help='Minimum importance level')
    parser.add_argument('--max-results', type=int, default=500, help='Maximum emails to sync')
    parser.add_argument('--full-sync', action='store_true', help='Disable incremental sync')
    parser.add_argument('--credentials', help='Path to credentials file')
    parser.add_argument('--process', action='store_true', help='Process unprocessed emails')
    parser.add_argument('--process-limit', type=int, default=50, help='Number of emails to process')
    
    args = parser.parse_args()
    
    try:
        # Initialize sync manager
        sync_manager = EmailSyncManager(args.credentials)
        
        if args.process:
            # Process unprocessed emails
            await sync_manager.process_unprocessed_emails(args.process_limit)
        else:
            # Sync emails
            await sync_manager.sync_emails(
                days_back=args.days,
                importance_level=args.importance,
                max_results=args.max_results,
                incremental=not args.full_sync
            )
        
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())