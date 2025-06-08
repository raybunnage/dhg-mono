#!/usr/bin/env python3
import os
import re
from datetime import datetime

# Directory containing migration files
migrations_dir = "/Users/raybunnage/Documents/github/dhg-mono/supabase/migrations"

# Pattern to match CREATE TABLE statements
create_table_pattern = re.compile(
    r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.|backup\.)?([a-zA-Z_]+)',
    re.IGNORECASE
)

# Dictionary to store table name -> earliest date
table_dates = {}

# Process each migration file
for filename in sorted(os.listdir(migrations_dir)):
    if not filename.endswith('.sql') or '[timestamp]' in filename or filename.endswith('_down.sql'):
        continue
    
    # Extract date from filename (first 8 digits)
    date_match = re.match(r'^(\d{8})', filename)
    if not date_match:
        continue
    
    file_date = date_match.group(1)
    
    # Read file and look for CREATE TABLE statements
    filepath = os.path.join(migrations_dir, filename)
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        # Find all CREATE TABLE statements
        for match in create_table_pattern.finditer(content):
            table_name = match.group(1)
            
            # Skip if this looks like a comment or is inside a SELECT
            line_start = content.rfind('\n', 0, match.start()) + 1
            line = content[line_start:match.end()]
            if '--' in line[:match.start() - line_start] or 'SELECT' in content[match.end():match.end() + 20]:
                continue
            
            # Update table_dates with earliest occurrence
            if table_name not in table_dates or file_date < table_dates[table_name]:
                table_dates[table_name] = file_date

# Format output
print("Table Creation Dates from Migration Files:")
print("==========================================")
print(f"{'Table Name':<40} {'Creation Date':<12} {'Formatted Date'}")
print("-" * 80)

for table_name in sorted(table_dates.keys()):
    date_str = table_dates[table_name]
    formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    print(f"{table_name:<40} {date_str:<12} {formatted_date}")

# Generate SQL update statements
print("\n\nSQL Update Statements for sys_table_definitions:")
print("=================================================")
for table_name in sorted(table_dates.keys()):
    date_str = table_dates[table_name]
    formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    print(f"UPDATE sys_table_definitions SET created_in_migration = '{formatted_date}' WHERE table_name = '{table_name}';")