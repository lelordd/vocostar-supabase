const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 8085;

// Increase limits for file uploads
const upload = multer({ 
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max for edge function deployments
});

const FUNCTIONS_DIR = process.env.EDGE_FUNCTIONS_DIR || '/app/functions';

// Basic healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Mocks the Supabase Cloud API for deploying edge functions.
 * Studio sends multipart/form-data with 'metadata' (JSON) and 'file' (the script).
 */
app.post('/v1/projects/:ref/functions/deploy', upload.array('file'), (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) {
      return res.status(400).json({ error: 'Missing slug query parameter' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const metadataStr = req.body.metadata;
    let metadata = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (e) {
        console.warn('Could not parse metadata JSON:', e.message);
      }
    }

    const functionDir = path.join(FUNCTIONS_DIR, slug);
    
    // Create function directory if it doesn't exist
    if (!fs.existsSync(functionDir)) {
      fs.mkdirSync(functionDir, { recursive: true });
    }

    // Save all uploaded files to the slug directory
    // Typically Studio sends 'index.ts' 
    req.files.forEach(file => {
      const filePath = path.join(functionDir, file.originalname);
      fs.writeFileSync(filePath, file.buffer);
      console.log(`Saved file: ${filePath}`);
    });

    // We must return the exact schema that Studio's EdgeFunctionsDeployData expects
    const responseData = {
      id: crypto.randomUUID(),
      slug: slug,
      name: slug,
      version: 1,
      status: 'ACTIVE',
      created_at: new Date().getTime(),
      updated_at: new Date().getTime(),
      entrypoint_path: metadata.entrypoint_path || 'file:///src/index.ts',
      import_map_path: metadata.import_map_path || null,
      verify_jwt: metadata.verify_jwt !== false
    };

    console.log(`Successfully deployed function: ${slug}`);
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Supabase Edge Functions Manager listening on port ${port}`);
  console.log(`Writing functions to: ${FUNCTIONS_DIR}`);
});
