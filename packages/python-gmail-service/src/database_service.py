"""
Database service for Gmail data using Supabase/PostgreSQL
Handles all database operations with proper UUID handling
"""

import os
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from uuid import uuid4
import asyncpg
from dotenv import load_dotenv

load_dotenv()

class GmailDatabaseService:
    """Handle all Gmail-related database operations"""
    
    def __init__(self):
        self.db_url = os.getenv('SUPABASE_DB_URL', os.getenv('DATABASE_URL'))
        if not self.db_url:
            raise ValueError("Database URL not found in environment variables")
        
        # Parse connection string to get components
        self._parse_connection_string()
        
    def _parse_connection_string(self):
        """Parse PostgreSQL connection string"""
        # Example: postgresql://user:password@host:port/dbname
        import re
        pattern = r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)'
        match = re.match(pattern, self.db_url)
        if match:
            self.db_config = {
                'user': match.group(1),
                'password': match.group(2),
                'host': match.group(3),
                'port': int(match.group(4)),
                'database': match.group(5)
            }
        else:
            raise ValueError("Invalid database URL format")
    
    async def get_connection(self):
        """Get async database connection"""
        return await asyncpg.connect(**self.db_config)
    
    async def get_important_addresses(self, importance_level: Optional[int] = None) -> List[Dict]:
        """Get important email addresses from database"""
        conn = await self.get_connection()
        try:
            if importance_level:
                query = """
                    SELECT email_address, importance_level 
                    FROM email_important_addresses 
                    WHERE importance_level >= $1
                    ORDER BY importance_level DESC, email_address
                """
                rows = await conn.fetch(query, importance_level)
            else:
                query = """
                    SELECT email_address, importance_level 
                    FROM email_important_addresses 
                    ORDER BY importance_level DESC, email_address
                """
                rows = await conn.fetch(query)
            
            return [dict(row) for row in rows]
        finally:
            await conn.close()
    
    async def get_last_sync_date(self) -> Optional[datetime]:
        """Get the date of the most recent email in the database"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT MAX(date) as last_date 
                FROM email_messages 
                WHERE date IS NOT NULL
            """
            result = await conn.fetchone(query)
            return result['last_date'] if result else None
        finally:
            await conn.close()
    
    async def email_exists(self, sender: str, date: datetime, subject: str) -> bool:
        """Check if an email already exists in the database"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT EXISTS(
                    SELECT 1 FROM email_messages 
                    WHERE sender = $1 
                    AND date = $2 
                    AND subject = $3
                )
            """
            result = await conn.fetchone(query, sender, date, subject)
            return result['exists']
        finally:
            await conn.close()
    
    async def insert_emails_batch(self, emails: List[Dict[str, Any]]) -> List[str]:
        """Insert emails in batch, returning list of inserted IDs"""
        if not emails:
            return []
        
        conn = await self.get_connection()
        inserted_ids = []
        
        try:
            # Begin transaction
            async with conn.transaction():
                for email in emails:
                    # Check if email already exists
                    if await self.email_exists(
                        email['sender'], 
                        email['date'], 
                        email['subject']
                    ):
                        print(f"Skipping duplicate email: {email['subject']}")
                        continue
                    
                    # Insert email
                    email_id = await self._insert_single_email(conn, email)
                    if email_id:
                        inserted_ids.append(email_id)
                        
                        # Insert related data
                        await self._insert_email_attachments(conn, email_id, email.get('attachments', []))
                        await self._insert_email_urls(conn, email_id, email.get('urls', []))
                        
            print(f"Inserted {len(inserted_ids)} new emails")
            return inserted_ids
            
        except Exception as e:
            print(f"Error inserting emails: {e}")
            return []
        finally:
            await conn.close()
    
    async def _insert_single_email(self, conn: asyncpg.Connection, email: Dict) -> Optional[str]:
        """Insert a single email and return its ID"""
        try:
            # Calculate content length
            content = email.get('content_plain', '') or email.get('content_html', '')
            content_length = len(content) if content else 0
            
            # Prepare recipient strings
            to_recipients = ', '.join(email.get('to_recipients', []))
            
            query = """
                INSERT INTO email_messages (
                    id, sender, subject, date, content, 
                    to_recipients, attachment_cnt, url_cnt,
                    contents_length, created_at, updated_at,
                    domain_id
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                ) RETURNING id
            """
            
            email_id = str(uuid4())
            result = await conn.fetchone(
                query,
                email_id,
                email['sender'],
                email['subject'],
                email['date'],
                content,
                to_recipients,
                len(email.get('attachments', [])),
                len(email.get('urls', [])),
                content_length,
                datetime.now(),
                datetime.now(),
                email['message_id']  # Store Gmail message ID as domain_id
            )
            
            return result['id']
            
        except Exception as e:
            print(f"Error inserting email {email.get('subject', 'Unknown')}: {e}")
            return None
    
    async def _insert_email_attachments(self, conn: asyncpg.Connection, email_id: str, attachments: List[Dict]):
        """Insert email attachments"""
        if not attachments:
            return
        
        for attachment in attachments:
            try:
                # Extract file extension
                filename = attachment.get('filename', '')
                file_ext = os.path.splitext(filename)[1].lower() if filename else ''
                
                query = """
                    INSERT INTO email_attachments (
                        id, email_message_id, filename, file_extension,
                        size_bytes, mime_type, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """
                
                await conn.execute(
                    query,
                    str(uuid4()),
                    email_id,
                    filename,
                    file_ext,
                    attachment.get('size', 0),
                    attachment.get('mime_type', ''),
                    datetime.now()
                )
            except Exception as e:
                print(f"Error inserting attachment {filename}: {e}")
    
    async def _insert_email_urls(self, conn: asyncpg.Connection, email_id: str, urls: List[str]):
        """Insert email URLs and update research_urls table"""
        if not urls:
            return
        
        for url in urls:
            try:
                # Insert into email_extracted_urls
                query = """
                    INSERT INTO email_extracted_urls (
                        id, email_message_id, url, created_at
                    ) VALUES ($1, $2, $3, $4)
                """
                
                await conn.execute(
                    query,
                    str(uuid4()),
                    email_id,
                    url,
                    datetime.now()
                )
                
                # Update or insert into research_urls
                await self._update_research_url(conn, email_id, url)
                
            except Exception as e:
                print(f"Error inserting URL {url}: {e}")
    
    async def _update_research_url(self, conn: asyncpg.Connection, email_id: str, url: str):
        """Update or insert URL in research_urls table"""
        from urllib.parse import urlparse
        
        # Extract domain
        parsed = urlparse(url)
        domain = parsed.netloc
        
        # Check if URL exists
        check_query = "SELECT id, email_associations, email_count FROM research_urls WHERE url = $1"
        existing = await conn.fetchone(check_query, url)
        
        if existing:
            # Update existing URL
            associations = existing['email_associations'] or {'email_ids': [], 'senders': [], 'subjects': []}
            if email_id not in associations.get('email_ids', []):
                associations['email_ids'].append(email_id)
            
            update_query = """
                UPDATE research_urls 
                SET email_associations = $1,
                    email_count = email_count + 1,
                    last_seen = $2,
                    updated_at = $2
                WHERE id = $3
            """
            
            await conn.execute(
                update_query,
                json.dumps(associations),
                datetime.now(),
                existing['id']
            )
        else:
            # Insert new URL
            insert_query = """
                INSERT INTO research_urls (
                    id, url, domain, email_associations,
                    email_count, first_seen, last_seen,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6)
            """
            
            associations = {
                'email_ids': [email_id],
                'senders': [],
                'subjects': []
            }
            
            await conn.execute(
                insert_query,
                str(uuid4()),
                url,
                domain,
                json.dumps(associations),
                1,
                datetime.now()
            )
    
    async def mark_emails_for_processing(self, email_ids: List[str]) -> int:
        """Mark emails as ready for AI processing"""
        if not email_ids:
            return 0
        
        conn = await self.get_connection()
        try:
            query = """
                UPDATE email_messages 
                SET is_ai_process_for_concepts = 1
                WHERE id = ANY($1)
            """
            
            result = await conn.execute(query, email_ids)
            # Extract number of rows affected from result string
            count = int(result.split()[-1]) if result else 0
            return count
        finally:
            await conn.close()
    
    async def get_unprocessed_emails(self, limit: int = 50) -> List[Dict]:
        """Get emails that haven't been processed for content extraction"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT em.id, em.sender, em.subject, em.date, em.content,
                       em.to_recipients, em.attachment_cnt, em.url_cnt
                FROM email_messages em
                LEFT JOIN email_processed_contents epc ON em.id = epc.email_message_id
                WHERE epc.id IS NULL
                AND em.content IS NOT NULL
                AND LENGTH(em.content) > 100
                ORDER BY em.date DESC
                LIMIT $1
            """
            
            rows = await conn.fetch(query, limit)
            return [dict(row) for row in rows]
        finally:
            await conn.close()
    
    async def insert_processed_content(self, email_id: str, processed_data: Dict):
        """Insert AI-processed email content"""
        conn = await self.get_connection()
        try:
            query = """
                INSERT INTO email_processed_contents (
                    id, email_message_id, participants_count, participants,
                    summary, is_science_discussion, is_science_material,
                    is_meeting_focused, notable_quotes, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """
            
            await conn.execute(
                query,
                str(uuid4()),
                email_id,
                processed_data.get('participants_count', 0),
                json.dumps(processed_data.get('participants', [])),
                processed_data.get('summary', ''),
                processed_data.get('is_science_discussion', False),
                processed_data.get('is_science_material', False),
                processed_data.get('is_meeting_focused', False),
                json.dumps(processed_data.get('notable_quotes', [])),
                datetime.now()
            )
            
            # Mark email as processed
            update_query = """
                UPDATE email_messages 
                SET is_in_contents = 1 
                WHERE id = $1
            """
            await conn.execute(update_query, email_id)
            
        finally:
            await conn.close()


# Example usage
async def test_database():
    """Test database operations"""
    db = GmailDatabaseService()
    
    # Get important addresses
    addresses = await db.get_important_addresses(importance_level=2)
    print(f"Important addresses: {addresses}")
    
    # Get last sync date
    last_sync = await db.get_last_sync_date()
    print(f"Last sync date: {last_sync}")


if __name__ == "__main__":
    asyncio.run(test_database())