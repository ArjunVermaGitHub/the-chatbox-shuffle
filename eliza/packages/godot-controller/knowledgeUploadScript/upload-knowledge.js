import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getAllMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllMarkdownFiles(filePath));
    } else if (filePath.endsWith('.md')) {
      results.push(filePath);
    }
  });
  return results;
}

async function uploadKnowledgeToAgent(agentId, filePaths) {
  const formData = new FormData();

  filePaths.forEach((filePath) => {
    formData.append('files', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
    });
  });

  try {
    const response = await axios({
      method: 'post',
      url: `http://localhost:3000/api/agents/${agentId}/memories/upload-knowledge`,
      data: formData,
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log('Upload successful!');
    console.log('response.data', response.data);
    console.log('Uploaded files:', response.data.data);
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  const agentId = '09f35a8a-de4b-0105-9925-c6db4fc04626';
  const knowledgeDir = path.join(__dirname, '../knowledge');
  const filesToUpload = getAllMarkdownFiles(knowledgeDir);

  console.log(`Found ${filesToUpload.length} Markdown files to upload.`);

  try {
    const result = await uploadKnowledgeToAgent(agentId, filesToUpload);

    result.data.forEach((file) => {
      console.log(`\nFile: ${file.filename}`);
      console.log(`ID: ${file.id}`);
      console.log(`Size: ${file.size} bytes`);
      console.log(`Preview: ${file.preview}`);
      console.log(`Uploaded at: ${new Date(file.uploadedAt).toLocaleString()}`);
    });
  } catch (error) {
    console.error('Failed to upload knowledge:', error);
  }
}

main();
