import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'
import { imageRoutes } from './handlers/image'
import { videoRoutes } from './handlers/video'
import { promptRoutes } from './handlers/prompt'
import { downloadRoutes } from './handlers/download'
import { mediaRoutes } from './handlers/media'
import type { Env } from './types/env'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

app.get('/', async (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>aidobe - TikTok AI Image Generator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card-shadow {
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .model-controls {
            display: none;
        }
        .model-controls.active {
            display: block;
        }
        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }
        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-content {
            max-width: 95vw;
            max-height: 95vh;
            position: relative;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
        }
        .modal-image-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            padding: 20px;
            min-height: 300px;
        }
        .modal img {
            max-width: 100%;
            max-height: 60vh;
            width: auto;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .modal-metadata {
            padding: 24px;
            background: white;
            border-top: 2px solid #e5e7eb;
            max-height: 300px;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .modal-close {
            position: absolute;
            top: -40px;
            right: 0;
            color: white;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            background: rgba(0,0,0,0.5);
            border-radius: 50%;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-close:hover {
            background: rgba(0,0,0,0.8);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <!-- Header -->
        <div class="text-center mb-8 relative">
            <div class="absolute top-0 right-0">
                <button id="settingsBtn" class="text-gray-500 hover:text-gray-700 transition-colors" title="Settings">
                    ⚙️
                </button>
            </div>
            <h1 class="text-4xl font-bold gradient-bg bg-clip-text text-transparent mb-2">aidobe</h1>
            <p class="text-gray-600">AI-Powered Multimodal Generation</p>
        </div>

        <!-- Main Generation Interface -->
        <div class="bg-white rounded-lg card-shadow p-6 mb-8">
            <form id="generateForm" class="space-y-6">
                <!-- Prompt Input -->
                <div>
                    <label for="prompt" class="block text-sm font-medium text-gray-700 mb-2">
                        Prompt <span class="text-red-500">*</span>
                    </label>
                    <textarea 
                        id="prompt" 
                        name="prompt" 
                        rows="3" 
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="A trendy coffee shop with plants, vertical format for TikTok"
                        required
                    ></textarea>
                    <div class="text-xs text-gray-500 mt-1">
                        <span id="charCount">0</span>/4000 characters
                    </div>
                </div>

                <!-- Model Selection -->
                <div>
                    <label for="model" class="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                    <select id="model" name="model" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="openai:gpt-image-1">🚀 GPT-Image-1 (OpenAI, fastest)</option>
                        <option value="replicate:black-forest-labs/flux-1.1-pro-ultra">⭐ Flux 1.1 Pro Ultra (Latest, best quality)</option>
                        <option value="replicate:recraft-ai/recraft-v3">🎨 Recraft v3 (Stylized, vector-style)</option>
                        <option value="replicate:bytedance/seedream-3">📸 Seedream-3 (Photorealistic)</option>
                        <option value="replicate:google/imagen-4">🔥 Imagen-4 (Google, high quality)</option>
                    </select>
                </div>

                <!-- Fixed TikTok Format -->
                <div class="bg-purple-50 p-4 rounded-lg">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">📱</span>
                        <div>
                            <h4 class="font-medium text-gray-800">TikTok Vertical Format</h4>
                            <p class="text-sm text-gray-600">Optimized for 9:16 aspect ratio</p>
                        </div>
                    </div>
                </div>

                <!-- Model-Specific Controls -->
                
                <!-- Flux Models Controls -->
                <div id="flux-controls" class="model-controls">
                    <div class="bg-blue-50 p-4 rounded-lg space-y-3">
                        <h4 class="font-medium text-gray-800">Flux Settings</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="steps" class="block text-sm text-gray-700 mb-1">Steps</label>
                                <select id="steps" name="steps" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                                    <option value="4">4 (Ultra Fast)</option>
                                    <option value="10">10 (Fast)</option>
                                    <option value="25" selected>25 (Balanced)</option>
                                    <option value="50">50 (High Quality)</option>
                                </select>
                            </div>
                            <div>
                                <label for="guidance" class="block text-sm text-gray-700 mb-1">Guidance</label>
                                <input type="range" id="guidance" name="guidance" min="1" max="10" step="0.5" value="3.5" class="w-full">
                                <div class="text-xs text-gray-500 text-center"><span id="guidanceValue">3.5</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SeeaDream-3 Controls -->
                <div id="seedream-controls" class="model-controls">
                    <div class="bg-green-50 p-4 rounded-lg space-y-3">
                        <h4 class="font-medium text-gray-800">Seedream-3 Settings</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="seedream_size" class="block text-sm text-gray-700 mb-1">Size</label>
                                <select id="seedream_size" name="seedream_size" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                                    <option value="small">Small (512px shortest)</option>
                                    <option value="regular" selected>Regular (1MP)</option>
                                    <option value="big">Big (2048px longest)</option>
                                </select>
                            </div>
                            <div>
                                <label for="seedream_guidance" class="block text-sm text-gray-700 mb-1">Guidance Scale</label>
                                <input type="range" id="seedream_guidance" name="seedream_guidance" min="1" max="10" step="0.5" value="2.5" class="w-full">
                                <div class="text-xs text-gray-500 text-center"><span id="seedreamGuidanceValue">2.5</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Imagen-4 Controls -->
                <div id="imagen-controls" class="model-controls">
                    <div class="bg-orange-50 p-4 rounded-lg space-y-3">
                        <h4 class="font-medium text-gray-800">Imagen-4 Settings</h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="imagen_format" class="block text-sm text-gray-700 mb-1">Output Format</label>
                                <select id="imagen_format" name="imagen_format" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                                    <option value="jpg" selected>JPG (Smaller file)</option>
                                    <option value="png">PNG (Higher quality)</option>
                                </select>
                            </div>
                            <div>
                                <label for="imagen_safety" class="block text-sm text-gray-700 mb-1">Safety Filter</label>
                                <select id="imagen_safety" name="imagen_safety" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                                    <option value="block_only_high" selected>Permissive</option>
                                    <option value="block_medium_and_above">Moderate</option>
                                    <option value="block_low_and_above">Strict</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recraft Controls -->
                <div id="recraft-controls" class="model-controls">
                    <div class="bg-purple-50 p-4 rounded-lg space-y-3">
                        <h4 class="font-medium text-gray-800">Recraft Style</h4>
                        <select id="recraft_style" name="recraft_style" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                            <option value="any">Any Style</option>
                            <option value="realistic_image">📸 Photorealistic</option>
                            <option value="digital_illustration">🎨 Digital Art</option>
                            <option value="digital_illustration/2d_art_poster">🎭 Anime/Poster</option>
                            <option value="digital_illustration/pixel_art">🕹️ Pixel Art</option>
                            <option value="realistic_image/b_and_w">⚫ Black & White</option>
                            <option value="realistic_image/hdr">✨ HDR</option>
                        </select>
                    </div>
                </div>

                <!-- Generate Button -->
                <button 
                    type="submit" 
                    id="generateBtn" 
                    class="w-full gradient-bg text-white font-medium py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Generate Image ✨
                </button>
            </form>
        </div>

        <!-- Loading State -->
        <div id="loadingState" class="hidden bg-white rounded-lg card-shadow p-6 mb-8">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Generating your image...</h3>
                <p class="text-gray-600">This usually takes 10-30 seconds</p>
            </div>
        </div>

        <!-- Results Section -->
        <div id="resultsSection" class="hidden bg-white rounded-lg card-shadow p-6 mb-8">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Generated Image</h3>
            <div id="resultContent"></div>
        </div>

        <!-- Recent Generations -->
        <div class="bg-white rounded-lg card-shadow p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">Recent Generations</h3>
                <button id="clearHistory" class="text-sm text-red-600 hover:text-red-800">Clear All</button>
            </div>
            <div id="recentGenerations" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <p class="text-gray-500 col-span-full text-center">Generate your first image to see results here!</p>
            </div>
        </div>
    </div>

    <!-- Image Modal -->
    <div id="imageModal" class="modal">
        <div class="modal-content">
            <span class="modal-close" onclick="closeModal()">&times;</span>
            <div class="modal-image-container">
                <img id="modalImage" src="" alt="Full size image">
            </div>
            <div id="modalMetadata" class="modal-metadata">
                <!-- Metadata will be populated here -->
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div id="settingsModal" class="modal">
        <div class="modal-content" style="max-width: 400px; background: white; padding: 24px; border-radius: 12px;">
            <span class="modal-close" onclick="closeSettingsModal()">&times;</span>
            <h3 class="text-lg font-medium text-gray-900 mb-4">Settings</h3>
            <div class="space-y-4">
                <div>
                    <label for="passwordInput" class="block text-sm font-medium text-gray-700 mb-2">
                        API Password <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="password" 
                        id="passwordInput" 
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your API password"
                    >
                    <p class="text-xs text-gray-500 mt-1">Required to generate images</p>
                </div>
                <div class="flex justify-end space-x-3">
                    <button onclick="closeSettingsModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                    <button onclick="saveSettings()" class="px-4 py-2 gradient-bg text-white rounded-lg hover:opacity-90">Save</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Configuration
        const API_BASE = window.location.origin;
        let PASSWORD = localStorage.getItem('aidobe_password') || '';

        // DOM Elements
        const form = document.getElementById('generateForm');
        const promptInput = document.getElementById('prompt');
        const charCount = document.getElementById('charCount');
        const loadingState = document.getElementById('loadingState');
        const resultsSection = document.getElementById('resultsSection');
        const resultContent = document.getElementById('resultContent');
        const generateBtn = document.getElementById('generateBtn');
        const modelSelect = document.getElementById('model');

        // State
        let currentAspectRatio = '9:16'; // Default to TikTok
        let currentModel = 'openai:gpt-image-1';
        let imageMetadataStore = {}; // Store metadata for modal display

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            loadRecentGenerations();
            
            // Character count
            promptInput.addEventListener('input', function() {
                charCount.textContent = this.value.length;
            });

            // Model change handler
            modelSelect.addEventListener('change', function() {
                currentModel = this.value;
                updateModelControls();
            });

            // Guidance slider
            document.getElementById('guidance').addEventListener('input', function() {
                document.getElementById('guidanceValue').textContent = this.value;
            });

            // SeeaDream guidance slider
            document.getElementById('seedream_guidance').addEventListener('input', function() {
                document.getElementById('seedreamGuidanceValue').textContent = this.value;
            });

            // TikTok format is fixed at 9:16, no user interaction needed

            // Clear history
            document.getElementById('clearHistory').addEventListener('click', function() {
                if (confirm('Clear all generation history?')) {
                    localStorage.removeItem('aidobe_history');
                    loadRecentGenerations();
                }
            });

            // Form submission
            form.addEventListener('submit', handleGenerate);
            
            // Settings button
            document.getElementById('settingsBtn').addEventListener('click', function() {
                openSettingsModal();
            });
            
            // Update settings button appearance based on password status
            updateSettingsButton();
            
            // Initial model controls update
            updateModelControls();
        });

        function updateSettingsButton() {
            const btn = document.getElementById('settingsBtn');
            if (PASSWORD) {
                btn.textContent = '🔐'; // Locked/configured
                btn.style.color = '#10b981'; // Green
                btn.title = 'Settings (Password configured)';
            } else {
                btn.textContent = '⚙️'; // Settings
                btn.style.color = '#ef4444'; // Red
                btn.title = 'Settings (Password required)';
            }
        }

        function updateModelControls() {
            // Hide all model controls
            document.querySelectorAll('.model-controls').forEach(control => {
                control.classList.remove('active');
            });

            // Show relevant controls based on model
            const [provider, model] = currentModel.split(':');
            
            if (provider === 'replicate') {
                if (model === 'black-forest-labs/flux-1.1-pro-ultra') {
                    document.getElementById('flux-controls').classList.add('active');
                } else if (model === 'recraft-ai/recraft-v3') {
                    document.getElementById('recraft-controls').classList.add('active');
                } else if (model === 'bytedance/seedream-3') {
                    document.getElementById('seedream-controls').classList.add('active');
                } else if (model === 'google/imagen-4') {
                    document.getElementById('imagen-controls').classList.add('active');
                }
            }
        }

        async function handleGenerate(e) {
            e.preventDefault();
            
            const prompt = promptInput.value.trim();
            if (!prompt) {
                alert('Please enter a prompt');
                return;
            }

            // Check if password is set
            if (!PASSWORD) {
                alert('Please set your API password in Settings first');
                openSettingsModal();
                return;
            }

            // Show loading state
            loadingState.classList.remove('hidden');
            resultsSection.classList.add('hidden');
            generateBtn.disabled = true;

            try {
                const formData = new FormData(form);
                const [provider, model] = currentModel.split(':');
                
                const requestData = {
                    prompt: prompt,
                    provider: provider,
                    model: model,
                    aspect_ratio: currentAspectRatio,
                    enhance: true // Always enhance prompts
                };

                // Add model-specific parameters
                if (provider === 'replicate') {
                    if (model === 'black-forest-labs/flux-1.1-pro-ultra') {
                        requestData.safety_tolerance = parseInt(formData.get('safety_tolerance')) || 2;
                        requestData.raw = formData.get('raw') === 'true' || false;
                        requestData.output_format = 'jpg';
                        requestData.aspect_ratio = currentAspectRatio;
                    } else if (model === 'recraft-ai/recraft-v3') {
                        requestData.style = formData.get('recraft_style') || 'any';
                        requestData.aspect_ratio = currentAspectRatio;
                    } else if (model === 'bytedance/seedream-3') {
                        requestData.size = formData.get('seedream_size') || 'regular';
                        requestData.guidance_scale = parseFloat(formData.get('seedream_guidance')) || 2.5;
                        requestData.aspect_ratio = currentAspectRatio;
                    } else if (model === 'google/imagen-4') {
                        requestData.output_format = formData.get('imagen_format') || 'jpg';
                        requestData.safety_filter_level = formData.get('imagen_safety') || 'block_only_high';
                        requestData.aspect_ratio = currentAspectRatio;
                    }
                }

                const response = await fetch(API_BASE + '/api/images/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + PASSWORD
                    },
                    body: JSON.stringify(requestData)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || result.message || 'Generation failed');
                }

                // Show results
                displayResult(result);
                saveToHistory(result);
                loadRecentGenerations(); // Refresh recent generations

            } catch (error) {
                console.error('Generation error:', error);
                alert('Generation failed: ' + error.message);
            } finally {
                loadingState.classList.add('hidden');
                generateBtn.disabled = false;
            }
        }

        function getDimensionsForAspectRatio(ratio) {
            const dimensions = {
                '9:16': { width: 768, height: 1344 },
                '1:1': { width: 1024, height: 1024 },
                '16:9': { width: 1344, height: 768 },
                '4:5': { width: 896, height: 1120 }
            };
            return dimensions[ratio] || dimensions['9:16'];
        }

        function getSizeForAspectRatio(ratio) {
            const sizes = {
                '9:16': '1024x1365',
                '1:1': '1024x1024',
                '16:9': '1365x1024',
                '4:5': '1024x1280'
            };
            return sizes[ratio] || sizes['9:16'];
        }

        function displayResult(result) {
            const outputsHtml = result.outputs.map(output => {
                const metadata = {
                    prompt: result.originalPrompt,
                    enhancedPrompt: result.enhancedPrompt,
                    model: result.model || currentModel,
                    id: result.promptId,
                    createdAt: new Date().toISOString(),
                    parameters: result.parameters || {}
                };
                const metadataJson = JSON.stringify(metadata).replace(/'/g, "&apos;");
                
                return '<div class="relative group">' +
                    '<img src="' + output.url + '" alt="Generated image" class="w-full rounded-lg shadow-md cursor-pointer hover:opacity-95 transition-opacity" onclick="openModal(\\'' + output.url + '\\', ' + metadataJson + ')">' +
                    '<div class="absolute top-2 right-2 flex space-x-2">' +
                        '<button onclick="downloadImage(\\'' + output.url + '\\', \\'' + output.id + '\\')" class="bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm hover:bg-opacity-90 transition-colors">' +
                            '📥 Download' +
                        '</button>' +
                        '<button onclick="deleteImage(\\'' + result.promptId + '\\', \\'' + output.id + '\\')" class="bg-red-600 bg-opacity-70 text-white px-3 py-1 rounded text-sm hover:bg-opacity-90 transition-colors">' +
                            '🗑️ Delete' +
                        '</button>' +
                    '</div>' +
                '</div>';
            }).join('');
            
            const enhancedPromptHtml = result.enhancedPrompt ? 
                '<p><strong>Enhanced:</strong> ' + result.enhancedPrompt + '</p>' : '';
            
            resultContent.innerHTML = 
                '<div class="space-y-4">' +
                    '<div class="grid grid-cols-1 gap-4">' +
                        outputsHtml +
                    '</div>' +
                    '<div class="text-sm text-gray-600 space-y-1">' +
                        '<p><strong>Prompt:</strong> ' + result.originalPrompt + '</p>' +
                        enhancedPromptHtml +
                        '<p><strong>Model:</strong> ' + (result.model || currentModel) + '</p>' +
                        '<p><strong>ID:</strong> ' + result.promptId + '</p>' +
                    '</div>' +
                '</div>';
            resultsSection.classList.remove('hidden');
        }

        function saveToHistory(result) {
            const history = JSON.parse(localStorage.getItem('aidobe_history') || '[]');
            const entry = {
                id: result.promptId,
                prompt: result.originalPrompt,
                model: result.model,
                outputs: result.outputs,
                timestamp: Date.now()
            };
            history.unshift(entry);
            // Keep only last 20 entries
            localStorage.setItem('aidobe_history', JSON.stringify(history.slice(0, 20)));
        }

        async function loadRecentGenerations() {
            try {
                // Try to load from API first, fallback to localStorage
                const response = await fetch(API_BASE + '/api/images/history?limit=6', {
                    headers: {
                        'Authorization': 'Bearer ' + PASSWORD
                    }
                });
                
                let data;
                if (response.ok) {
                    data = await response.json();
                } else {
                    // Fallback to localStorage
                    const history = JSON.parse(localStorage.getItem('aidobe_history') || '[]');
                    data = { prompts: history.slice(0, 6) };
                }
                
                const container = document.getElementById('recentGenerations');
                
                if (data.prompts && data.prompts.length > 0) {
                    container.innerHTML = data.prompts.map(prompt => {
                        let imageHtml = '';
                        let imageUrl = '';
                        if (prompt.outputs && prompt.outputs.length > 0) {
                            imageUrl = prompt.outputs[0].url || prompt.outputs[0];
                            imageHtml = '<div class="relative group">' +
                                '<img src="' + imageUrl + '" alt="Generated image" class="w-full h-48 object-cover cursor-pointer hover:opacity-95 transition-opacity" onclick="openModal(\\'' + imageUrl + '\\')">' +
                                '<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">' +
                                    '<button onclick="deleteFromHistory(\\'' + prompt.id + '\\'); event.stopPropagation();" class="bg-red-600 bg-opacity-80 text-white px-2 py-1 rounded text-xs hover:bg-opacity-100">' +
                                        '🗑️' +
                                    '</button>' +
                                '</div>' +
                            '</div>';
                        } else if (prompt.output_urls && prompt.output_urls.length > 0) {
                            imageUrl = prompt.output_urls[0];
                            imageHtml = '<div class="relative group">' +
                                '<img src="' + imageUrl + '" alt="Generated image" class="w-full h-48 object-cover cursor-pointer hover:opacity-95 transition-opacity" onclick="openModal(\\'' + imageUrl + '\\')">' +
                                '<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">' +
                                    '<button onclick="deleteFromHistory(\\'' + prompt.id + '\\'); event.stopPropagation();" class="bg-red-600 bg-opacity-80 text-white px-2 py-1 rounded text-xs hover:bg-opacity-100">' +
                                        '🗑️' +
                                    '</button>' +
                                '</div>' +
                            '</div>';
                        } else {
                            // For legacy/failed generations, show a placeholder with delete button
                            imageHtml = '<div class="w-full h-48 bg-red-50 border-2 border-dashed border-red-200 flex flex-col items-center justify-center relative group">' +
                                '<span class="text-red-400 text-4xl mb-2">⚠️</span>' +
                                '<span class="text-red-500 text-sm">Generation Failed</span>' +
                                '<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">' +
                                    '<button onclick="deleteFromHistory(\\'' + prompt.id + '\\'); event.stopPropagation();" class="bg-red-600 bg-opacity-80 text-white px-2 py-1 rounded text-xs hover:bg-opacity-100">' +
                                        '🗑️ Clean up' +
                                    '</button>' +
                                '</div>' +
                            '</div>';
                        }
                        
                        const promptText = prompt.prompt || prompt.original_prompt;
                        const date = prompt.timestamp ? new Date(prompt.timestamp).toLocaleDateString() : new Date(prompt.created_at).toLocaleDateString();
                        
                        return '<div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">' +
                            imageHtml +
                            '<div class="p-3">' +
                                '<p class="text-sm text-gray-900 truncate" title="' + promptText + '">' + promptText + '</p>' +
                                '<p class="text-xs text-gray-500 mt-1">' + date + '</p>' +
                                '<p class="text-xs text-gray-400">' + prompt.model + '</p>' +
                            '</div>' +
                        '</div>';
                    }).join('');
                } else {
                    container.innerHTML = '<p class="text-gray-500 col-span-full text-center">Generate your first image to see results here!</p>';
                }
                
            } catch (error) {
                console.error('Failed to load recent generations:', error);
                // Try localStorage as backup
                const history = JSON.parse(localStorage.getItem('aidobe_history') || '[]');
                const container = document.getElementById('recentGenerations');
                if (history.length > 0) {
                    container.innerHTML = history.slice(0, 6).map(item => 
                        '<div class="border border-gray-200 rounded-lg overflow-hidden">' +
                            '<div class="p-3">' +
                                '<p class="text-sm text-gray-900 truncate">' + item.prompt + '</p>' +
                                '<p class="text-xs text-gray-500">' + new Date(item.timestamp).toLocaleDateString() + '</p>' +
                            '</div>' +
                        '</div>'
                    ).join('');
                }
            }
        }

        function downloadImage(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = 'aidobe-' + filename + '.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Modal functions
        function openModal(imageUrl, metadata = null) {
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');
            const modalMetadata = document.getElementById('modalMetadata');
            
            modalImage.src = imageUrl;
            
            // Populate metadata if provided
            if (metadata) {
                let metadataHtml = '<div class="space-y-4">' +
                    '<div class="border-b border-gray-200 pb-3">' +
                        '<h3 class="text-lg font-semibold text-gray-900">Generation Details</h3>' +
                    '</div>';
                
                // Prompt section
                if (metadata.prompt) {
                    metadataHtml += '<div class="bg-blue-50 p-4 rounded-lg">' +
                        '<h4 class="font-medium text-blue-900 mb-2">💬 Prompt</h4>' +
                        '<p class="text-blue-800 leading-relaxed">' + metadata.prompt + '</p>' +
                        '</div>';
                }
                
                if (metadata.enhancedPrompt) {
                    metadataHtml += '<div class="bg-green-50 p-4 rounded-lg">' +
                        '<h4 class="font-medium text-green-900 mb-2">✨ Enhanced Prompt</h4>' +
                        '<p class="text-green-800 leading-relaxed">' + metadata.enhancedPrompt + '</p>' +
                        '</div>';
                }
                
                // Model and technical details
                metadataHtml += '<div class="bg-gray-50 p-4 rounded-lg">' +
                    '<h4 class="font-medium text-gray-900 mb-3">⚙️ Technical Details</h4>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">';
                
                if (metadata.model) {
                    metadataHtml += '<div class="flex justify-between">' +
                        '<span class="font-medium text-gray-700">Model:</span>' +
                        '<span class="text-gray-900 font-mono text-sm">' + metadata.model + '</span>' +
                        '</div>';
                }
                
                if (metadata.id) {
                    metadataHtml += '<div class="flex justify-between">' +
                        '<span class="font-medium text-gray-700">Generation ID:</span>' +
                        '<span class="text-gray-900 font-mono text-xs">' + metadata.id + '</span>' +
                        '</div>';
                }
                
                if (metadata.createdAt) {
                    metadataHtml += '<div class="flex justify-between">' +
                        '<span class="font-medium text-gray-700">Created:</span>' +
                        '<span class="text-gray-900">' + new Date(metadata.createdAt).toLocaleString() + '</span>' +
                        '</div>';
                }
                
                metadataHtml += '</div></div>'; // Close grid and bg-gray-50
                
                // Parameters section
                if (metadata.parameters && Object.keys(metadata.parameters).length > 0) {
                    metadataHtml += '<div class="bg-purple-50 p-4 rounded-lg">' +
                        '<h4 class="font-medium text-purple-900 mb-3">🎛️ Generation Settings</h4>' +
                        '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">';
                    
                    for (const [key, value] of Object.entries(metadata.parameters)) {
                        if (value !== null && value !== undefined && value !== '') {
                            metadataHtml += '<div class="flex justify-between py-1">' +
                                '<span class="text-purple-700 font-medium capitalize">' + key.replace(/_/g, ' ') + ':</span>' +
                                '<span class="text-purple-900 font-mono text-sm">' + JSON.stringify(value) + '</span>' +
                                '</div>';
                        }
                    }
                    
                    metadataHtml += '</div></div>';
                }
                
                metadataHtml += '</div>'; // Close space-y-4
                modalMetadata.innerHTML = metadataHtml;
            } else {
                modalMetadata.innerHTML = '<div class="text-center py-8">' +
                    '<p class="text-gray-500">📋 No metadata available for this image</p>' +
                    '</div>';
            }
            
            modal.classList.add('active');
            
            // Close modal when clicking outside the content
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeModal();
                }
            });
            
            // Close modal with Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeModal();
                }
            });
        }

        function closeModal() {
            const modal = document.getElementById('imageModal');
            modal.classList.remove('active');
        }

        // Delete functions
        async function deleteImage(promptId, imageId) {
            if (!confirm('Are you sure you want to delete this image?')) {
                return;
            }

            try {
                const response = await fetch(API_BASE + '/api/images/' + promptId + '/' + imageId, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + PASSWORD
                    }
                });

                if (response.ok) {
                    // Remove from current results display
                    location.reload(); // Simple approach - reload page
                } else {
                    // Fallback: remove from localStorage if API fails
                    deleteFromLocalStorage(promptId);
                    alert('Image deleted locally (API delete failed)');
                }
            } catch (error) {
                console.error('Delete error:', error);
                // Fallback: remove from localStorage
                deleteFromLocalStorage(promptId);
                alert('Image deleted locally (API unavailable)');
            }
        }

        async function deleteFromHistory(promptId) {
            if (!confirm('Are you sure you want to delete this generation?')) {
                return;
            }
            
            try {
                const response = await fetch(API_BASE + '/api/images/' + promptId, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + PASSWORD
                    }
                });

                if (response.ok) {
                    loadRecentGenerations(); // Refresh the display
                } else {
                    // Fallback: remove from localStorage if API fails
                    deleteFromLocalStorage(promptId);
                    loadRecentGenerations();
                    alert('Generation deleted locally (API delete failed)');
                }
            } catch (error) {
                console.error('Delete error:', error);
                // Fallback: remove from localStorage
                deleteFromLocalStorage(promptId);
                loadRecentGenerations();
                alert('Generation deleted locally (API unavailable)');
            }
        }

        function deleteFromLocalStorage(promptId) {
            const history = JSON.parse(localStorage.getItem('aidobe_history') || '[]');
            const updatedHistory = history.filter(item => item.id !== promptId);
            localStorage.setItem('aidobe_history', JSON.stringify(updatedHistory));
        }

        // Settings modal functions
        function openSettingsModal() {
            const modal = document.getElementById('settingsModal');
            const passwordInput = document.getElementById('passwordInput');
            passwordInput.value = PASSWORD; // Pre-fill current password
            modal.classList.add('active');
            
            // Close modal when clicking outside
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeSettingsModal();
                }
            });
            
            // Close modal with Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeSettingsModal();
                }
            });
        }

        function closeSettingsModal() {
            const modal = document.getElementById('settingsModal');
            modal.classList.remove('active');
        }

        function saveSettings() {
            const passwordInput = document.getElementById('passwordInput');
            const newPassword = passwordInput.value.trim();
            
            if (!newPassword) {
                alert('Please enter a password');
                return;
            }
            
            PASSWORD = newPassword;
            localStorage.setItem('aidobe_password', PASSWORD);
            closeSettingsModal();
            
            // Show success feedback
            const btn = document.getElementById('settingsBtn');
            btn.textContent = '✅';
            setTimeout(() => {
                updateSettingsButton();
            }, 2000);
        }
    </script>
</body>
</html>`)
})

const api = new Hono<{ Bindings: Env }>()
api.use('*', authMiddleware)

api.route('/images', imageRoutes)
api.route('/videos', videoRoutes)
api.route('/prompts', promptRoutes)
api.route('/downloads', downloadRoutes)

app.route('/api', api)
app.route('/media', mediaRoutes)

export default app