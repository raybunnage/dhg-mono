# Shell Scripting Basics

## Key Concepts for Reviewing Scripts

### 1. Basic Script Structure
```bash
#!/bin/bash              # Tells system to use bash interpreter
set -e                   # Exit on any error (safety feature)

# Functions go at top
my_function() {
  local var=$1          # $1 means first argument
  echo "$var"           # Print the value
}

# Main script logic below
if [ -z "$1" ]; then    # Check if first argument is empty
  echo "Error"
  exit 1                # Exit with error code
fi
```

### 2. Common Safety Features
```bash
set -e        # Exit on error
set -u        # Error on undefined variables
set -o pipefail # Catch pipe errors
```

### 3. Variable Usage
```bash
# Good practices
local var="value"    # Local to function
name=$1             # First argument
timestamp=$(date)   # Command substitution
"$variable"         # Proper variable quoting

# Bad practices
var=value           # No quotes
$variable           # No quotes
```

### 4. Common Commands
```bash
echo "message"      # Print to console
ls -la             # List files
grep "pattern"     # Search for text
cat file           # Print file contents
rm file           # Remove file
```

### 5. File Operations
```bash
# Check if file exists
if [ -f "file.txt" ]; then
  echo "File exists"
fi

# Create file with content
cat > "file.txt" << EOF
content
goes
here
EOF
```

### 6. Error Handling
```bash
# Check command success
if ! some_command; then
  echo "Error: Command failed"
  exit 1
fi

# Capture error output
if ! error=$(some_command 2>&1); then
  echo "Error: $error"
  exit 1
fi
```

### 7. What to Look For When Reviewing
1. **Safety Checks**
   - Does it check arguments?
   - Does it handle errors?
   - Are variables quoted?
   - Does it expose secrets?

2. **Security Concerns**
    - Never commit sensitive data
    - Add sensitive files to .gitignore
    - Use environment variables for secrets
    - Check for accidental secret exposure
    - Include sensitive files in backup scripts
    - Verify backup locations are secure
    - Use .gitignore before initial commit

    Verifying File Removal:
    ```bash
    # Complete git security check
    git status                    # Check current state
    git ls-files --cached file    # Check if tracked
    git log --all -- "**/file"    # Check all history
    git grep -l "content"         # Check all content
    ```

### 8. Common Gotchas
```bash
# WRONG: Unquoted variables
file=$1
rm $file           # Dangerous if $file has spaces

# RIGHT: Quoted variables
file="$1"
rm "$file"         # Safe with spaces

# WRONG: Not checking commands
rm file
next_command       # Runs even if rm failed

# RIGHT: Checking commands
rm file || exit 1
next_command       # Only runs if rm succeeded
```

### 9. Testing Scripts
```bash
# Test with -x flag for debugging
bash -x ./script.sh

# Test with echo before destructive commands
# echo rm file     # Comment out echo after testing
rm file
```

### 10. Documentation in Scripts
```bash
#!/bin/bash
# Purpose: Brief description
# Usage: ./script.sh <arg1> <arg2>
# Example: ./script.sh input.txt output.txt

# Function documentation
# Args:
#   $1: description of first arg
#   $2: description of second arg
# Returns:
#   0 on success, 1 on error
my_function() {
  # ...
}
```

## Real-World Example
Here's our migration script broken down:

```bash
# 1. Safety setup
#!/bin/bash
set -e

# 2. Function definition with local variables
check_duplicates() {
  local pattern=$1
  local count=$(ls supabase/migrations/*.sql 2>/dev/null | grep -c "$pattern")
  if [ "$count" -gt 0 ]; then
    echo "Error: Found duplicates"
    exit 1
  fi
}

# 3. Argument checking
if [ -z "$1" ]; then
  echo "Error: Name required"
  exit 1
fi

# 4. Main logic with error checking
timestamp=$(date -u +%Y%m%d%H%M%S)
check_duplicates "$timestamp"

# 5. File creation with heredoc
cat > "$down_file" << EOF
-- Migration content
EOF
```

## Best Practices Checklist
- [ ] Has shebang line (`#!/bin/bash`)
- [ ] Uses `set -e` for safety
- [ ] Checks all arguments
- [ ] Uses local variables in functions
- [ ] Quotes all variables
- [ ] Has clear error messages
- [ ] Includes usage documentation
- [ ] Verifies operations succeeded
- [ ] Cleans up temporary files
- [ ] Has consistent formatting 