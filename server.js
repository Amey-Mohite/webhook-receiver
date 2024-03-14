require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');
const { BlobServiceClient } = require('@azure/storage-blob');


// const { DefaultAzureCredential } = require('@azure/identity');
// const { SecretClient } = require('@azure/keyvault-secrets');

// const keyVaultName = process.env.KEY_VAULT_NAME;
// const kvUri = `https://${keyVaultName}.vault.azure.net/`;
// const secretName = "APIKEY"; // The name you gave your secret
// const credential = new DefaultAzureCredential();
// const client = new SecretClient(kvUri, credential);
// let VALID_API_KEY; // Define VALID_API_KEY in a global scope

// async function getSecret() {
//   try {
//     const secret = await client.getSecret(secretName);
//     VALID_API_KEY = secret.value; // Set the value without redeclaring VALID_API_KEY
//     startServer(); // Start the server after the secret is retrieved
//   } catch (error) {
//     console.error('Error retrieving API key:', error);
//     process.exit(1); // Exit if we cannot retrieve the API key
//   }
// }


// // Function to start the Express server
// function startServer() {
//   const app = express();
//   const PORT = process.env.PORT || 3000;
//   // Applying middleware
//   app.use(helmet());
//   // app.use(bodyParser.json());
//   // app.use(bodyParser.json({ limit: '50mb' })); // Example: Set limit to 50 MB
//   app.use(bodyParser.json({ limit: 'Infinity' }));
//   // app.use(limiter);
//   // app.use(expressWinston.logger({
//   //     winstonInstance: logger,
//   //     msg: 'HTTP {{req.method}} {{req.url}}',
//   //     expressFormat: true,
//   //     colorize: false,
//   //   }));
//   // Middleware to check the API key
//   const apiKeyMiddleware = (req, res, next) => {
//     const apiKey = req.get('X-API-KEY');
//     if (!apiKey || apiKey !== VALID_API_KEY) {  
//       return res.status(401).json({error: 'Invalid or missing API key'});
//     }

//     next();
//   };

//    // Define routes
//   app.post('/openbanking', apiKeyMiddleware, (req, res) => {
//       console.log('Received open banking webhook:', req.body);
//       res.status(200).send('Webhook received!');
//   });

//   app.post('/loanapplication', apiKeyMiddleware, (req, res) => {
//       console.log('Received loan application webhook:', req.body);
//       res.status(200).send('Webhook received!');
//   });

//   app.post('/creditfile', apiKeyMiddleware, (req, res) => {
//       console.log('Received credit file webhook:', req.body);
//       res.status(200).send('Webhook received!');
//   });

//   app.post('/loanperformance', apiKeyMiddleware, (req, res) => {
//       console.log('Received loan performance webhook:', req.body);
//       res.status(200).send('Webhook received!');
//   });

//   // Error handling middleware
//   app.use((err, req, res, next) => {
//       console.error(err.stack);
//       res.status(500).send('Something broke!');
//   });

//   // Start the server
//   app.listen(PORT, () => {
//       console.log(`Server is running on port ${PORT}`);
//   });
  
// }

// getSecret();

VALID_API_KEY = process.env.APIKEY

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

// Custom Winston transport for Azure Blob Storage
class AzureBlobTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.containerName = opts.containerName;
    this.containerClient = blobServiceClient.getContainerClient(this.containerName);
  }

  async log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Ensure the container exists
    await this.containerClient.createIfNotExists();

    // Create a unique blob name for the log entry
    const blobName = `log-${Date.now()}.json`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    // Upload the log information
    try {
      await blockBlobClient.upload(JSON.stringify(info), Buffer.byteLength(JSON.stringify(info)));
    } catch (error) {
      console.error(`Error uploading log to Azure Blob Storage in container ${this.containerName}:`, error);
    }

    callback();
  }
}

// Logger configuration with Azure Blob Storage transport
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new AzureBlobTransport({ containerName: 'webhookslogs' }), // Specify your container name here
  ],
});



// Function to store data in Azure Blob Storage
const storeDataInAzureBlob = async (containerName, blobName, data) => {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.upload(JSON.stringify(data), Buffer.byteLength(JSON.stringify(data)));
    console.log(`Data successfully stored in ${containerName}/${blobName}`);
  } catch (error) {
    console.error('Error uploading to Azure Blob Storage:', error.message);
  }
};


const app = express();
  const PORT = process.env.PORT || 3000;
  // Applying middleware
  app.use(helmet());
  // app.use(bodyParser.json());
  // app.use(bodyParser.json({ limit: '50mb' })); // Example: Set limit to 50 MB
  app.use(bodyParser.json({ limit: 'Infinity' }));
  // app.use(limiter);
  app.use(expressWinston.logger({
      winstonInstance: logger,
      msg: 'HTTP {{req.method}} {{req.url}}',
      expressFormat: true,
      colorize: false,
    }));
  // Middleware to check the API key
  const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.get('X-API-KEY');
    if (!apiKey || apiKey !== VALID_API_KEY) {  
      return res.status(401).json({error: 'Invalid or missing API key'});
    }

    next();
  };

   // Define routes
  app.post('/openbanking', apiKeyMiddleware, (req, res) => {
      const jsonData = req.body;
      const containerName = 'data';
      const blobName = `example-blob-${Date.now()}.json`;
      storeDataInAzureBlob(containerName, blobName, jsonData);
      res.status(200).send('Webhook received!');
  });

  app.post('/loanapplication', apiKeyMiddleware, (req, res) => {
      console.log('Received loan application webhook:', req.body);
      res.status(200).send('Webhook received!');
  });

  app.post('/creditfile', apiKeyMiddleware, (req, res) => {
      console.log('Received credit file webhook:', req.body);
      res.status(200).send('Webhook received!');
  });

  app.post('/loanperformance', apiKeyMiddleware, (req, res) => {
      console.log('Received loan performance webhook:', req.body);
      res.status(200).send('Webhook received!');
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).send('Something broke!');
  });

  // Start the server
  app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
  });
