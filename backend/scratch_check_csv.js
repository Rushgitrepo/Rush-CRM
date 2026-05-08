const fs = require('fs');
const csv = require('csv-parser');

const results = [];
fs.createReadStream('d:/Development/Rush-CRM/Instantly Responses Sheet (1).csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    console.log('Total Records:', results.length);
    // Print first and last record to verify
    if (results.length > 0) {
      console.log('First Record Sr No:', results[0]['Sr No']);
      console.log('Last Record Sr No:', results[results.length - 1]['Sr No']);
    }
  });
