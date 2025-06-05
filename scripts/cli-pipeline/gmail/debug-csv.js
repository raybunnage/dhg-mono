#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

const csvPath = '/Users/raybunnage/Documents/github/dhg-mono/file_types/csv/imported_sqllite/urls.csv';

// Read first few lines manually
const fileStream = fs.createReadStream(csvPath);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let lineCount = 0;
let headers = [];

rl.on('line', (line) => {
  lineCount++;
  if (lineCount === 1) {
    headers = line.split(',');
    console.log('Headers:', headers);
    console.log('Number of headers:', headers.length);
  } else if (lineCount === 2) {
    const values = line.split(',');
    console.log('\nFirst data row:');
    console.log('Number of values:', values.length);
    headers.forEach((header, index) => {
      console.log(`${index}: ${header} = "${values[index]}"`);
    });
    rl.close();
  }
});