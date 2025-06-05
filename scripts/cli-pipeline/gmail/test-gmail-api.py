#!/usr/bin/env python3
"""
Test script to verify Gmail API connection
Run this to ensure your credentials are properly configured
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../packages/python-gmail-service/src'))

import asyncio
from gmail_service import GmailService

async def test_gmail_connection():
    """Test basic Gmail API connectivity"""
    print("Testing Gmail API connection...")
    print("=" * 50)
    
    try:
        # Initialize the service
        service = GmailService()
        await service.initialize()
        
        print("✅ Gmail API initialized successfully!")
        print("\nTesting basic API call...")
        
        # Try to get user's email address
        profile = service.service.users().getProfile(userId='me').execute()
        email_address = profile.get('emailAddress', 'Unknown')
        total_messages = profile.get('messagesTotal', 0)
        
        print(f"✅ Connected to: {email_address}")
        print(f"   Total messages: {total_messages:,}")
        print(f"   History ID: {profile.get('historyId', 'N/A')}")
        
        # Try to list a few message IDs
        print("\nTesting message list...")
        result = service.service.users().messages().list(
            userId='me',
            maxResults=5
        ).execute()
        
        messages = result.get('messages', [])
        print(f"✅ Retrieved {len(messages)} message IDs")
        
        print("\n" + "=" * 50)
        print("Gmail API connection test completed successfully!")
        print("\nNext steps:")
        print("1. Add important email addresses:")
        print("   ./gmail-cli.sh manage-addresses add 'email@example.com'")
        print("2. Run a test sync:")
        print("   ./gmail-cli.sh sync-emails --days 1")
        
    except FileNotFoundError as e:
        print(f"❌ Credentials file not found: {e}")
        print("\nPlease ensure you have one of these files:")
        print("- credentials.json (for OAuth)")
        print("- .service-account.json (for Service Account)")
        print("\nSee the setup guide for instructions.")
        sys.exit(1)
        
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        print("\nTroubleshooting:")
        print("1. Check that Gmail API is enabled in Google Cloud Console")
        print("2. Verify your credentials file is valid")
        print("3. For service accounts, ensure domain-wide delegation is configured")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_gmail_connection())