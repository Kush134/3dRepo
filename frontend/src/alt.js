import './styles/main.css';
import './styles/visualization.css';
import { TreeVisualizer } from './visualizer/TreeVisualizer';

class RepositoryVisualizer {
    constructor() {
        this.visualizer = null;
        this.isInitializing = false;
        this.initializeUI();
    }

    /**
     * Fetch the OpenAI key from the backend and set window.OPENAI_API_KEY
     * so TreeVisualizer.js can use it in the Authorization header.
     */
    async loadOpenAIKey() {
        try {
            const res = await fetch('/api/v1/config/openai-key');
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || 'Failed to load OpenAI key');
            }
            const data = await res.json();
            window.OPENAI_API_KEY = data.key; 
            console.log('Loaded OpenAI key:', data.key);
        } catch (err) {
            console.error('Error loading OpenAI key:', err);
            this.updateDiagnostics(`Error loading OpenAI key: ${err.message}`, 'error');
        }
    }

    initializeUI() {
        console.log('Initializing application...');

        // Load the OpenAI API key before we do anything else
        this.loadOpenAIKey();

        // Initialize visualizer
        try {
            const visualizationContainer = document.getElementById('visualization');
            if (!visualizationContainer) {
                throw new Error('Visualization container not found');
            }

            this.visualizer = new TreeVisualizer('visualization');
            console.log('TreeVisualizer initialized');

            // Setup event listeners
            this.setupEventListeners();
            
            // Clear any existing progress display
            this.updateProgress(0, '');
            this.clearDiagnostics();
            
            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Error initializing application:', error);
            this.updateDiagnostics(`Initialization error: ${error.message}`, 'error');
            this.updateProgress(0, 'failed');
        }
    }

    setupEventListeners() {
        // Setup analyze button
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.handleAnalyzeClick());
        } else {
            console.error('Analyze button not found');
        }

        // Setup clear diagnostics button
        const clearDiagnosticsBtn = document.getElementById('clearDiagnostics');
        if (clearDiagnosticsBtn) {
            clearDiagnosticsBtn.addEventListener('click', () => this.clearDiagnostics());
        }

        // Add window error handler
        window.onerror = (msg, url, lineNo, columnNo, error) => {
            this.updateDiagnostics(`Runtime error: ${msg}`, 'error');
            return false;
        };
    }

    async handleAnalyzeClick() {
        if (this.isInitializing) {
            console.log('Analysis already in progress, please wait...');
            return;
        }

        try {
            this.isInitializing = true;
            const ownerInput = document.getElementById('owner');
            const repoInput = document.getElementById('repo');
            
            if (!ownerInput || !repoInput) {
                throw new Error('Required input elements not found');
            }

            const owner = ownerInput.value.trim();
            const repo = repoInput.value.trim();

            if (!owner || !repo) {
                throw new Error('Please enter both repository owner and name');
            }

            // Reset state
            this.updateProgress(0, 'Initializing...');
            this.clearDiagnostics();
            this.updateDiagnostics(`Analyzing repository: ${owner}/${repo}`);
            
            // Clear previous visualization
            if (this.visualizer) {
                this.visualizer.clearVisualization();
            }

            // Make API request
            this.updateProgress(20, 'Connecting to server...');
            const response = await fetch('/api/v1/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    owner, 
                    repo, 
                    limit: 50 
                })
            });

            this.updateProgress(50, 'Processing response...');

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to analyze repository');
            }

            const data = await response.json();
            console.log('Received visualization data:', data);

            if (!data.nodes || !data.edges) {
                throw new Error('Invalid data format received from server');
            }

            this.updateProgress(80, 'Rendering visualization...');

            // Update visualization
            if (this.visualizer) {
                await this.visualizer.visualizeData(data);
                this.updateDiagnostics('Analysis completed successfully');
                this.updateProgress(100, 'Complete');
            } else {
                throw new Error('Visualizer not initialized');
            }

        } catch (error) {
            console.error('Error during analysis:', error);
            this.updateDiagnostics(`Error: ${error.message}`, 'error');
            this.updateProgress(0, 'failed');
        } finally {
            this.isInitializing = false;
        }
    }

    updateDiagnostics(message, type = 'info') {
        const diagnosticsContent = document.getElementById('diagnosticsContent');
        if (!diagnosticsContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `diagnostic-entry ${type}`;
        entry.innerHTML = `${timestamp} - ${message}`;
        diagnosticsContent.appendChild(entry);
        diagnosticsContent.scrollTop = diagnosticsContent.scrollHeight;
    }

    clearDiagnostics() {
        const diagnosticsContent = document.getElementById('diagnosticsContent');
        if (diagnosticsContent) {
            diagnosticsContent.innerHTML = '';
        }
    }

    updateProgress(percentage, status = '') {
        const progressContainer = document.querySelector('.progress-container');
        const progressFill = document.querySelector('.progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');
        const progressStatus = document.querySelector('.progress-status');

        if (!progressContainer || !progressFill || !progressPercentage || !progressStatus) {
            console.error('Progress elements not found');
            return;
        }

        // Show/hide progress based on status
        if (status === '') {
            progressContainer.classList.add('hidden');
        } else {
            progressContainer.classList.remove('hidden');
        }

        // Update progress bar
        progressFill.style.width = `${percentage}%`;
        progressPercentage.textContent = `${percentage}%`;
        
        // Update status text
        switch (status) {
            case 'failed':
                progressContainer.classList.add('failed');
                progressStatus.textContent = 'Analysis failed';
                break;
            case '':
                progressContainer.classList.remove('failed');
                progressStatus.textContent = '';
                break;
            default:
                progressContainer.classList.remove('failed');
                progressStatus.textContent = status;
        }
    }

    dispose() {
        if (this.visualizer) {
            this.visualizer.dispose();
            this.visualizer = null;
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new RepositoryVisualizer();
        console.log('RepoViz application started');
    } catch (error) {
        console.error('Failed to start application:', error);
        // Try to show error in diagnostics even if initialization failed
        const diagnosticsContent = document.getElementById('diagnosticsContent');
        if (diagnosticsContent) {
            diagnosticsContent.innerHTML = `<div class="diagnostic-entry error">${new Date().toLocaleTimeString()} - Fatal error: ${error.message}</div>`;
        }
    }
});

export default RepositoryVisualizer;
