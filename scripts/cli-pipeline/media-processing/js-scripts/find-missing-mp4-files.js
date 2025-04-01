const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get a list of all mp4 files in file_types/mp4 directory
console.log("Getting list of mp4 files from file_types/mp4 directory...");
const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
const localFiles = fs.readdirSync(mp4Dir)
  .filter(file => file.endsWith('.mp4'))
  .map(file => file.toLowerCase());

console.log(`Found ${localFiles.length} mp4 files locally.`);

// Get a list of mp4 files from the sources_google.json file (if it exists)
// This is a placeholder assuming there's a sources_google.json file with mp4 info
// If such a file doesn't exist, this section would need to be modified
let dbFiles = [];
try {
  const sourcesPath = path.join(process.cwd(), 'file_types', 'txt', 'sources_google_lionya.json');
  if (fs.existsSync(sourcesPath)) {
    console.log("Found sources_google_lionya.json, parsing mp4 files...");
    const sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    
    // Assuming the file has a structure with an array of items with a 'name' field
    // Modify this extraction based on the actual structure of your JSON file
    dbFiles = sourcesData
      .filter(item => item.name && item.name.toLowerCase().endsWith('.mp4'))
      .map(item => item.name.toLowerCase());
    
    console.log(`Found ${dbFiles.length} mp4 files in sources_google_lionya.json.`);
  } else {
    console.log("sources_google_lionya.json not found.");
    // Try other potential sources
    console.log("Checking for other potential sources...");
  }
} catch (error) {
  console.error("Error reading sources:", error.message);
}

// If we couldn't find any mp4 references in the DB, try using grep to search for mp4 patterns
if (dbFiles.length === 0) {
  console.log("Attempting to find mp4 references in project files...");
  try {
    const grepResults = execSync('grep -r "\\.mp4" --include="*.json" --include="*.ts" --include="*.js" .', { encoding: 'utf8' });
    const mp4Matches = grepResults.match(/["''][^"'']*\.mp4["'']/g);
    if (mp4Matches) {
      dbFiles = [...new Set(mp4Matches.map(match => {
        // Extract filename from the match
        const filename = match.replace(/["'']/g, '').split('/').pop();
        return filename.toLowerCase();
      }))];
      console.log(`Found ${dbFiles.length} unique mp4 references in project files.`);
    }
  } catch (error) {
    console.log("No mp4 references found via grep.");
  }
}

// Find files that are in the db list but missing locally
const missingFiles = dbFiles.filter(file => !localFiles.includes(file));

// Output results
console.log("\nMP4 files referenced but missing in file_types/mp4:");
if (missingFiles.length > 0) {
  missingFiles.forEach(file => console.log(file));
  console.log(`\nTotal missing files: ${missingFiles.length}`);
} else {
  console.log("No missing files found!");
}

// Find files that are local but not in the database (might be unused)
const extraFiles = localFiles.filter(file => !dbFiles.includes(file));
console.log("\nMP4 files in file_types/mp4 but not referenced elsewhere:");
if (extraFiles.length > 0) {
  extraFiles.forEach(file => console.log(file));
  console.log(`\nTotal extra files: ${extraFiles.length}`);
} else {
  console.log("No extra files found!");
}
