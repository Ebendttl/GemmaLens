/**
 * GemmaLens - Main Application Logic
 * Integrates with Google AI Studio via REST API
 */

// DOM Elements
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const dropzone = document.getElementById('dropzone');
const fileUpload = document.getElementById('file-upload');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const promptInput = document.getElementById('prompt-input');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = document.querySelector('.btn-text');
const btnLoader = document.getElementById('btn-loader');
const modelStatus = document.getElementById('model-status');
const outputContent = document.getElementById('output-content');

// State
let base64Image = null;
let mimeType = null;
const MODEL_NAME = 'gemini-1.5-pro'; // Using 1.5-pro as substitute for Gemma 4 31B Dense in this demo

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('gemma_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }
});

// Save API Key
saveKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    localStorage.setItem('gemma_api_key', key);
    saveKeyBtn.textContent = 'Saved!';
    setTimeout(() => { saveKeyBtn.textContent = 'Save'; }, 2000);
  }
});

// Drag & Drop Handling
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
});

dropzone.addEventListener('drop', handleDrop, false);
dropzone.addEventListener('click', () => fileUpload.click());
fileUpload.addEventListener('change', (e) => handleFiles(e.target.files));

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, WEBP).');
    return;
  }

  mimeType = file.type;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    // Extract base64 part
    const dataUrl = e.target.result;
    base64Image = dataUrl.split(',')[1];
    
    // Show Preview
    imagePreview.src = dataUrl;
    dropzone.style.display = 'none';
    previewContainer.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// Remove Image
removeImageBtn.addEventListener('click', () => {
  base64Image = null;
  mimeType = null;
  imagePreview.src = '';
  previewContainer.style.display = 'none';
  dropzone.style.display = 'block';
  fileUpload.value = '';
});

// Analysis Execution
analyzeBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  const apiKey = localStorage.getItem('gemma_api_key');

  if (!apiKey) {
    alert('Please enter and save your Google AI Studio API Key first.');
    apiKeyInput.focus();
    return;
  }

  if (!prompt && !base64Image) {
    alert('Please provide an image or a prompt.');
    return;
  }

  setLoadingState(true);
  
  try {
    const result = await callGeminiAPI(apiKey, prompt, base64Image, mimeType);
    renderOutput(result);
  } catch (error) {
    renderError(error.message);
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  if (isLoading) {
    analyzeBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    modelStatus.textContent = 'Reasoning...';
    modelStatus.classList.add('active');
    outputContent.innerHTML = `
      <div class="empty-state">
        <div class="loader" style="display: block; width: 40px; height: 40px; border-width: 3px; border-left-color: var(--accent-primary); margin-bottom: 1rem;"></div>
        <p>Analyzing 128K Context Window...</p>
      </div>
    `;
  } else {
    analyzeBtn.disabled = false;
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
    modelStatus.textContent = 'Idle';
    modelStatus.classList.remove('active');
  }
}

async function callGeminiAPI(apiKey, promptText, base64Img, imgMimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
  
  const contents = [];
  const parts = [];

  if (promptText) {
    parts.push({ text: promptText });
  }

  if (base64Img) {
    parts.push({
      inline_data: {
        mime_type: imgMimeType,
        data: base64Img
      }
    });
  }

  contents.push({ parts });

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || 'Failed to communicate with API');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

function renderOutput(markdownText) {
  // Use marked and dompurify safely
  const rawHtml = marked.parse(markdownText);
  const cleanHtml = DOMPurify.sanitize(rawHtml);
  
  outputContent.innerHTML = `<div class="markdown-body">${cleanHtml}</div>`;
}

function renderError(message) {
  outputContent.innerHTML = `
    <div style="color: #ff6b6b; background: rgba(255,107,107,0.1); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(255,107,107,0.3);">
      <h3 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        Analysis Failed
      </h3>
      <p style="font-family: var(--font-mono); font-size: 0.9rem;">${message}</p>
    </div>
  `;
}
