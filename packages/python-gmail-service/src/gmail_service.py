"""
Modern Gmail Service using Gmail API v1
Supports OAuth 2.0 and Service Account authentication
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from concurrent.futures import ThreadPoolExecutor
import base64
from pathlib import Path

# Google API imports
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Email parsing
from bs4 import BeautifulSoup
import html2text

# URL validation
import validators

# Utilities
from tqdm import tqdm
import pytz
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class GmailService:
    """Modern Gmail service with batch operations and async support"""
    
    SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
    
    def __init__(self, credentials_path: Optional[str] = None, token_path: str = 'token.json'):
        """
        Initialize Gmail service with OAuth 2.0 or Service Account
        
        Args:
            credentials_path: Path to credentials.json or service-account.json
            token_path: Path to store OAuth token
        """
        self.service = self._authenticate(credentials_path, token_path)
        self.executor = ThreadPoolExecutor(max_workers=5)
        self.html_parser = html2text.HTML2Text()
        self.html_parser.ignore_links = False
        self.html_parser.ignore_images = False
        
    def _authenticate(self, credentials_path: Optional[str], token_path: str):
        """Authenticate using OAuth 2.0 or Service Account"""
        creds = None
        
        # Try service account first
        if credentials_path and credentials_path.endswith('.json'):
            try:
                if 'type' in json.load(open(credentials_path)):
                    # Service account
                    creds = service_account.Credentials.from_service_account_file(
                        credentials_path, scopes=self.SCOPES
                    )
                    # For service account, we need to delegate to a user
                    delegated_user = os.getenv('GMAIL_DELEGATED_USER')
                    if delegated_user:
                        creds = creds.with_subject(delegated_user)
            except Exception as e:
                print(f"Service account auth failed: {e}")
        
        # Try OAuth 2.0
        if not creds and os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, self.SCOPES)
        
        # If there are no (valid) credentials available, let the user log in
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not credentials_path:
                    raise ValueError("No credentials provided")
                flow = InstalledAppFlow.from_client_secrets_file(
                    credentials_path, self.SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Save the credentials for the next run
            with open(token_path, 'w') as token:
                token.write(creds.to_json())
        
        return build('gmail', 'v1', credentials=creds)
    
    async def fetch_emails_batch(
        self,
        query: str,
        max_results: int = 500,
        important_addresses: Optional[List[str]] = None,
        after_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch emails in batches using Gmail API
        
        Args:
            query: Gmail search query
            max_results: Maximum number of emails to fetch
            important_addresses: Filter by important email addresses
            after_date: Only fetch emails after this date
            
        Returns:
            List of email dictionaries with metadata and content
        """
        emails = []
        
        # Build query
        if after_date:
            query += f" after:{after_date.strftime('%Y/%m/%d')}"
        
        if important_addresses:
            address_query = " OR ".join([f"from:{addr}" for addr in important_addresses])
            query = f"({query}) AND ({address_query})"
        
        try:
            # Get message IDs
            results = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            
            if not messages:
                return emails
            
            # Batch get message details
            print(f"Fetching {len(messages)} emails...")
            
            # Process in batches of 50 (API limit)
            batch_size = 50
            for i in tqdm(range(0, len(messages), batch_size)):
                batch = messages[i:i + batch_size]
                batch_emails = await self._process_email_batch(batch)
                emails.extend(batch_emails)
                
        except HttpError as error:
            print(f'An error occurred: {error}')
            
        return emails
    
    async def _process_email_batch(self, message_batch: List[Dict]) -> List[Dict[str, Any]]:
        """Process a batch of emails concurrently"""
        tasks = []
        loop = asyncio.get_event_loop()
        
        for msg in message_batch:
            task = loop.run_in_executor(
                self.executor,
                self._get_email_details,
                msg['id']
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out any errors
        emails = [r for r in results if isinstance(r, dict)]
        return emails
    
    def _get_email_details(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information for a single email"""
        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            # Extract headers
            headers = message['payload'].get('headers', [])
            header_dict = {h['name']: h['value'] for h in headers}
            
            # Extract email metadata
            email_data = {
                'message_id': message_id,
                'thread_id': message.get('threadId'),
                'label_ids': message.get('labelIds', []),
                'subject': header_dict.get('Subject', ''),
                'sender': self._extract_email_address(header_dict.get('From', '')),
                'to_recipients': self._parse_recipients(header_dict.get('To', '')),
                'cc_recipients': self._parse_recipients(header_dict.get('Cc', '')),
                'date': self._parse_date(header_dict.get('Date', '')),
                'snippet': message.get('snippet', ''),
                'size_estimate': message.get('sizeEstimate', 0),
                'attachments': [],
                'urls': [],
                'content_plain': '',
                'content_html': ''
            }
            
            # Process message parts
            self._process_parts(message['payload'], email_data)
            
            # Extract URLs from content
            email_data['urls'] = self._extract_urls(
                email_data['content_plain'] + ' ' + email_data['content_html']
            )
            
            return email_data
            
        except Exception as e:
            print(f"Error fetching email {message_id}: {e}")
            return None
    
    def _process_parts(self, payload: Dict, email_data: Dict) -> None:
        """Recursively process email parts"""
        if 'parts' in payload:
            for part in payload['parts']:
                self._process_parts(part, email_data)
        else:
            self._process_single_part(payload, email_data)
    
    def _process_single_part(self, part: Dict, email_data: Dict) -> None:
        """Process a single email part"""
        mime_type = part.get('mimeType', '')
        
        # Handle attachments
        if part.get('filename'):
            attachment_data = {
                'filename': part['filename'],
                'mime_type': mime_type,
                'size': part['body'].get('size', 0),
                'attachment_id': part['body'].get('attachmentId', '')
            }
            email_data['attachments'].append(attachment_data)
            return
        
        # Handle text content
        if mime_type == 'text/plain':
            data = part['body'].get('data', '')
            if data:
                email_data['content_plain'] = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
        
        elif mime_type == 'text/html':
            data = part['body'].get('data', '')
            if data:
                html_content = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                email_data['content_html'] = html_content
                
                # Also convert to plain text for analysis
                if not email_data['content_plain']:
                    email_data['content_plain'] = self._html_to_text(html_content)
    
    def _html_to_text(self, html_content: str) -> str:
        """Convert HTML to plain text"""
        try:
            # Use BeautifulSoup for initial cleaning
            soup = BeautifulSoup(html_content, 'lxml')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Use html2text for conversion
            text = self.html_parser.handle(str(soup))
            return text.strip()
        except Exception as e:
            print(f"Error converting HTML to text: {e}")
            return ""
    
    def _extract_urls(self, text: str) -> List[str]:
        """Extract and validate URLs from text"""
        urls = []
        words = text.split()
        
        for word in words:
            # Clean up the word
            word = word.strip('.,;:!?"\'()<>[]{}')
            
            # Check if it's a valid URL
            if validators.url(word):
                urls.append(word)
            elif word.startswith(('http://', 'https://', 'www.')):
                # Try to clean and validate
                if word.startswith('www.'):
                    word = 'https://' + word
                if validators.url(word):
                    urls.append(word)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_urls = []
        for url in urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)
        
        return unique_urls
    
    def _extract_email_address(self, from_header: str) -> str:
        """Extract email address from From header"""
        import re
        email_pattern = r'<([^>]+)>'
        match = re.search(email_pattern, from_header)
        if match:
            return match.group(1)
        # If no angle brackets, assume the whole thing is the email
        return from_header.strip()
    
    def _parse_recipients(self, recipient_header: str) -> List[str]:
        """Parse recipient headers into list of email addresses"""
        if not recipient_header:
            return []
        
        recipients = []
        for recipient in recipient_header.split(','):
            email = self._extract_email_address(recipient.strip())
            if email:
                recipients.append(email)
        
        return recipients
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse email date string to datetime"""
        if not date_str:
            return None
        
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str)
        except Exception as e:
            print(f"Error parsing date {date_str}: {e}")
            return None
    
    async def get_history_changes(self, start_history_id: str) -> List[Dict]:
        """Get incremental changes since last sync using History API"""
        try:
            results = self.service.users().history().list(
                userId='me',
                startHistoryId=start_history_id,
                historyTypes=['messageAdded', 'messageDeleted'],
                maxResults=500
            ).execute()
            
            return results.get('history', [])
        except HttpError as error:
            print(f'Error getting history: {error}')
            return []
    
    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download an attachment"""
        try:
            attachment = self.service.users().messages().attachments().get(
                userId='me',
                messageId=message_id,
                id=attachment_id
            ).execute()
            
            data = attachment['data']
            return base64.urlsafe_b64decode(data)
        except HttpError as error:
            print(f'Error downloading attachment: {error}')
            return b''


# Utility function for command-line usage
async def main():
    """Example usage"""
    service = GmailService('credentials.json')
    
    # Fetch recent emails
    emails = await service.fetch_emails_batch(
        query='is:unread',
        max_results=10,
        after_date=datetime.now() - timedelta(days=7)
    )
    
    for email in emails:
        print(f"Subject: {email['subject']}")
        print(f"From: {email['sender']}")
        print(f"Date: {email['date']}")
        print(f"Attachments: {len(email['attachments'])}")
        print(f"URLs: {len(email['urls'])}")
        print("-" * 50)


if __name__ == "__main__":
    asyncio.run(main())