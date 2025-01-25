import networkx as nx
from datetime import datetime
import aiohttp
import asyncio
from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class CommitNode:
    sha: str
    message: str
    author: str
    date: datetime
    files_changed: List[str]
    parent_shas: List[str]
    children_shas: List[str]
    analysis: str
    files_count: int
    is_initial: bool

class RepositoryAnalyzer:
    def __init__(self, github_token: str, openai_key: str):
        self.github_token = github_token
        self.openai_key = openai_key
        self.headers = {
            'Authorization': f'Bearer {github_token}',
            'Accept': 'application/vnd.github+json'
        }
        self.commit_graph = nx.DiGraph()

    async def _fetch_commits(self, session: aiohttp.ClientSession, owner: str, repo: str, limit: int) -> List[Dict]:
        """Fetches commit history from GitHub API"""
        url = f'https://api.github.com/repos/{owner}/{repo}/commits?per_page={limit}'
        async with session.get(url, headers=self.headers) as response:
            if response.status != 200:
                error_data = await response.text()
                raise Exception(f'Failed to fetch commits: {error_data}')
            return await response.json()

    async def analyze_repository(self, owner: str, repo: str, limit: int = 50) -> nx.DiGraph:
        """
        Analyzes a repository and builds a directed graph of commits.
        Returns a NetworkX DiGraph representing the commit history.
        """
        try:
            async with aiohttp.ClientSession() as session:
                # Reset the graph for new analysis
                self.commit_graph = nx.DiGraph()
                
                # Fetch commits
                commits = await self._fetch_commits(session, owner, repo, limit)
                
                if not commits:
                    print(f"No commits found for repository {owner}/{repo}")
                    return self.commit_graph
                
                # Build initial graph structure
                for commit in commits:
                    sha = commit['sha']
                    parent_shas = [p['sha'] for p in commit['parents']]
                    
                    # Add nodes and edges
                    self.commit_graph.add_node(sha, 
                        message=commit['commit']['message'],
                        author=commit['commit']['author']['name'],
                        date=datetime.fromisoformat(commit['commit']['author']['date'].replace('Z', '+00:00')),
                        is_initial=len(parent_shas) == 0
                    )
                    
                    # Add edges from parents to this commit
                    for parent_sha in parent_shas:
                        if parent_sha in [c['sha'] for c in commits]:  # Only add edge if parent is in our commit list
                            self.commit_graph.add_edge(parent_sha, sha)
                
                # Fetch detailed commit data and analyze in parallel
                await self._analyze_commits(session, commits)
                
                return self.commit_graph
                
        except Exception as e:
            print(f"Error analyzing repository: {str(e)}")
            return nx.DiGraph()  # Return empty graph on error

    async def _analyze_commits(self, session: aiohttp.ClientSession, commits: List[Dict]):
        """Analyzes commits in parallel using asyncio"""
        tasks = [self._analyze_single_commit(session, commit) for commit in commits]
        await asyncio.gather(*tasks)

    async def _analyze_single_commit(self, session: aiohttp.ClientSession, commit: Dict):
        """Analyzes a single commit's changes and updates the graph"""
        sha = commit['sha']
        url = commit['url']
        
        async with session.get(url, headers=self.headers) as response:
            if response.status != 200:
                return
            
            commit_data = await response.json()
            files = commit_data.get('files', [])
            
            # Update node with detailed information
            self.commit_graph.nodes[sha].update({
                'files_changed': [f['filename'] for f in files],
                'files_count': len(files),
                'analysis': await self._analyze_with_gpt4(files) if files else "No changes"
            })

    async def _analyze_with_gpt4(self, files: List[Dict]) -> str:
        """Analyzes file changes using GPT-4"""
        patches = [f.get('patch', 'No changes available')[:1000] for f in files]
        prompt = f"Analyze this code change briefly:\nFiles modified: {', '.join(f['filename'] for f in files)}\nChanges: {' '.join(patches)}\nProvide a concise summary."
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'https://api.openai.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {self.openai_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'gpt-4',
                    'messages': [{'role': 'user', 'content': prompt}],
                    'temperature': 0.7,
                    'max_tokens': 100
                }
            ) as response:
                if response.status != 200:
                    return "Analysis failed"
                result = await response.json()
                return result['choices'][0]['message']['content']

    def get_tree_structure(self) -> Dict:
        """Converts the graph into a tree structure suitable for visualization"""
        roots = [n for n in self.commit_graph.nodes() if self.commit_graph.in_degree(n) == 0]
        
        def build_subtree(node: str, visited: set) -> Dict:
            if node in visited:
                return None
            
            visited.add(node)
            node_data = self.commit_graph.nodes[node]
            children = []
            
            for child in self.commit_graph.successors(node):
                subtree = build_subtree(child, visited.copy())
                if subtree:
                    children.append(subtree)
            
            return {
                'id': node,
                'data': {
                    'message': node_data['message'],
                    'author': node_data['author'],
                    'date': node_data['date'].isoformat(),
                    'files_count': node_data.get('files_count', 0),
                    'is_initial': node_data['is_initial']
                },
                'children': children
            }
        
        forest = [build_subtree(root, set()) for root in roots]
        return {'roots': forest}