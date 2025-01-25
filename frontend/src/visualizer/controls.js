import * as dat from 'dat.gui';
import * as THREE from 'three';    // Ensure you import THREE if you use new THREE.Vector3()

export function setupControls(visualizer) {
    const gui = new dat.GUI();
    
    // Layout controls
    const layoutFolder = gui.addFolder('Layout Settings');
    const layoutSettings = {
        charge: -30,
        linkDistance: 30,
        gravity: 0.1,
        friction: 0.9,
        alpha: 0.1,
        alphaDecay: 0.0228,
        alphaMin: 0.001,
        velocityDecay: 0.4,
        centerStrength: 0.1
    };
    
    layoutFolder
        .add(layoutSettings, 'charge', -100, 0)
        .onChange(value => {
            visualizer.layout.setCharge(value);
        });
    
    layoutFolder
        .add(layoutSettings, 'linkDistance', 10, 100)
        .onChange(value => {
            visualizer.layout.setLinkDistance(value);
        });
    
    layoutFolder
        .add(layoutSettings, 'gravity', 0, 1)
        .onChange(value => {
            visualizer.layout.setGravity(value);
        });
    
    layoutFolder
        .add(layoutSettings, 'friction', 0, 1)
        .onChange(value => {
            visualizer.layout.setFriction(value);
        });
    
    // Visualization controls
    const visualFolder = gui.addFolder('Visual Settings');
    const visualSettings = {
        nodeSize: 1,
        edgeThickness: 0.1,
        labelSize: 1,
        showLabels: true
    };
    
    visualFolder
        .add(visualSettings, 'nodeSize', 0.1, 3)
        .onChange(value => {
            // Example usage: scale existing nodes
            visualizer.nodes.forEach(node => {
                node.scale.setScalar(value);
            });
        });
    
    visualFolder
        .add(visualSettings, 'edgeThickness', 0.01, 0.5)
        .onChange(value => {
            // Example usage: if edges are TubeGeometry
            visualizer.edges.forEach(edge => {
                if (edge.geometry && edge.userData && edge.userData.curve) {
                    edge.geometry.dispose();
                    edge.geometry = new THREE.TubeGeometry(
                        edge.userData.curve,
                        20,
                        value,
                        8,
                        false
                    );
                }
            });
        });
    
    visualFolder
        .add(visualSettings, 'labelSize', 0.1, 2)
        .onChange(value => {
            const labels = document.querySelectorAll('.node-label');
            labels.forEach(label => {
                label.style.transform = `scale(${value})`;
            });
        });
    
    visualFolder
        .add(visualSettings, 'showLabels')
        .onChange(value => {
            const labels = document.querySelectorAll('.node-label');
            labels.forEach(label => {
                label.style.display = value ? 'block' : 'none';
            });
        });
    
    // Camera controls
    const cameraFolder = gui.addFolder('Camera Settings');
    const cameraSettings = {
        autoRotate: false,
        rotateSpeed: 1,
        zoomSpeed: 1,
        reset: () => resetCamera()
    };
    
    cameraFolder
        .add(cameraSettings, 'autoRotate')
        .onChange(value => {
            visualizer.controls.autoRotate = value;
        });
    
    cameraFolder
        .add(cameraSettings, 'rotateSpeed', 0.1, 5)
        .onChange(value => {
            visualizer.controls.rotateSpeed = value;
        });
    
    cameraFolder
        .add(cameraSettings, 'zoomSpeed', 0.1, 5)
        .onChange(value => {
            visualizer.controls.zoomSpeed = value;
        });
    
    cameraFolder.add(cameraSettings, 'reset');
    
    function resetCamera() {
        visualizer.camera.position.set(0, 0, 100);
        visualizer.camera.lookAt(new THREE.Vector3(0, 0, 0));
        visualizer.controls.reset();
    }
    
    // Filter controls
    const filterFolder = gui.addFolder('Filters');
    const filterSettings = {
        showMergeCommits: true,
        showInitialCommit: true,
        minFilesChanged: 0,
        maxFilesChanged: 100,
        dateRange: [null, null],
        authorFilter: ''
    };
    
    filterFolder
        .add(filterSettings, 'showMergeCommits')
        .onChange(value => {
            visualizer.filterNodes('merge', value);
        });
    
    filterFolder
        .add(filterSettings, 'showInitialCommit')
        .onChange(value => {
            visualizer.filterNodes('initial', value);
        });
    
    filterFolder
        .add(filterSettings, 'minFilesChanged', 0, 100)
        .onChange(value => {
            visualizer.filterByFileCount(value, filterSettings.maxFilesChanged);
        });
    
    filterFolder
        .add(filterSettings, 'maxFilesChanged', 0, 100)
        .onChange(value => {
            visualizer.filterByFileCount(filterSettings.minFilesChanged, value);
        });
    
    filterFolder
        .add(filterSettings, 'authorFilter')
        .onChange(value => {
            visualizer.filterByAuthor(value);
        });
    
    // Performance controls
    const performanceFolder = gui.addFolder('Performance');
    const performanceSettings = {
        enableFog: false,
        shadows: false,
        antiAlias: true,
        particleCount: 1000
    };
    
    performanceFolder
        .add(performanceSettings, 'enableFog')
        .onChange(value => {
            visualizer.scene.fog = value ? new THREE.Fog(0x000000, 1, 1000) : null;
        });
    
    performanceFolder
        .add(performanceSettings, 'shadows')
        .onChange(value => {
            visualizer.renderer.shadowMap.enabled = value;
            visualizer.updateShadows();
        });
    
    performanceFolder
        .add(performanceSettings, 'antiAlias')
        .onChange(value => {
            visualizer.setAntiAlias(value);
        });
    
    // Enable the two-finger manual move
    enableTwoFingerMove(visualizer);
    
    // Open the layout folder by default
    layoutFolder.open();
    
    return gui;
}

/**
 * Enables a custom two-finger gesture on mobile/touch devices:
 * - If you pinch in/out with 2 fingers, we detect distance changes
 * - We move the camera along its forward vector (rather than a standard 'zoom')
 */
function enableTwoFingerMove(visualizer) {
    let previousDistance = 0;
    
    function onTouchMove(event) {
        // Only if exactly 2 touches are active
        if (event.touches.length === 2) {
            event.preventDefault(); // prevent default pinch-zoom on mobile
            const [touch1, touch2] = event.touches;
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (previousDistance) {
                // Positive delta => move forward, negative => move back
                const delta = distance - previousDistance;
                
                // Move camera along its forward direction
                const direction = visualizer.camera
                    .getWorldDirection(new THREE.Vector3())
                    .normalize();
                
                // Scale factor to control movement speed
                const factor = 0.05;
                
                // Move the camera
                visualizer.camera.position.add(direction.multiplyScalar(delta * factor));
            }
            previousDistance = distance;
        }
    }
    
    function onTouchEnd() {
        // Reset distance when finger(s) lifted
        if (visualizer.renderer.domElement.touches?.length < 2) {
            previousDistance = 0;
        }
    }
    
    // Attach events
    // Make sure 'passive' is false so we can preventDefault
    visualizer.renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    visualizer.renderer.domElement.addEventListener('touchend', onTouchEnd, false);
    visualizer.renderer.domElement.addEventListener('touchcancel', onTouchEnd, false);
}
