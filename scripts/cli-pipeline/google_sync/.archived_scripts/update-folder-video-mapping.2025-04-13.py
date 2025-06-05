#\!/usr/bin/env python3
"""
Update main_video_id in sources_google table based on a folder-to-video mapping.
"""

import sys
import os
import json
import re
import argparse
import requests
import dotenv
from pathlib import Path

# Find and load environment files
cwd = os.getcwd()
env_files = [".env", ".env.development", ".env.local"]
for env_file in env_files:
    env_path = Path(cwd) / env_file
    if env_path.exists():
        print(f"Loading environment variables from {env_path}")
        dotenv.load_dotenv(env_path)

# Check required environment variables
if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
    print("Error: SUPABASE_URL and SUPABASE_KEY environment variables are required")
    sys.exit(1)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def make_supabase_request(method, path, params=None, data=None):
    """Make a request to the Supabase API."""
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    url = f"{SUPABASE_URL}{path}"
    
    if method == "GET":
        response = requests.get(url, headers=headers, params=params)
    elif method == "POST":
        response = requests.post(url, headers=headers, json=data)
    elif method == "PATCH":
        response = requests.patch(url, headers=headers, json=data)
    else:
        raise ValueError(f"Unsupported method: {method}")
        
    if response.status_code >= 400:
        print(f"Error: {response.status_code} - {response.text}")
        return None
        
    return response.json()

def find_folder(folder_name):
    """Find a folder in sources_google by name."""
    response = make_supabase_request(
        "GET", 
        "/rest/v1/sources_google",
        params={
            "select": "id,name,drive_id,path,path_depth",
            "mime_type": "eq.application/vnd.google-apps.folder",
            "is_deleted": "eq.false",
            "name": f"eq.{folder_name}"
        }
    )
    
    if not response or len(response) == 0:
        print(f"No folder found with name: {folder_name}")
        return None
        
    # If multiple folders found, prefer one with path_depth = 0
    for folder in response:
        if folder.get("path_depth") == 0:
            return folder
            
    return response[0]  # Return first one if no path_depth = 0 found

def find_file(file_name):
    """Find a file in sources_google by name."""
    response = make_supabase_request(
        "GET", 
        "/rest/v1/sources_google",
        params={
            "select": "id,name,drive_id,path",
            "mime_type": "eq.video/mp4",
            "is_deleted": "eq.false",
            "name": f"eq.{file_name}"
        }
    )
    
    if not response or len(response) == 0:
        print(f"No file found with name: {file_name}")
        return None
        
    return response[0]

def update_folder_with_video_id(folder_id, video_id, dry_run=False):
    """Update the main_video_id for a folder."""
    if dry_run:
        print(f"DRY RUN: Would update folder id {folder_id} with main_video_id = {video_id}")
        return True
        
    response = make_supabase_request(
        "PATCH",
        f"/rest/v1/sources_google",
        params={"id": f"eq.{folder_id}"},
        data={"main_video_id": video_id}
    )
    
    if response is None:
        print(f"Error updating folder {folder_id}")
        return False
        
    print(f"Updated folder id {folder_id} with main_video_id = {video_id}")
    return True

def find_related_items(folder_name):
    """Find all items with this folder in their path_array."""
    # Use PostgreSQL's contains operator (cs) to efficiently find items with folder in path_array
    response = make_supabase_request(
        "GET", 
        "/rest/v1/sources_google",
        params={
            "select": "id,name,mime_type",
            "is_deleted": "eq.false",
            "path_array": f"cs.{{{folder_name}}}"
        }
    )
    
    if not response:
        return []
    
    return response

def update_related_items(item_ids, video_id, dry_run=False):
    """Update main_video_id for related items."""
    if dry_run:
        print(f"DRY RUN: Would update {len(item_ids)} related items with main_video_id = {video_id}")
        return True
        
    # Update in batches to avoid hitting API limits
    batch_size = 50
    for i in range(0, len(item_ids), batch_size):
        batch = item_ids[i:i+batch_size]
        id_list = ','.join([f"eq.{id}" for id in batch])
        
        response = make_supabase_request(
            "PATCH",
            f"/rest/v1/sources_google",
            params={"id": f"in.({id_list})"},
            data={"main_video_id": video_id}
        )
        
        if response is None:
            print(f"Error updating batch of items")
            return False
            
        print(f"Updated batch of {len(batch)} items with main_video_id = {video_id}")
        
    return True

def parse_mapping(mapping_str):
    """Parse a mapping string in the format: 'folder name': 'file name'."""
    try:
        # Find the colon that separates folder and file
        colon_index = mapping_str.find(':')
        if colon_index == -1:
            raise ValueError("Mapping must be in format: 'folder name': 'file name.mp4'")
            
        folder_part = mapping_str[:colon_index].strip()
        file_part = mapping_str[colon_index+1:].strip()
        
        # Extract folder name from quotes
        folder_match = re.match(r"^['\"](.+)['\"]$", folder_part)
        if not folder_match:
            raise ValueError("Folder name must be in quotes")
        folder_name = folder_match.group(1)
        
        # Extract file name from quotes
        file_match = re.match(r"^['\"](.+)['\"]$", file_part)
        if not file_match:
            raise ValueError("File name must be in quotes")
        file_name = file_match.group(1)
        
        return folder_name, file_name
    except Exception as e:
        print(f"Error parsing mapping: {e}")
        return None, None

def main():
    parser = argparse.ArgumentParser(description="Update main_video_id in sources_google")
    parser.add_argument("--mapping", required=True, help="Mapping in format: 'folder name': 'file name.mp4'")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated without making changes")
    parser.add_argument("--verbose", action="store_true", help="Show detailed logs")
    
    args = parser.parse_args()
    
    print("=== Update Main Video ID from Folder-Video Mapping ===")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'ACTUAL UPDATE'}")
    print(f"Mapping: {args.mapping}")
    print("=========================================")
    
    # Parse the mapping
    folder_name, file_name = parse_mapping(args.mapping)
    if not folder_name or not file_name:
        sys.exit(1)
        
    print(f"Folder: '{folder_name}'")
    print(f"File: '{file_name}'")
    
    # Find the folder
    folder = find_folder(folder_name)
    if not folder:
        sys.exit(1)
        
    print(f"Found folder: {folder['name']} (id: {folder['id']})")
    
    # Find the file
    file = find_file(file_name)
    if not file:
        sys.exit(1)
        
    print(f"Found file: {file['name']} (id: {file['id']})")
    
    # Update the folder with the main_video_id
    if not update_folder_with_video_id(folder['id'], file['id'], args.dry_run):
        sys.exit(1)
        
    # Find all related items with this folder in their path_array
    related_items = find_related_items(folder['name'])
    if related_items:
        print(f"Found {len(related_items)} related items to update with main_video_id")
        
        # Get IDs of related items
        item_ids = [item['id'] for item in related_items]
        
        # Update related items
        if not update_related_items(item_ids, file['id'], args.dry_run):
            sys.exit(1)
            
    # Final summary
    print("\n=== Summary ===")
    print(f"Folder: {folder['name']} (id: {folder['id']})")
    print(f"File: {file['name']} (id: {file['id']})")
    if args.dry_run:
        print("Note: No actual changes were made (--dry-run mode)")
        
    print("=== Command completed successfully ===")

if __name__ == "__main__":
    main()
