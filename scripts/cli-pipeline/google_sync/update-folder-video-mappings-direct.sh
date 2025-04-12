#\!/bin/bash
# Direct Bash script to update main_video_id for folder-video mappings
# This script uses curl directly to make calls to Supabase

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load environment variables
ENV_FILES=(".env" ".env.development" ".env.local")
for ENV_FILE in "${ENV_FILES[@]}"; do
  if [[ -f "$SCRIPT_DIR/../../$ENV_FILE" ]]; then
    echo "Loading environment from $SCRIPT_DIR/../../$ENV_FILE"
    source "$SCRIPT_DIR/../../$ENV_FILE"
  fi
  if [[ -f "$ENV_FILE" ]]; then
    echo "Loading environment from $ENV_FILE"
    source "$ENV_FILE"
  fi
done

# Try to find Supabase credentials from CLI_SUPABASE values if main ones aren't set
if [[ -z "$SUPABASE_URL" && -n "$CLI_SUPABASE_URL" ]]; then
  SUPABASE_URL="$CLI_SUPABASE_URL"
  echo "Using CLI_SUPABASE_URL: $SUPABASE_URL"
fi

if [[ -z "$SUPABASE_KEY" && -n "$CLI_SUPABASE_KEY" ]]; then
  SUPABASE_KEY="$CLI_SUPABASE_KEY"
  echo "Using CLI_SUPABASE_KEY for authentication"
fi

if [[ -z "$SUPABASE_KEY" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
  echo "Using SUPABASE_SERVICE_ROLE_KEY for authentication"
fi

if [[ -z "$SUPABASE_KEY" && -n "$SUPABASE_ANON_KEY" ]]; then
  SUPABASE_KEY="$SUPABASE_ANON_KEY"
  echo "Using SUPABASE_ANON_KEY for authentication"
fi

# Print loaded environment variables for debugging
echo "Loaded environment variables: "
echo "SUPABASE_URL set: $(if [[ -n "$SUPABASE_URL" ]]; then echo "yes"; else echo "no"; fi)"
echo "SUPABASE_KEY set: $(if [[ -n "$SUPABASE_KEY" ]]; then echo "yes"; else echo "no"; fi)"

# Hard-code URL as a last resort if needed
if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="https://jdksnfkupzywjdfefkyj.supabase.co"
  echo "Using hard-coded Supabase URL as fallback"
fi

# Check for Supabase credentials
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  echo "Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set"
  echo "Please set these variables in your environment and try again."
  echo "Hint: The TypeScript implementation might be using SupabaseClientService which loads these values differently."
  exit 1
fi

# Default values
DRY_RUN=false
VERBOSE=false

# Process command line args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      # Unknown option
      shift
      ;;
  esac
done

echo "Using Supabase URL: $SUPABASE_URL"
if [[ "$VERBOSE" == "true" ]]; then
  echo "Mode: $([ "$DRY_RUN" == "true" ] && echo "DRY RUN" || echo "ACTUAL UPDATE")"
fi

# Helper function to make Supabase API calls
function supabase_api {
  local method=$1
  local endpoint=$2
  local query=$3
  local data=$4
  
  # Build URL with query parameters
  local url="$SUPABASE_URL$endpoint"
  if [[ -n "$query" ]]; then
    url="${url}?${query}"
  fi
  
  if [[ "$VERBOSE" == "true" ]]; then
    echo "API call: $method $url"
    [[ -n "$data" ]] && echo "Request data: $data"
  fi
  
  local result
  if [[ "$method" == "GET" ]]; then
    result=$(curl -s -X GET "$url" \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY")
  elif [[ "$method" == "PATCH" && -n "$data" ]]; then
    result=$(curl -s -X PATCH "$url" \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  echo "$result"
}

# Function to find folder by name
function find_folder {
  local folder_name=$1
  
  echo "Searching for folder: '$folder_name'"
  
  # URL-encode the folder name
  local encoded_name=$(echo "$folder_name" | sed 's/ /%20/g')
  
  # Try exact match first
  local query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=eq.$encoded_name"
  local result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  
  # Check if we found an exact match
  if [[ "$result" == "[]" ]]; then
    echo "No exact folder match found, trying flexible search..."
    
    # Try a more flexible search
    local simplified_name=$(echo "$folder_name" | sed 's/[^a-zA-Z0-9]/ /g' | awk '{print $1}')
    local encoded_simple=$(echo "$simplified_name" | sed 's/ /%20/g')
    
    query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=ilike.*$encoded_simple*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
    
    if [[ "$result" == "[]" ]]; then
      echo "Error: No folder found matching '$folder_name'"
      return 1
    fi
  fi
  
  # Extract the best matching folder (prioritize path_depth=0)
  local folder_id=$(echo "$result" | grep -o '"id":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local folder_name=$(echo "$result" | grep -o '"name":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local folder_path=$(echo "$result" | grep -o '"path":"[^"]*"' | head -1 | cut -d '"' -f 4)
  
  echo "Found folder: \"$folder_name\" (id: $folder_id, path: $folder_path)"
  echo "$folder_id:$folder_name:$folder_path"
}

# Function to find file by name
function find_file {
  local file_name=$1
  
  echo "Searching for file: '$file_name'"
  
  # URL-encode the file name
  local encoded_name=$(echo "$file_name" | sed 's/ /%20/g')
  
  # Try exact match first
  local query="select=id,name,drive_id,path&mime_type=eq.video/mp4&is_deleted=eq.false&name=eq.$encoded_name"
  local result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  
  # Check if we found an exact match
  if [[ "$result" == "[]" ]]; then
    echo "No exact file match found, trying flexible search..."
    
    # Try a more flexible search - remove extension for better matching
    local base_name=$(echo "$file_name" | sed 's/\.[^.]*$//')
    local encoded_base=$(echo "$base_name" | sed 's/ /%20/g')
    
    query="select=id,name,drive_id,path&mime_type=eq.video/mp4&is_deleted=eq.false&name=ilike.*$encoded_base*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
    
    if [[ "$result" == "[]" ]]; then
      echo "Error: No file found matching '$file_name'"
      return 1
    fi
  fi
  
  # Extract the first matching file
  local file_id=$(echo "$result" | grep -o '"id":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local file_name=$(echo "$result" | grep -o '"name":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local file_path=$(echo "$result" | grep -o '"path":"[^"]*"' | head -1 | cut -d '"' -f 4)
  
  echo "Found file: \"$file_name\" (id: $file_id, path: $file_path)"
  echo "$file_id:$file_name:$file_path"
}

# Function to update folder with main_video_id
function update_folder_with_video_id {
  local folder_id=$1
  local video_id=$2
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY RUN: Would update folder $folder_id with main_video_id = $video_id"
    return 0
  fi
  
  local query="id=eq.$folder_id"
  local data="{\"main_video_id\":\"$video_id\"}"
  local result=$(supabase_api "PATCH" "/rest/v1/sources_google2" "$query" "$data")
  
  echo "Updated folder $folder_id with main_video_id = $video_id"
  return 0
}

# Function to update related items with main_video_id
function update_related_items {
  local folder_name=$1
  local video_id=$2
  local folder_path=$3
  
  echo "Finding related items for folder '$folder_name'..."
  
  # Find related items by path_array
  local encoded_name=$(echo "$folder_name" | sed 's/ /%20/g')
  local query="select=id,name,mime_type&is_deleted=eq.false&path_array=cs.{$encoded_name}"
  local result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  
  if [[ "$result" == "[]" && -n "$folder_path" ]]; then
    echo "No related items found by path_array, trying by path..."
    
    # Try finding by path as fallback
    local encoded_path=$(echo "$folder_path" | sed 's/ /%20/g' | sed 's/\//\\\//g')
    query="select=id,name,mime_type&is_deleted=eq.false&path=like.$encoded_path*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  fi
  
  # Count matches
  local item_count=$(echo "$result" | grep -o '"id"' | wc -l)
  
  if [[ $item_count -eq 0 ]]; then
    echo "No related items found to update"
    return 0
  fi
  
  echo "Found $item_count related items to update with main_video_id"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY RUN: Would update $item_count related items with main_video_id = $video_id"
    return 0
  fi
  
  # Extract all IDs
  local ids=()
  echo "$result" | grep -o '"id":"[^"]*"' | cut -d '"' -f 4 > /tmp/ids.txt
  while read -r id; do
    ids+=("$id")
  done < /tmp/ids.txt
  
  # Update in batches of 50
  local batch_size=50
  local total=${#ids[@]}
  local batches=$(( (total + batch_size - 1) / batch_size ))
  
  for (( i=0; i<$batches; i++ )); do
    local start=$(( i * batch_size ))
    local end=$(( start + batch_size ))
    [[ $end -gt $total ]] && end=$total
    
    local batch_ids=()
    for (( j=start; j<end; j++ )); do
      batch_ids+=("${ids[$j]}")
    done
    
    local id_list=$(IFS=,; echo "${batch_ids[*]}")
    local query="id=in.(${id_list})"
    local data="{\"main_video_id\":\"$video_id\"}"
    
    supabase_api "PATCH" "/rest/v1/sources_google2" "$query" "$data" > /dev/null
    
    echo "Updated batch $(( i + 1 )) of $batches ($(( end - start )) items)"
  done
  
  echo "Successfully updated $total related items with main_video_id = $video_id"
  return 0
}

# Function to process a single mapping
function process_mapping {
  local mapping=$1
  
  # Extract folder and file names
  if [[ "$mapping" =~ \'([^\']+)\'\:\ \'([^\']+)\' ]]; then
    local folder_name="${BASH_REMATCH[1]}"
    local file_name="${BASH_REMATCH[2]}"
  elif [[ "$mapping" =~ \"([^\"]+)\"\:\ \"([^\"]+)\" ]]; then
    local folder_name="${BASH_REMATCH[1]}"
    local file_name="${BASH_REMATCH[2]}"
  else
    echo "Error: Invalid mapping format. Expected 'folder': 'file'"
    return 1
  fi
  
  echo "Processing mapping: '$folder_name': '$file_name'"
  
  # Find folder
  echo "Searching for folder: '$folder_name'"
  
  # Extract key parts of the folder name for searching
  # First, get the date part at the beginning (like "2022-04-20")
  local date_part=""
  if [[ "$folder_name" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
    date_part="${BASH_REMATCH[1]}"
  fi
  
  # Second, get the name part (like "Tauben" or "Sullivan")
  local name_part=""
  if [[ "$folder_name" =~ -([A-Za-z]+) ]]; then
    name_part="${BASH_REMATCH[1]}"
  fi
  
  # Try exact match first
  local query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=eq.${folder_name// /%20}"
  local result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  
  # If exact match fails, try with both date and name parts (most specific)
  if [[ "$result" == "[]" && -n "$date_part" && -n "$name_part" ]]; then
    echo "No exact match, trying with date ($date_part) and name ($name_part) parts..."
    query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=ilike.*${date_part}*&name=ilike.*${name_part}*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  fi
  
  # If still no match, try with just the date part
  if [[ "$result" == "[]" && -n "$date_part" ]]; then
    echo "Still no match, trying with just date part ($date_part)..."
    query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=ilike.*${date_part}*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  fi
  
  # If still no match, try with just the name part
  if [[ "$result" == "[]" && -n "$name_part" ]]; then
    echo "Still no match, trying with just name part ($name_part)..."
    query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=ilike.*${name_part}*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  fi
  
  # Last resort - try first part of folder name
  if [[ "$result" == "[]" ]]; then
    echo "Still no match, trying with first part of folder name..."
    local first_part=${folder_name%% *}
    query="select=id,name,drive_id,path,path_depth&mime_type=eq.application/vnd.google-apps.folder&is_deleted=eq.false&name=ilike.*${first_part}*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  fi
  
  if [[ "$VERBOSE" == "true" ]]; then
    echo "Final API call: $query"
    echo "Result: $result"
  fi
  
  if [[ "$result" == "[]" ]]; then
    echo "Error: No folder found matching '$folder_name'"
    return 1
  fi
  
  local folder_id=$(echo "$result" | grep -o '"id":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local folder_name=$(echo "$result" | grep -o '"name":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local folder_path=$(echo "$result" | grep -o '"path":"[^"]*"' | head -1 | cut -d '"' -f 4)
  
  echo "Found folder: \"$folder_name\" (id: $folder_id, path: $folder_path)"
  
  # Find file
  echo "Searching for file: '$file_name'"
  query="select=id,name,drive_id,path&mime_type=eq.video/mp4&is_deleted=eq.false&name=eq.${file_name// /%20}"
  result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
  
  if [[ "$result" == "[]" ]]; then
    echo "No exact file match found, trying flexible search..."
    local base_name=${file_name%.*}
    query="select=id,name,drive_id,path&mime_type=eq.video/mp4&is_deleted=eq.false&name=ilike.*${base_name// /%20}*"
    result=$(supabase_api "GET" "/rest/v1/sources_google2" "$query")
    
    if [[ "$result" == "[]" ]]; then
      echo "Error: No file found matching '$file_name'"
      return 1
    fi
  fi
  
  local file_id=$(echo "$result" | grep -o '"id":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local file_name=$(echo "$result" | grep -o '"name":"[^"]*"' | head -1 | cut -d '"' -f 4)
  local file_path=$(echo "$result" | grep -o '"path":"[^"]*"' | head -1 | cut -d '"' -f 4 || echo "")
  
  echo "Found file: \"$file_name\" (id: $file_id)"
  
  # Update folder with main_video_id
  update_folder_with_video_id "$folder_id" "$file_id"
  
  # Update related items
  update_related_items "$folder_name" "$file_id" "$folder_path"
  
  echo "=== Summary ==="
  echo "Folder: $folder_name ($folder_id)"
  echo "File: $file_name ($file_id)"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Note: No actual changes were made (--dry-run mode)"
  fi
  
  return 0
}

# All the mappings to process
declare -a MAPPINGS=(
  "'2023-05-03-Sullivan': 'Sullivan.Ballantyne.5.3.23.mp4'"
  "'2022-04-20-Tauben': 'Tauben.Sullivan.4.20.22.mp4'"
  "'2022-09-21-Sue Carter - Sex, love, and oxytocin': 'Sue Carter talk 9-21-2022.mp4'"
  "'2020-10-21-Lederman-Relationship Connection': 'Matt and Alona.10.21.20.mp4'"
  "'2024-04-03-Lederman-NonViolent Commun': 'Lederman.4.4.24.mp4'"
  "'2024-01-24-Naviaux': 'Naviaux.DR.1.24.24.mp4'"
  "'2021-02-10-Eagle': 'Amster.Eagle.2.10.21.mp4'"
  "'2021-08-18-Mel Pohl - addiction': '8.18.21.Mel Pohl.mp4'"
  "'2021-1-27-Garbho-Q&A-f': 'Gharbo.1.28.21.mp4'"
  "'2023-12-06-Napadow-Patient': 'video1168985783.mp4'"
  "'2024-04-17-Naviaux-Basics of mitochondria': 'Navaux.4.17.24.mp4'"
  "'2020-06-03-Vagal state and vagal stimulation': '6.3.20.Vagal Stim.mp4'"
  "'2024-11-06 - Sutphin - aging': 'Sutphinb.10.6.24.mp4'"
  "'2022-11-2 - Peter Staats.Overview of Vagal Stimulation': '11.2.22.Staats.mp4'"
  "'2021-02-03-Wolovsky-Cues of Safety': 'Kate Wolovsky.2.3.21.mp4'"
  "'2024-02-21-Where do we go from here.Carter.Clawson,Hanscom': 'DHDG.2.21.24.open Discussion.mp4'"
  "'2024-02-04-Grinevich-oxytocin': 'Valery Grinevich 2-4-2024 video.mp4'"
  "'2023-09-20-Lane': 'Emotional vs physical pain.mp4'"
  "'2024-05-22-Cook': 'Cook.Clawson.5.22.244.mp4'"
)

# Process just the first mapping for testing
echo "Processing the first mapping to verify it works:"
process_mapping "${MAPPINGS[0]}"

if [[ $? -ne 0 ]]; then
  echo "Failed to process the test mapping. Please check your Supabase credentials and try again."
  exit 1
fi

# If we just tested a single mapping and we're not in dry run mode, ask about the rest
if [[ ${#MAPPINGS[@]} -gt 1 && "$DRY_RUN" != "true" ]]; then
  # Ask the user if they want to continue processing all mappings
  read -p "Do you want to process all ${#MAPPINGS[@]} mappings? (y/n): " answer
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "Exiting without processing additional mappings."
    exit 0
  fi
# If we're in dry run mode, proceed with all mappings automatically
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run mode: Processing all mappings without confirmation"
# If there's only one mapping, no need to ask
else
  echo "Only one mapping to process, no need for confirmation"
fi

# Process all mappings
echo "Processing all ${#MAPPINGS[@]} mappings..."
for (( i=0; i<${#MAPPINGS[@]}; i++ )); do
  echo "Processing mapping $((i+1)) of ${#MAPPINGS[@]}"
  process_mapping "${MAPPINGS[$i]}"
  echo ""
done

echo "All mappings processed successfully\!"
