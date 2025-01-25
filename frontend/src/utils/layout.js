import * as d3 from 'd3-force-3d';
import { Vector3 } from 'three';

export class ForceDirectedLayout {
    constructor() {
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.onTick = null;
        
        this.settings = {
            charge: -30,
            linkDistance: 30,
            gravity: 0.1,
            friction: 0.9,
            collideRadius: 2,
            centerStrength: 1
        };
    }
    
    initializeLayout(nodes, links, onTick = null) {
        this.nodes = nodes;
        this.links = links;
        this.onTick = onTick;
        
        // Initialize D3 force simulation
        this.simulation = d3.forceSimulation(nodes)
            .force('charge', d3.forceManyBody().strength(this.settings.charge))
            .force('link', d3.forceLink(links).distance(this.settings.linkDistance))
            .force('center', d3.forceCenter(0, 0, 0).strength(this.settings.centerStrength))
            .force('collide', d3.forceCollide(this.settings.collideRadius))
            .velocityDecay(this.settings.friction);
            
        // Add tick event handler
        this.simulation.on('tick', () => this.tick());
    }
    
    tick() {
        // Update node positions
        this.nodes.forEach(node => {
            if (!node.fixed) {
                node.position.x += (node.x - node.position.x) * 0.1;
                node.position.y += (node.y - node.position.y) * 0.1;
                node.position.z += (node.z - node.position.z) * 0.1;
            }
        });
        
        // Call external tick handler if provided
        if (this.onTick) {
            this.onTick();
        }
    }
    
    setCharge(value) {
        this.settings.charge = value;
        if (this.simulation) {
            this.simulation.force('charge').strength(value);
            this.simulation.alpha(1).restart();
        }
    }
    
    setLinkDistance(value) {
        this.settings.linkDistance = value;
        if (this.simulation) {
            this.simulation.force('link').distance(value);
            this.simulation.alpha(1).restart();
        }
    }
    
    setGravity(value) {
        this.settings.centerStrength = value;
        if (this.simulation) {
            this.simulation.force('center').strength(value);
            this.simulation.alpha(1).restart();
        }
    }
    
    setFriction(value) {
        this.settings.friction = value;
        if (this.simulation) {
            this.simulation.velocityDecay(value);
            this.simulation.alpha(1).restart();
        }
    }
    
    updateNodePosition(nodeId, position) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.fx = position.x;
            node.fy = position.y;
            node.fz = position.z;
            node.fixed = true;
            this.simulation.alpha(1).restart();
        }
    }
    
    releaseNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.fx = null;
            node.fy = null;
            node.fz = null;
            node.fixed = false;
            this.simulation.alpha(1).restart();
        }
    }
    
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
        this.nodes = [];
        this.links = [];
    }
}