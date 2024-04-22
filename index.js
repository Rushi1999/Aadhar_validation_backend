'use strict';
require('dotenv').config();
const async = require('async');
const fs = require('fs');
const https = require('https');
const path = require("path");
const createReadStream = require('fs').createReadStream;
const sleep = require('util').promisify(setTimeout);
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;
const sqlite3 = require('sqlite3').verbose(); // Import SQLite3
const readline = require('readline');

/**
 * AUTHENTICATE
 * This single client is used for all examples.
 */
const key = process.env.VISION_KEY;
const endpoint = process.env.VISION_ENDPOINT;
const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }), endpoint);

/**
 * Connect to SQLite database and create 'ocr_data' table if it doesn't exist
 */
const db = new sqlite3.Database('ocr_data.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Create 'ocr_data' table if it doesn't exist
    db.run('CREATE TABLE IF NOT EXISTS ocr_data (id INTEGER PRIMARY KEY, text TEXT)', (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Table "ocr_data" created successfully.');
        // Call the initialize function to start OCR and database operations
        initialize();
      }
    });
  }
});

/**
 * Function to perform OCR and store data into the database
 */
async function performOCRAndStore() {
  try {
    const printedTextSampleURL = 'https://raw.githubusercontent.com/Azure-Samples/cognitive-services-sample-data-files/master/ComputerVision/Images/printed_text.jpg';

    console.log('Read printed text from URL...', printedTextSampleURL.split('/').pop());
    const printedResult = await readTextFromURL(computerVisionClient, printedTextSampleURL);
    storeTextInDatabase(printedResult);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Function to perform OCR on image URL
 */
async function readTextFromURL(client, url) {
  let result = await client.read(url);
  let operation = result.operationLocation.split('/').slice(-1)[0];
  
  while (result.status !== "succeeded") {
    await sleep(1000);
    result = await client.getReadResult(operation);
  }
  
  return result.analyzeResult.readResults;
}

/**
 * Function to store OCR text in the database
 */
function storeTextInDatabase(readResults) {
  for (const page in readResults) {
    const result = readResults[page];
    if (result.lines.length) {
      for (const line of result.lines) {
        const text = line.words.map(w => w.text).join(' ');
        // Insert the OCR text into the database
        db.run('INSERT INTO ocr_data (text) VALUES (?)', [text], (err) => {
          if (err) {
            console.error('Error inserting OCR text into database:', err);
          } else {
            console.log('OCR text inserted into database:', text);
          }
        });
      }
    }
  }
}

/**
 * Function to fetch data from the database
 */
function fetchDataFromDatabase(callback) {
  db.all('SELECT * FROM ocr_data', (err, rows) => {
    if (err) {
      console.error('Error fetching data from database:', err);
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

/**
 * Function to ask questions and handle user input
 */
function askQuestions() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Do you want to fetch OCR data from the database? (yes/no) ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
      fetchDataFromDatabase((err, data) => {
        if (err) {
          console.error('Error fetching data:', err);
        } else {
          console.log('OCR data fetched from the database:', data);
        }
        rl.close();
      });
    } else {
      console.log('No data fetched. Exiting...');
      rl.close();
    }
  });
}

/**
 * Initialize OCR and database operations
 */
function initialize() {
  async.series([
    async function () {
      await performOCRAndStore();
    }
  ], (err) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('OCR and database operations completed successfully.');
      // After OCR and database operations complete, ask questions
      askQuestions();
    }
  });
}
