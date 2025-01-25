import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class TreeVisualizer {
    constructor(containerId) {
        console.log('Initializing TreeVisualizer with container:', containerId);
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }
    
        console.log('Container dimensions:', {
            width: this.container.clientWidth,
            height: this.container.clientHeight
        });
    
        // Ensure container takes full space
        this.container.style.width = '100%';
        this.container.style.height = '100vh';
        this.container.style.position = 'relative';
    
        // Basic state initialization
        this.nodes = [];
        this.edges = [];
        this.branchNodes = new Map();
        this.currentData = null;
        this.viewModes = ['tree', 'linear', 'timeline'];
        this.currentViewMode = 'tree';
        this.analysisCache = new Map();
        this.relationshipAnalysisCache = new Map();
        this.hoveredNode = null;
        this.selectedNode = null;
        this.expandedBranches = new Set();
        this.isAnalyzing = false;
    
        // Initialize Scene
        console.log('Initializing Three.js scene');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d1117);
    
        // Initialize Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 100);
        console.log('Camera initialized:', {
            position: this.camera.position,
            fov: this.camera.fov,
            aspect: this.camera.aspect
        });
    
        // Initialize Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        console.log('Renderer initialized:', {
            size: {
                width: this.renderer.domElement.width,
                height: this.renderer.domElement.height
            },
            pixelRatio: window.devicePixelRatio
        });
    
        // Initialize Lighting
        console.log('Setting up lights');
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(ambientLight);
        this.scene.add(directionalLight);
    
        // Initialize Orbit Controls
        console.log('Setting up controls');
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
    
        // Initialize UI components
        console.log('Initializing UI components');
        this.initializeUI();
        this.setupEventListeners();
    
        // Start animation loop
        console.log('Starting animation loop');
        this.animate();
    
        // Initial render to show test cube
        this.renderer.render(this.scene, this.camera);
        console.log('Initial render complete');
    
        // Log successful initialization
        console.log('TreeVisualizer initialization complete', {
            container: this.container,
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            controls: this.controls
        });
    }

    // -----------------------
    // UI CREATION
    // -----------------------

    initializeUI() {
        this.createViewControls();
        this.createVerticalControls();
        this.createAnalysisPanel();
        this.createTooltip();
        this.createLoadingIndicator();
    }

    createViewControls() {
        const controls = document.createElement('div');
        controls.className = 'view-controls';
        controls.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        `;

        this.viewModes.forEach((mode) => {
            const btn = document.createElement('button');
            btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + ' View';
            btn.className = `view-btn ${mode === this.currentViewMode ? 'active' : ''}`;
            btn.onclick = () => this.switchView(mode);
            controls.appendChild(btn);
        });

        this.container.appendChild(controls);
    }

    createVerticalControls() {
        const controls = document.createElement('div');
        controls.className = 'vertical-controls';
        controls.style.cssText = `
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
        `;

        ['up', 'down'].forEach((direction) => {
            const btn = document.createElement('button');
            btn.className = 'vertical-btn';
            btn.innerHTML = direction === 'up' ? '↑' : '↓';
            btn.onclick = () => this.moveVertically(direction);
            controls.appendChild(btn);
        });

        this.container.appendChild(controls);
    }

    createAnalysisPanel() {
        this.analysisPanel = document.createElement('div');
        this.analysisPanel.className = 'analysis-panel';
        this.analysisPanel.style.cssText = `
            position: absolute;
            left: 20px;
            top: 20px;
            background: rgba(13, 17, 23, 0.95);
            padding: 20px;
            border-radius: 8px;
            color: #c9d1d9;
            max-width: 300px;
            display: none;
            z-index: 1000;
            font-size: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        this.container.appendChild(this.analysisPanel);
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(13, 17, 23, 0.95);
            padding: 12px;
            border-radius: 6px;
            color: #c9d1d9;
            font-size: 12px;
            pointer-events: none;
            display: none;
            z-index: 1001;
            max-width: 300px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        this.container.appendChild(this.tooltip);
    }

    createLoadingIndicator() {
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'loading-indicator';
        this.loadingIndicator.innerHTML = `
            <div class="spinner"></div>
            <div class="loading-text">Analyzing...</div>
        `;
        this.loadingIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(13, 17, 23, 0.95);
            padding: 20px;
            border-radius: 8px;
            color: #c9d1d9;
            display: none;
            z-index: 1002;
        `;
        this.container.appendChild(this.loadingIndicator);
    }

    // -----------------------
    // EVENT LISTENERS
    // -----------------------

    setupEventListeners() {
        window.addEventListener('resize', this.handleResize.bind(this));
        this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
        this.renderer.domElement.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    }

    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        if (this.labelRenderer) {
            this.labelRenderer.setSize(width, height);
        }
    }

    // -----------------------
    // VIEW MODES / SWITCH
    // -----------------------

    async switchView(mode) {
        this.currentViewMode = mode;

        // Update button states
        document.querySelectorAll('.view-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(mode));
        });

        if (this.currentData) {
            await this.visualizeData(this.currentData);
        }
    }

    moveVertically(direction) {
        const moveAmount = direction === 'up' ? 10 : -10;
        this.nodes.forEach((node) => {
            node.position.y += moveAmount;
        });
        this.updateEdgePositions();
    }

    // -----------------------
    // DATA VISUALIZATION
    // (combining new snippet logic + old snippet logic)
    // -----------------------

    /**
     * Main entry point: visualize a dataset of { nodes, edges }.
     * This calls different sub-methods depending on `currentViewMode`.
     */
    async visualizeData(data) {
        console.log('Raw visualization data:', JSON.stringify(data, null, 2));
        this.currentData = data;
        this.clearVisualization();
    
        if (!data.nodes || !data.edges) {
            console.error('Invalid data format:', data);
            return;
        }
    
        // Log individual nodes and edges
        console.log('Nodes:', data.nodes.map(n => ({ id: n.id, data: n.data })));
        console.log('Edges:', data.edges);
    
        switch (this.currentViewMode) {
            case 'tree':
                console.log('Creating tree visualization');
                await this.createTreeVisualization(data);
                break;
            case 'linear':
                console.log('Creating linear visualization');
                await this.createLinearVisualization(data);
                break;
            case 'timeline':
                console.log('Creating timeline visualization');
                await this.createTimelineVisualization(data);
                break;
            default:
                console.log('Creating simple radial visualization');
                await this.createSimpleRadialVisualization(data);
        }
    
        console.log('Visualization created, zooming to fit');
        this.zoomToFit();
    }

    /**
     * A simplified radial layout (from your "new code" snippet).
     * If someone selects a non-defined view, we fall back to this.
     */
    async createSimpleRadialVisualization(data) {
        console.log('Creating radial visualization with data:', data);
        const nodeMap = new Map();

        // Make nodes bigger and more spread out
        data.nodes.forEach((nodeData, index) => {
            const angle = (index / data.nodes.length) * Math.PI * 2;
            const radius = 40; // Increased from 20
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const node = this.createNode(nodeData, x, y);
            nodeMap.set(nodeData.id, node);
            this.nodes.push(node);
            this.scene.add(node);
            console.log(`Created node at position (${x}, ${y})`, nodeData);
        });

        // Add edges between nodes
        data.edges.forEach((edge) => {
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            if (sourceNode && targetNode) {
                const edgeLine = this.createEdgeLineBasic(sourceNode, targetNode);
                if (edgeLine) {
                    this.edges.push(edgeLine);
                    this.scene.add(edgeLine);
                    console.log('Created edge between', edge.source, 'and', edge.target);
                }
            }
        });

        // Adjust camera position
        this.camera.position.z = 100;
        this.camera.lookAt(0, 0, 0);
        this.controls.update();
    }

    createNode(nodeData, x, y) {
        // Make nodes bigger and more visible
        const geometry = new THREE.SphereGeometry(2, 32, 32); // Increased size from 1 to 2
        const material = new THREE.MeshPhongMaterial({
            color: nodeData.is_merge ? 0xff4444 : 0x2ea44f,
            transparent: true,
            opacity: 1, // Increased from 0.8
            metalness: 0.5,
            roughness: 0.5,
        });

        const node = new THREE.Mesh(geometry, material);
        node.position.set(x, y, 0);
        node.userData = { id: nodeData.id, data: nodeData };

        // Add a point light to make the node more visible
        const light = new THREE.PointLight(0xffffff, 1, 10);
        node.add(light);

        return node;
    }

    createEdgeLineBasic(sourceNode, targetNode) {
        // Make edges more visible
        const points = [sourceNode.position.clone(), targetNode.position.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x58a6ff, // Brighter color
            transparent: true,
            opacity: 0.8, // Increased from 0.6
            linewidth: 2 // Note: this might not work in WebGL
        });

        return new THREE.Line(geometry, material);
    }

    zoomToFit() {
        if (this.nodes.length === 0) return;
        console.log('Zooming to fit', this.nodes.length, 'nodes');

        const box = new THREE.Box3();
        this.nodes.forEach(node => box.expandByObject(node));

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        console.log('Bounding box:', {
            size: size.toArray(),
            center: center.toArray()
        });

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        // Add padding and move camera back
        cameraZ *= 2.5; // Increased from 1.5

        console.log('Setting camera position', {
            x: center.x,
            y: center.y,
            z: center.z + cameraZ
        });

        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();

        // Update controls target
        this.controls.target.copy(center);
        this.controls.update();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Make sure controls are updated
        if (this.controls) {
            this.controls.update();
        }

        // Update any labels if they exist
        if (this.labelRenderer) {
            this.labelRenderer.render(this.scene, this.camera);
        }

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * The “tree” view from your old snippet:
     * Groups commits by branch, shows branch nodes, etc.
     */
    async createTreeVisualization(data) {
        this.showLoading('Creating tree visualization...');
        try {
            // Group commits by branch
            const branches = this.groupByBranch(data.nodes);
            const layout = this.calculateTreeLayout(branches);

            // Create branch "root" nodes
            for (const [branchName, commits] of branches) {
                await this.createBranchNode(branchName, commits, layout.get(branchName));
            }

            // Create connections between branches if commits link across branches
            this.createBranchConnections(data.edges, branches);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * The “linear” view from your old snippet: a spiral layout of commits.
     */
    async createLinearVisualization(data) {
        this.showLoading('Creating linear visualization...');
        try {
            const sortedNodes = [...data.nodes].sort(
                (a, b) => new Date(a.data.date) - new Date(b.data.date)
            );

            // Create spiral layout
            sortedNodes.forEach((nodeData, index) => {
                const angle = index * 0.5;
                const radius = 20 + index * 0.5;
                const x = Math.cos(angle) * radius;
                const y = index * 2;
                const z = Math.sin(angle) * radius;

                const node = this.createCommitNode(nodeData, new THREE.Vector3(x, y, z));
                this.nodes.push(node);
                this.scene.add(node);
            });

            // Create edges
            this.createCommitEdges(data.edges);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * The “timeline” view from your old snippet: positions commits by date on the x-axis.
     */
    async createTimelineVisualization(data) {
        this.showLoading('Creating timeline visualization...');
        try {
            const sortedNodes = [...data.nodes].sort(
                (a, b) => new Date(a.data.date) - new Date(b.data.date)
            );
    
            const nodeMap = new Map();
            const timeScale = 40;
            const minDate = new Date(sortedNodes[0].data.date);
            const maxDate = new Date(sortedNodes[sortedNodes.length - 1].data.date);
            const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
            
            // Create nodes along timeline
            sortedNodes.forEach((nodeData, index) => {
                const date = new Date(nodeData.data.date);
                const daysSinceStart = (date - minDate) / (1000 * 60 * 60 * 24);
                const x = (daysSinceStart / totalDays) * timeScale * sortedNodes.length;
                // Y position based on branch
                const branchIndex = this.getBranchIndex(nodeData.data.branch);
                const y = branchIndex * 5;
                const z = 0;
    
                const node = this.createCommitNode(nodeData, new THREE.Vector3(x, y, z));
                nodeMap.set(nodeData.id, node);
                this.nodes.push(node);
                this.scene.add(node);
            });
    
            // Create curved connections between commits
            data.edges.forEach(edge => {
                const sourceNode = nodeMap.get(edge.source);
                const targetNode = nodeMap.get(edge.target);
                if (sourceNode && targetNode) {
                    const connection = this.createEdgeTube(sourceNode, targetNode, true);
                    if (connection) {
                        this.edges.push(connection);
                        this.scene.add(connection);
                    }
                }
            });
    
            // Add date markers
            this.addTimelineMarkers(minDate, maxDate, timeScale * sortedNodes.length);
    
        } finally {
            this.hideLoading();
        }
    }
    
    getBranchIndex(branchName) {
        if (!this.branchIndices) {
            this.branchIndices = new Map();
        }
        if (!this.branchIndices.has(branchName)) {
            this.branchIndices.set(branchName, this.branchIndices.size);
        }
        return this.branchIndices.get(branchName);
    }
    
    addTimelineMarkers(minDate, maxDate, width) {
        const markerCount = 5;
        const timeSpan = maxDate - minDate;
        
        for (let i = 0; i <= markerCount; i++) {
            const x = (width * i) / markerCount - width / 2;
            const date = new Date(minDate.getTime() + (timeSpan * i) / markerCount);
            
            // Create marker line
            const geometry = new THREE.BoxGeometry(0.2, 10, 0.2);
            const material = new THREE.MeshBasicMaterial({ color: 0x58a6ff });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(x, -10, 0);
            this.scene.add(marker);
    
            // Add date label (if using CSS2D labels)
            const dateLabel = document.createElement('div');
            dateLabel.className = 'timeline-marker';
            dateLabel.textContent = date.toLocaleDateString();
            const label = new CSS2DObject(dateLabel);
            label.position.set(x, -12, 0);
            this.scene.add(label);
        }
    }

    // -----------------------
    // BRANCH / TREE HELPERS (from old snippet)
    // -----------------------

    groupByBranch(nodes) {
        const branches = new Map();
        nodes.forEach((node) => {
            const branch = node.data.branch || 'main';
            if (!branches.has(branch)) {
                branches.set(branch, []);
            }
            branches.get(branch).push(node);
        });
        return branches;
    }

    calculateTreeLayout(branches) {
        const layout = new Map();
        const branchCount = branches.size;
        let angle = 0;
        const radius = 50;

        for (const [branchName] of branches) {
            layout.set(
                branchName,
                new THREE.Vector3(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                )
            );
            angle += (Math.PI * 2) / branchCount;
        }

        return layout;
    }

    createBranchConnections(edges, branches) {
        edges.forEach((edge) => {
            let sourceBranch = null;
            let targetBranch = null;

            for (const [branchName, commits] of branches) {
                const sourceCommit = commits.find((c) => c.id === edge.source);
                const targetCommit = commits.find((c) => c.id === edge.target);

                if (sourceCommit) sourceBranch = branchName;
                if (targetCommit) targetBranch = branchName;

                if (sourceBranch && targetBranch) break;
            }

            // If commits cross branches, connect branch "root" nodes
            if (sourceBranch !== targetBranch) {
                const sourceBranchNode = this.branchNodes.get(sourceBranch);
                const targetBranchNode = this.branchNodes.get(targetBranch);

                if (sourceBranchNode && targetBranchNode) {
                    const connection = this.createEdgeTube(
                        sourceBranchNode,
                        targetBranchNode
                    );
                    if (connection) {
                        connection.userData = {
                            type: 'branch-connection',
                            source: sourceBranch,
                            target: targetBranch,
                        };
                        this.edges.push(connection);
                        this.scene.add(connection);
                    }
                }
            }
        });
    }

    // -----------------------
    // NODE/EDGE CREATION
    // (merged from old + new)
    // -----------------------

    /**
     * Create a "branch root" node (sphere).
     */
    async createBranchNode(branchName, commits, position) {
        const geometry = new THREE.SphereGeometry(5, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: this.getBranchColor(branchName),
            transparent: true,
            opacity: 0.8,
        });

        const branchNode = new THREE.Mesh(geometry, material);
        branchNode.position.copy(position);

        branchNode.userData = {
            type: 'branch',
            name: branchName,
            commits: commits,
            analysis: await this.analyzeBranch(branchName, commits),
            expanded: false,
        };

        this.branchNodes.set(branchName, branchNode);
        this.nodes.push(branchNode);
        this.scene.add(branchNode);

        // If branch is already expanded, show its commits
        if (this.expandedBranches.has(branchName)) {
            await this.expandBranch(branchNode);
        }
    }

    /**
     * Create a "commit" node (sphere), from old snippet.
     */
    createCommitNode(commitData, position) {
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: this.getCommitColor(commitData),
            transparent: true,
            opacity: 0.8,
        });

        const node = new THREE.Mesh(geometry, material);
        node.position.copy(position);
        node.userData = {
            type: 'commit',
            id: commitData.id,
            data: commitData.data,
        };
        return node;
    }

    /**
     * Create a simpler "node" for the radial layout from the new snippet.
     * Basically the same idea, but using smaller spheres.
     */
    createNode(nodeData, x, y) {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: nodeData.isMerge ? 0xff4444 : 0x2ea44f,
            transparent: true,
            opacity: 0.8,
        });

        const node = new THREE.Mesh(geometry, material);
        node.position.set(x, y, 0);
        node.userData = { id: nodeData.id, data: nodeData };
        return node;
    }

    /**
     * Create edges between commits in "timeline" or "linear" view.
     * Optionally isTimeline => use straight lines, else curved tubes.
     */
    createCommitEdges(edges, isTimeline = false) {
        edges.forEach((edge) => {
            const sourceNode = this.findNodeById(edge.source);
            const targetNode = this.findNodeById(edge.target);
            if (sourceNode && targetNode) {
                const edgeLine = isTimeline
                    ? this.createEdgeLineBasic(sourceNode, targetNode)
                    : this.createEdgeTube(sourceNode, targetNode);
                if (edgeLine) {
                    edgeLine.userData = {
                        source: sourceNode.userData.id,
                        target: targetNode.userData.id,
                    };
                    this.edges.push(edgeLine);
                    this.scene.add(edgeLine);
                }
            }
        });
    }

    /**
     * A simple line (THREE.Line) from the new snippet.
     * Good for timeline / radial.
     */
    createEdgeLineBasic(sourceNode, targetNode) {
        const points = [
            sourceNode.position.clone(),
            targetNode.position.clone(),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x30363d,
            transparent: true,
            opacity: 0.6,
        });
        return new THREE.Line(geometry, material);
    }

    /**
     * A curved tube edge from the old snippet
     * used for non-timeline visualizations (tree, linear).
     */
    createEdgeTube(sourceNode, targetNode, isTimeline = false) {
        const points = [];
        points.push(sourceNode.position.clone());

        if (isTimeline) {
            // Straight line
            points.push(targetNode.position.clone());
        } else {
            // Curved line
            const mid = sourceNode.position
                .clone()
                .add(targetNode.position)
                .multiplyScalar(0.5);
            mid.y += 5;
            points.push(mid);
            points.push(targetNode.position.clone());
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(curve, 20, 0.2, 8, false);
        const material = new THREE.MeshPhongMaterial({
            color: 0x30363d,
            transparent: true,
            opacity: 0.6,
        });
        const edge = new THREE.Mesh(geometry, material);
        return edge;
    }

    // -----------------------
    // BRANCH EXPAND / COLLAPSE
    // -----------------------

    async expandBranch(branchNode) {
        if (!branchNode.userData.expanded) {
            const commits = branchNode.userData.commits;
            const radius = 10;
            const angleStep = (2 * Math.PI) / commits.length;

            for (let i = 0; i < commits.length; i++) {
                const angle = i * angleStep;
                const position = new THREE.Vector3(
                    branchNode.position.x + Math.cos(angle) * radius,
                    branchNode.position.y + i * 3,
                    branchNode.position.z + Math.sin(angle) * radius
                );

                const commitNode = this.createCommitNode(commits[i], position);
                this.nodes.push(commitNode);
                this.scene.add(commitNode);
            }

            branchNode.userData.expanded = true;
            this.expandedBranches.add(branchNode.userData.name);
        }
    }

    async collapseBranch(branchNode) {
        if (branchNode.userData.expanded) {
            const branchCommits = branchNode.userData.commits;
            this.nodes = this.nodes.filter((node) => {
                if (
                    node.userData.type === 'commit' &&
                    branchCommits.find((c) => c.id === node.userData.id)
                ) {
                    this.scene.remove(node);
                    return false;
                }
                return true;
            });
            branchNode.userData.expanded = false;
            this.expandedBranches.delete(branchNode.userData.name);
        }
    }

    // -----------------------
    // ANALYSIS METHODS
    // (from old snippet, if you want GPT integration)
    // -----------------------

    async analyzeBranch(branchName, commits) {
        const cacheKey = `branch-${branchName}`;
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey);
        }

        this.showLoading('Analyzing branch...');
        try {
            const prompt = `Analyze this Git branch:\nBranch: ${branchName}\n` +
                `Commits:\n${commits.map((c) => c.data.message).join('\n')}\n\n` +
                `Provide a concise summary of:\n` +
                `1. The branch's main purpose\n` +
                `2. Key code changes and evolution\n` +
                `3. Impact on the codebase`;

            const analysis = await this.getGPTAnalysis(prompt);
            this.analysisCache.set(cacheKey, analysis);
            return analysis;
        } catch (error) {
            console.error('Branch analysis error:', error);
            return 'Analysis failed';
        } finally {
            this.hideLoading();
        }
    }

    async analyzeCommitRelationships(node, connectedNodes) {
        const ids = [node.userData.id, ...connectedNodes.map((n) => n.userData.id)].sort();
        const cacheKey = `relationship-${ids.join('-')}`;

        if (this.relationshipAnalysisCache.has(cacheKey)) {
            return this.relationshipAnalysisCache.get(cacheKey);
        }

        this.showLoading('Analyzing relationships...');
        try {
            const commits = [node, ...connectedNodes].map((n) => ({
                message: n.userData.data.message,
                author: n.userData.data.author,
                date: n.userData.data.date,
                files: n.userData.data.files_changed || [],
            }));

            const prompt = `Analyze these related Git commits and explain their relationship:\n` +
                `${JSON.stringify(commits, null, 2)}\n\n` +
                `Explain:\n` +
                `1. How these commits are related\n` +
                `2. The progression of changes\n` +
                `3. The technical impact of these changes together`;

            const analysis = await this.getGPTAnalysis(prompt);
            this.relationshipAnalysisCache.set(cacheKey, analysis);
            return analysis;
        } catch (error) {
            console.error('Relationship analysis error:', error);
            return 'Analysis failed';
        } finally {
            this.hideLoading();
        }
    }


    // Add these methods to your TreeVisualizer class

    async showCodeDiff(commitData) {
        // Remove any existing diff panel
        const existingPanel = document.querySelector('.code-diff-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        // Create new panel
        const panel = document.createElement('div');
        panel.className = 'code-diff-panel';
        panel.innerHTML = `
            <div class="diff-header">
                <div class="diff-header-content">
                    <h3>${commitData.message}</h3>
                    <div>Author: ${commitData.author}</div>
                    <div>Date: ${new Date(commitData.date).toLocaleString()}</div>
                </div>
                <button class="close-btn">×</button>
            </div>
            <div class="diff-content"></div>
        `;

        // Add close button functionality
        const closeBtn = panel.querySelector('.close-btn');
        closeBtn.onclick = () => panel.remove();

        // Add diff content for each changed file
        const diffContent = panel.querySelector('.diff-content');
        for (const file of commitData.files_changed) {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'diff-file';
            fileDiv.innerHTML = `
                <div class="diff-file-header">${file}</div>
                <div class="diff-content">
                    <pre>${await this.getFileDiff(file, commitData)}</pre>
                </div>
            `;
            diffContent.appendChild(fileDiv);
        }

        this.container.appendChild(panel);
        panel.style.display = 'block';
    }

    async getFileDiff(file, commitData) {
        try {
            const response = await fetch(`${this.baseUrl}/diff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    owner: commitData.owner,
                    repo: commitData.repo,
                    commit: commitData.sha,
                    file: file
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch diff');
            }

            const diff = await response.json();
            return this.formatDiff(diff.content);
        } catch (error) {
            console.error('Error fetching diff:', error);
            return 'Unable to load diff content';
        }
    }

    formatDiff(diffContent) {
        if (!diffContent) return 'No diff content available';

        return diffContent.split('\n').map(line => {
            if (line.startsWith('+')) {
                return `<div class="diff-line diff-line-add">${this.escapeHtml(line)}</div>`;
            } else if (line.startsWith('-')) {
                return `<div class="diff-line diff-line-del">${this.escapeHtml(line)}</div>`;
            }
            return `<div class="diff-line">${this.escapeHtml(line)}</div>`;
        }).join('\n');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    async getGPTAnalysis(prompt) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${window.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 200,
                }),
            });

            if (!response.ok) {
                throw new Error(`GPT API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('GPT analysis error:', error);
            return 'Analysis unavailable';
        }
    }

    // -----------------------
    // EVENT HANDLERS
    // -----------------------

    handleMouseMove(event) {
        if (this.isAnalyzing) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObjects(this.nodes);

        if (intersects.length > 0) {
            const node = intersects[0].object;
            if (this.hoveredNode !== node) {
                if (this.hoveredNode) {
                    this.unhighlightNode(this.hoveredNode);
                }
                this.hoveredNode = node;
                this.highlightNode(node);
                this.showNodeTooltip(node, event);
            }
            this.renderer.domElement.style.cursor = 'pointer';
        } else {
            if (this.hoveredNode) {
                this.unhighlightNode(this.hoveredNode);
                this.hoveredNode = null;
                this.hideTooltip();
            }
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    async handleClick(event) {
        if (this.hoveredNode) {
            if (this.hoveredNode.userData.type === 'branch') {
                await this.toggleBranch(this.hoveredNode);
            } else {
                // Show both commit details and code diff
                await this.showCommitDetails(this.hoveredNode);
                await this.showCodeDiff(this.hoveredNode.userData.data);
            }
        }
    }

    async handleDoubleClick() {
        if (this.hoveredNode && this.hoveredNode.userData.type === 'commit') {
            await this.showCodeEvolution(this.hoveredNode);
        }
    }

    // -----------------------
    // BRANCH TOGGLE
    // -----------------------

    async toggleBranch(branchNode) {
        if (branchNode.userData.expanded) {
            await this.collapseBranch(branchNode);
        } else {
            await this.expandBranch(branchNode);
        }
        this.updateEdgePositions();
    }

    // -----------------------
    // COMMIT DETAIL POPUP
    // -----------------------

    async showCommitDetails(node) {
        this.showLoading('Loading commit details...');
        try {
            let details = '';
            const data = node.userData.data;

            if (node.userData.type === 'branch') {
                const analysis = await this.analyzeBranch(
                    node.userData.name,
                    node.userData.commits
                );
                details = `
                    <h3>${node.userData.name} Branch</h3>
                    <div class="commit-count">${
                        node.userData.commits.length
                    } commits</div>
                    <div class="analysis">${analysis}</div>
                    <div class="action-hint">Click to ${
                        node.userData.expanded ? 'collapse' : 'expand'
                    } branch</div>
                `;
            } else {
                const connectedNodes = this.findConnectedNodes(node);
                const relationshipAnalysis = await this.analyzeCommitRelationships(
                    node,
                    connectedNodes
                );
                details = `
                    <h3>Commit Details</h3>
                    <div class="commit-info">
                        <div class="message">${data.message}</div>
                        <div class="author">Author: ${data.author}</div>
                        <div class="date">Date: ${new Date(
                            data.date
                        ).toLocaleString()}</div>
                        <div class="files">Files Changed: ${
                            data.files_changed?.length || 0
                        }</div>
                    </div>
                    <div class="relationship-analysis">
                        <h4>Change Context</h4>
                        ${relationshipAnalysis}
                    </div>
                    <div class="action-hint">Double-click to view code evolution</div>
                `;
            }

            this.showAnalysisPanel(details);
        } finally {
            this.hideLoading();
        }
    }

    // -----------------------
    // CODE EVOLUTION (double-click)
    // -----------------------

    async showCodeEvolution(commitNode) {
        this.showLoading('Analyzing code evolution...');
        try {
            const data = commitNode.userData.data;
            const files = data.files_changed || [];

            // Gather file-specific analysis
            const fileAnalyses = await Promise.all(
                files.map(async (file) => {
                    const prompt = `Analyze this file change in commit "${data.message}":\n` +
                        `File: ${file}\n\n` +
                        `Explain:\n` +
                        `1. What changed in this file\n` +
                        `2. The technical impact of these changes\n` +
                        `3. How this affects the codebase`;

                    return {
                        file,
                        analysis: await this.getGPTAnalysis(prompt),
                    };
                })
            );

            const content = `
                <h3>Code Evolution Analysis</h3>
                <div class="commit-info">
                    <div class="message">${data.message}</div>
                    <div class="author">Author: ${data.author}</div>
                    <div class="date">${new Date(data.date).toLocaleString()}</div>
                </div>
                <div class="file-analyses">
                    ${fileAnalyses
                        .map(
                            ({ file, analysis }) => `
                        <div class="file-analysis">
                            <h4>${file}</h4>
                            <div class="analysis">${analysis}</div>
                        </div>
                    `
                        )
                        .join('')}
                </div>
            `;
            this.showAnalysisPanel(content);
        } finally {
            this.hideLoading();
        }
    }

    // -----------------------
    // TOOLTIP / HIGHLIGHT
    // -----------------------

    showNodeTooltip(node, event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        let content = '';

        if (node.userData.type === 'branch') {
            content = `
                <div class="branch-name">${node.userData.name}</div>
                <div class="commit-count">${node.userData.commits.length} commits</div>
            `;
        } else {
            const data = node.userData.data;
            content = `
                <div class="commit-message">${data.message}</div>
                <div class="commit-author">${data.author}</div>
                <div class="commit-date">${new Date(data.date).toLocaleDateString()}</div>
            `;
        }

        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${event.clientX - rect.left + 10}px`;
        this.tooltip.style.top = `${event.clientY - rect.top + 10}px`;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    highlightNode(node) {
        const originalColor = node.material.color.getHex();
        node.userData.originalColor = originalColor;
        node.material.color.setHex(0x58a6ff);
        node.material.opacity = 1;

        // Highlight connected
        const connectedNodes = this.findConnectedNodes(node);
        connectedNodes.forEach((connectedNode) => {
            connectedNode.userData.originalColor = connectedNode.material.color.getHex();
            connectedNode.material.color.setHex(0x58a6ff);
            connectedNode.material.opacity = 0.8;
        });

        // Highlight connecting edges
        this.highlightConnectingEdges(node, connectedNodes);
    }

    unhighlightNode(node) {
        if (node.userData.originalColor) {
            node.material.color.setHex(node.userData.originalColor);
            node.material.opacity = 0.8;
        }

        // Reset connected
        const connectedNodes = this.findConnectedNodes(node);
        connectedNodes.forEach((connectedNode) => {
            if (connectedNode.userData.originalColor) {
                connectedNode.material.color.setHex(connectedNode.userData.originalColor);
                connectedNode.material.opacity = 0.8;
            }
        });

        // Reset edge colors
        this.resetEdgeColors();
    }

    findConnectedNodes(node) {
        return this.nodes.filter((n) =>
            this.edges.some(
                (e) =>
                    (e.userData.source === node.userData.id &&
                        e.userData.target === n.userData.id) ||
                    (e.userData.target === node.userData.id &&
                        e.userData.source === n.userData.id)
            )
        );
    }

    highlightConnectingEdges(node, connectedNodes) {
        const connectedIds = new Set([
            node.userData.id,
            ...connectedNodes.map((n) => n.userData.id),
        ]);

        this.edges.forEach((edge) => {
            if (
                edge.userData.source &&
                edge.userData.target &&
                connectedIds.has(edge.userData.source) &&
                connectedIds.has(edge.userData.target)
            ) {
                edge.material.color.setHex(0x58a6ff);
                edge.material.opacity = 1;
            }
        });
    }

    resetEdgeColors() {
        this.edges.forEach((edge) => {
            edge.material.color.setHex(0x30363d);
            edge.material.opacity = 0.6;
        });
    }

    // -----------------------
    // EDGE POSITION UPDATE
    // (needed when we move branches up/down)
    // -----------------------
    updateEdgePositions() {
        this.edges.forEach((edge) => {
            if (!edge.userData.source || !edge.userData.target) return;

            const sourceNode = this.findNodeById(edge.userData.source);
            const targetNode = this.findNodeById(edge.userData.target);

            if (sourceNode && targetNode) {
                // If it's a THREE.Line (lineBasic), we do a simpler approach
                if (edge.isLine) {
                    const points = [
                        sourceNode.position.clone(),
                        targetNode.position.clone(),
                    ];
                    edge.geometry.dispose();
                    edge.geometry = new THREE.BufferGeometry().setFromPoints(points);
                } else {
                    // If it's a tube geometry, recalc
                    const points = [];
                    points.push(sourceNode.position.clone());
                    const mid = sourceNode.position
                        .clone()
                        .add(targetNode.position)
                        .multiplyScalar(0.5);
                    mid.y += 5;
                    points.push(mid);
                    points.push(targetNode.position.clone());

                    const curve = new THREE.CatmullRomCurve3(points);
                    edge.geometry.dispose();
                    edge.geometry = new THREE.TubeGeometry(curve, 20, 0.2, 8, false);
                }
            }
        });
    }

    // -----------------------
    // HELPER: find node by ID
    // -----------------------
    findNodeById(id) {
        return this.nodes.find((node) => node.userData.id === id);
    }

    // -----------------------
    // COLORS
    // -----------------------
    getBranchColor(branchName) {
        if (branchName === 'master' || branchName === 'main') {
            return 0x58a6ff; // Blue for main
        }
        // Generate a deterministic color
        let hash = 0;
        for (let i = 0; i < branchName.length; i++) {
            hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = Math.abs(hash) % 0xffffff;
        return color;
    }

    getCommitColor(commitData) {
        if (commitData.data && commitData.data.is_merge) {
            return 0xff4444; // Red for merge commits
        }
        return commitData.data && commitData.data.branch === 'master'
            ? 0x58a6ff
            : 0x2ea44f;
    }

    // -----------------------
    // ANALYSIS PANEL
    // -----------------------
    showAnalysisPanel(content) {
        this.analysisPanel.innerHTML = content;
        this.analysisPanel.style.display = 'block';
    }

    // -----------------------
    // LOADING INDICATOR
    // -----------------------
    showLoading(message = 'Loading...') {
        const loadingText = this.loadingIndicator.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        this.loadingIndicator.style.display = 'block';
        this.isAnalyzing = true;
    }

    hideLoading() {
        this.loadingIndicator.style.display = 'none';
        this.isAnalyzing = false;
    }

    // -----------------------
    // CLEAR THE VISUALIZATION
    // -----------------------
    clearVisualization() {
        // Remove existing nodes
        this.nodes.forEach((node) => {
            this.scene.remove(node);
            if (node.geometry) node.geometry.dispose();
            if (node.material) node.material.dispose();
        });

        // Remove existing edges
        this.edges.forEach((edge) => {
            this.scene.remove(edge);
            if (edge.geometry) edge.geometry.dispose();
            if (edge.material) edge.material.dispose();
        });

        // Reset data structures
        this.nodes = [];
        this.edges = [];
        this.branchNodes.clear();
        this.hoveredNode = null;
        this.selectedNode = null;

        // Hide UI
        this.hideTooltip();
        this.hideLoading();
        this.analysisPanel.style.display = 'none';
    }

    // -----------------------
    // ZOOM TO FIT
    // -----------------------
    zoomToFit() {
        if (this.nodes.length === 0) return;

        const box = new THREE.Box3();
        this.nodes.forEach((node) => box.expandByObject(node));

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        // Add some padding
        cameraZ *= 1.5;

        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        this.camera.updateProjectionMatrix();

        // Update controls target
        this.controls.target.copy(center);
        this.controls.update();
    }

    // -----------------------
    // ANIMATION LOOP
    // -----------------------
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        if (this.controls) {
            this.controls.update();
        }
        if (this.labelRenderer) {
            this.labelRenderer.render(this.scene, this.camera);
        }
        this.renderer.render(this.scene, this.camera);
    }

    // -----------------------
    // DISPOSAL
    // -----------------------
    dispose() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
        this.renderer.domElement.removeEventListener(
            'mousemove',
            this.handleMouseMove.bind(this)
        );
        this.renderer.domElement.removeEventListener(
            'click',
            this.handleClick.bind(this)
        );
        this.renderer.domElement.removeEventListener(
            'dblclick',
            this.handleDoubleClick.bind(this)
        );

        // Dispose of objects
        this.clearVisualization();

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }
        if (this.labelRenderer) {
            this.labelRenderer.domElement.remove();
        }

        // Remove UI
        if (this.analysisPanel) this.analysisPanel.remove();
        if (this.tooltip) this.tooltip.remove();
        if (this.loadingIndicator) this.loadingIndicator.remove();

        // Clear references
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.labelRenderer = null;
        this.controls = null;
    }
}

export default TreeVisualizer;
