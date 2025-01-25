import networkx as nx
from typing import Dict, List, Any, Optional
import numpy as np
from datetime import datetime
import logging
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GraphProcessor:
    def __init__(self, graph: nx.DiGraph):
        """
        Initialize the GraphProcessor with a NetworkX DiGraph.
        
        Args:
            graph (nx.DiGraph): The directed graph to process
        """
        self.graph = graph
        self.layout = None
        logger.info(f"Initialized GraphProcessor with graph containing {self.graph.number_of_nodes()} nodes")

    def process_for_visualization(self) -> Dict:
        """
        Process the graph for visualization.
        
        Returns:
            Dict: Processed data including nodes, edges, and metrics
        """
        try:
            logger.info("Starting graph processing for visualization")
            
            if not isinstance(self.graph, nx.DiGraph):
                raise ValueError("Input must be a NetworkX DiGraph")
            
            if self.graph.number_of_nodes() == 0:
                logger.warning("Empty graph provided")
                return {
                    'nodes': [],
                    'edges': [],
                    'metrics': self._calculate_metrics()
                }

            # Calculate layout
            self.layout = self._calculate_layout()
            logger.info("Layout calculation completed")

            # Process nodes and edges
            nodes = self._process_nodes()
            edges = self._process_edges()
            
            # Calculate metrics
            metrics = self._calculate_metrics()
            
            logger.info(f"Processed {len(nodes)} nodes and {len(edges)} edges")
            
            return {
                'nodes': nodes,
                'edges': edges,
                'metrics': metrics
            }
            
        except Exception as e:
            logger.error(f"Error in process_for_visualization: {str(e)}")
            raise

    def _calculate_layout(self) -> Dict[str, Dict[str, float]]:
        """
        Calculate the layout positions for all nodes.
        
        Returns:
            Dict: Node positions in 3D space
        """
        try:
            # Find root nodes (nodes with no incoming edges)
            roots = [n for n in self.graph.nodes() if self.graph.in_degree(n) == 0]
            if not roots:
                # If no root found, use node with minimum in-degree
                roots = [min(self.graph.nodes(), key=lambda n: self.graph.in_degree(n))]
            
            # Calculate levels based on longest path from any root
            levels = {}
            for node in self.graph.nodes():
                max_distance = 0
                for root in roots:
                    try:
                        distance = nx.shortest_path_length(self.graph, root, node)
                        max_distance = max(max_distance, distance)
                    except nx.NetworkXNoPath:
                        continue
                levels[node] = max_distance

            # Create a temporary graph for layout calculation
            temp_graph = self.graph.copy()
            for node in temp_graph.nodes():
                temp_graph.nodes[node]['subset'] = levels[node]

            # Calculate initial layout
            pos = nx.multipartite_layout(temp_graph, subset_key='subset', scale=100)

            # Convert to 3D coordinates with proper scaling
            layout_3d = {}
            for node, pos_2d in pos.items():
                layout_3d[node] = {
                    'x': float(pos_2d[0]),
                    'y': float(pos_2d[1]),
                    'z': float(levels[node] * 10)  # Use level for Z-coordinate
                }

            logger.info("Layout calculation successful")
            return layout_3d

        except Exception as e:
            logger.error(f"Error in _calculate_layout: {str(e)}")
            raise

    def _process_nodes(self) -> List[Dict[str, Any]]:
        """
        Process nodes with their positions and attributes.
        
        Returns:
            List[Dict]: Processed node data
        """
        try:
            nodes = []
            for node in self.graph.nodes():
                node_data = self.graph.nodes[node]
                position = self.layout[node]
                
                # Process node attributes with defaults
                processed_node = {
                    'id': node,
                    'position': position,
                    'data': {
                        'message': node_data.get('message', ''),
                        'author': node_data.get('author', ''),
                        'date': node_data.get('date', datetime.now()).isoformat() 
                               if isinstance(node_data.get('date'), datetime) else '',
                        'files_count': node_data.get('files_count', 0),
                        'is_initial': node_data.get('is_initial', False),
                        'is_merge': self.graph.in_degree(node) > 1,
                        'files_changed': node_data.get('files_changed', []),
                        'analysis': node_data.get('analysis', '')
                    }
                }
                nodes.append(processed_node)
            
            return nodes

        except Exception as e:
            logger.error(f"Error in _process_nodes: {str(e)}")
            raise

    def _process_edges(self) -> List[Dict[str, Any]]:
        """
        Process edges with their positions and attributes.
        
        Returns:
            List[Dict]: Processed edge data
        """
        try:
            edges = []
            for source, target in self.graph.edges():
                # Get positions for source and target nodes
                source_pos = self.layout[source]
                target_pos = self.layout[target]
                
                # Calculate control point for curved edges
                control_point = self._calculate_control_point(source_pos, target_pos)
                
                edge_data = {
                    'source': source,
                    'target': target,
                    'controlPoint': control_point,
                    'data': {
                        'is_merge': self.graph.in_degree(target) > 1
                    }
                }
                edges.append(edge_data)
            
            return edges

        except Exception as e:
            logger.error(f"Error in _process_edges: {str(e)}")
            raise

    def _calculate_control_point(self, source_pos: Dict[str, float], 
                               target_pos: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate a control point for curved edges.
        
        Args:
            source_pos: Source node position
            target_pos: Target node position
            
        Returns:
            Dict: Control point coordinates
        """
        # Calculate midpoint
        mid_x = (source_pos['x'] + target_pos['x']) / 2
        mid_y = (source_pos['y'] + target_pos['y']) / 2
        mid_z = (source_pos['z'] + target_pos['z']) / 2
        
        # Add offset for curvature
        offset = 20
        return {
            'x': mid_x + offset,
            'y': mid_y,
            'z': mid_z
        }

    def _calculate_metrics(self) -> Dict[str, Any]:
        """
        Calculate various graph metrics.
        
        Returns:
            Dict: Calculated metrics
        """
        try:
            if not list(self.graph.nodes()):
                return {
                    'total_commits': 0,
                    'max_depth': 0,
                    'branching_factor': 0,
                    'leaf_commits': 0,
                    'merge_commits': 0,
                    'average_branch_length': 0,
                    'commit_frequency': {}
                }

            # Calculate basic metrics
            total_commits = self.graph.number_of_nodes()
            merge_commits = sum(1 for n in self.graph.nodes() if self.graph.in_degree(n) > 1)
            leaf_commits = sum(1 for n in self.graph.nodes() if self.graph.out_degree(n) == 0)
            
            # Calculate max depth
            roots = [n for n in self.graph.nodes() if self.graph.in_degree(n) == 0]
            max_depth = 0
            for root in roots:
                try:
                    depths = nx.shortest_path_length(self.graph, source=root).values()
                    if depths:
                        max_depth = max(max_depth, max(depths))
                except nx.NetworkXError:
                    continue

            # Calculate average branch length
            paths = self._calculate_all_branch_paths()
            avg_branch_length = sum(len(path) for path in paths) / max(len(paths), 1)

            # Calculate commit frequency by author
            commit_frequency = defaultdict(int)
            for node in self.graph.nodes():
                author = self.graph.nodes[node].get('author', 'Unknown')
                commit_frequency[author] += 1

            return {
                'total_commits': total_commits,
                'max_depth': max_depth,
                'branching_factor': total_commits / max(1, total_commits - merge_commits),
                'leaf_commits': leaf_commits,
                'merge_commits': merge_commits,
                'average_branch_length': avg_branch_length,
                'commit_frequency': dict(commit_frequency)
            }

        except Exception as e:
            logger.error(f"Error in _calculate_metrics: {str(e)}")
            raise

    def _calculate_all_branch_paths(self) -> List[List[str]]:
        """
        Calculate all unique paths from root to leaf nodes.
        
        Returns:
            List[List[str]]: List of paths
        """
        try:
            roots = [n for n in self.graph.nodes() if self.graph.in_degree(n) == 0]
            leaves = [n for n in self.graph.nodes() if self.graph.out_degree(n) == 0]
            
            all_paths = []
            for root in roots:
                for leaf in leaves:
                    try:
                        paths = list(nx.all_simple_paths(self.graph, root, leaf))
                        all_paths.extend(paths)
                    except nx.NetworkXNoPath:
                        continue
            
            return all_paths

        except Exception as e:
            logger.error(f"Error in _calculate_all_branch_paths: {str(e)}")
            return []