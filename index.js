'use strict';
require('dotenv').config();
const async = require('async');
const fs = require('fs');
const https = require('https');
const path = require("path");
const createReadStream = require('fs').createReadStream
const sleep = require('util').promisify(setTimeout);
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;

/**
 * AUTHENTICATE
 * This single client is used for all examples.
 */
const key = process.env.VISION_KEY;
const endpoint = process.env.VISION_ENDPOINT;

const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }), endpoint);
/**
 * END - Authenticate
 */

async function computerVision() {
  try {
    console.log('-------------------------------------------------');
    console.log('READ PRINTED, HANDWRITTEN TEXT AND PDF');
    console.log();

    // Local file path containing printed and/or handwritten text.
  //   const localImagePath = 'C:\\Users\\AMNIBE\\Downloads\\Bold-3D-Text-Effect-full.jpg';
    const localImagePath = 'C:\\Users\\AMNIBE\\Downloads\\Bold-3D-Text-Effect-full.pdf';
   // const localImagePath = 'C:/Users/AMNIBE/Downloads/Important+Instructions.docx';

    // Recognize text in the local image
    console.log('Read printed text from local file...');
    const printedResult = await readTextFromFile(computerVisionClient, localImagePath);
    printRecText(printedResult);

    // Function to read text from a local file
    async function readTextFromFile(client, filePath) {
      try {
        // Read the file content
        const imageData = fs.readFileSync(filePath);

        // Call the API to recognize text in the image data
        let result = await client.readInStream(imageData);

        // Operation ID is last path segment of operationLocation (a URL)
        let operation = result.operationLocation.split('/').slice(-1)[0];

        // Wait for read recognition to complete
        while (result.status !== "succeeded") {
          await sleep(1000);
          result = await client.getReadResult(operation);
        }
        return result.analyzeResult.readResults; // Return the first page of result. Replace [0] with the desired page if this is a multi-page file such as .pdf or .tiff.
      } catch (error) {
        console.error('Error reading file or calling the API:', error);
        throw error; // Rethrow the error to be caught by the caller
      }
    }

    // Function to print recognized text
    function printRecText(readResults) {
      console.log('Recognized text:');
      for (const page in readResults) {
        if (readResults.length > 1) {
          console.log(`==== Page: ${page}`);
        }
        const result = readResults[page];
        if (result.lines.length) {
          for (const line of result.lines) {
            console.log(line.words.map(w => w.text).join(' '));
          }
        } else {
          console.log('No recognized text.');
        }
      }
    }

    console.log();
    console.log('-------------------------------------------------');
    console.log('End of quickstart.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

computerVision();
