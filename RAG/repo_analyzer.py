# repo_analyzer.py
import networkx as nx
from datetime import datetime
import aiohttp
import asyncio
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import json
import os
from dotenv import load_dotenv
import logging
import argparse

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RepositoryAnalyzer:
    def __init__(self, github_token: str):
        self.github_token = github_token
        self.headers = {
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        self.commit_graph = nx.DiGraph()
        self.commit_summaries = []

    async def _fetch_commit_detail(self, session: aiohttp.ClientSession, commit_url: str) -> Dict:
        """Fetch detailed commit information including file changes"""
        async with session.get(commit_url, headers=self.headers) as response:
            if response.status != 200:
                raise Exception(f'Failed to fetch commit detail: {await response.text()}')
            return await response.json()

    async def _analyze_code_changes(self, files: List[Dict]) -> str:
        """Generate detailed analysis of code changes"""
        analysis = []
        
        total_additions = 0
        total_deletions = 0
        
        for file in files:
            filename = file.get('filename', 'unknown')
            status = file.get('status', 'unknown')
            additions = file.get('additions', 0)
            deletions = file.get('deletions', 0)
            patch = file.get('patch', '')
            
            total_additions += additions
            total_deletions += deletions
            
            # Analyze file changes
            change_type = ''
            if status == 'added':
                change_type = 'Added new file'
            elif status == 'modified':
                change_type = 'Modified existing file'
            elif status == 'removed':
                change_type = 'Removed file'
            elif status == 'renamed':
                change_type = f"Renamed file from {file.get('previous_filename', 'unknown')}"
            
            # Analyze the actual changes
            changes = []
            if patch:
                patch_lines = patch.split('\n')
                for line in patch_lines:
                    if line.startswith('+') and not line.startswith('+++'):
                        changes.append('Added: ' + line[1:].strip())
                    elif line.startswith('-') and not line.startswith('---'):
                        changes.append('Removed: ' + line[1:].strip())
            
            file_analysis = f"{change_type} '{filename}' with {additions} additions and {deletions} deletions."
            if changes:
                file_analysis += "\nKey changes:\n- " + "\n- ".join(changes[:5])  # Limit to 5 key changes
            
            analysis.append(file_analysis)
        
        overall_analysis = f"Summary: Modified {len(files)} files with {total_additions} additions and {total_deletions} deletions.\n\n"
        overall_analysis += "\n\n".join(analysis)
        
        return overall_analysis

    async def _fetch_commits(self, session: aiohttp.ClientSession, owner: str, repo: str, limit: int) -> List[Dict]:
        """Fetches commit history from GitHub API"""
        url = f'https://api.github.com/repos/{owner}/{repo}/commits?per_page={limit}'
        print(f"Fetching commits from {owner}/{repo}...")
        
        async with session.get(url, headers=self.headers) as response:
            if response.status != 200:
                raise Exception(f'Failed to fetch commits: {await response.text()}')
            return await response.json()

    async def analyze_repository(self, owner: str, repo: str, limit: int = 50) -> None:
        """Analyzes a repository and saves the results."""
        print(f"Starting detailed analysis of {owner}/{repo}")
        
        async with aiohttp.ClientSession() as session:
            commits = await self._fetch_commits(session, owner, repo, limit)
            print(f"Found {len(commits)} commits to analyze")
            
            analyzed_commits = []
            for commit in commits:
                sha = commit['sha']
                print(f"Analyzing commit {sha[:7]}...")
                
                # Fetch detailed commit information
                commit_detail = await self._fetch_commit_detail(session, commit['url'])
                
                # Get the code changes and analysis
                files = commit_detail.get('files', [])
                analysis = await self._analyze_code_changes(files)
                
                # Extract code snippets from patches
                code_snippets = []
                for file in files:
                    if 'patch' in file:
                        code_snippets.append(f"File: {file['filename']}\n{file['patch']}")
                
                commit_data = {
                    "sha": sha,
                    "message": commit['commit']['message'],
                    "author": commit['commit']['author']['name'],
                    "date": commit['commit']['author']['date'],
                    "files_changed": [f['filename'] for f in files],
                    "code_changes": code_snippets[:3],  # Limit to 3 files for brevity
                    "analysis": analysis,
                    "stats": {
                        "total_files_changed": len(files),
                        "total_additions": sum(f.get('additions', 0) for f in files),
                        "total_deletions": sum(f.get('deletions', 0) for f in files)
                    }
                }
                analyzed_commits.append(commit_data)
            
            # Save results
            if os.path.exists('app.json'):
                os.remove('app.json')
            
            with open('app.json', 'w') as f:
                json.dump(analyzed_commits, f, indent=2)
            
            print(f"\nDetailed analysis completed. Results saved to app.json")
            print(f"Analyzed {len(analyzed_commits)} commits with full code changes and impact analysis")

async def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Analyze a GitHub repository')
    parser.add_argument('--owner', required=True, help='GitHub repository owner')
    parser.add_argument('--repo', required=True, help='GitHub repository name')
    parser.add_argument('--limit', type=int, default=50, help='Number of commits to analyze')
    args = parser.parse_args()

    github_token = os.getenv('GITHUB_TOKEN')
    if not github_token:
        print("Error: GITHUB_TOKEN not found in environment variables")
        return

    analyzer = RepositoryAnalyzer(github_token)
    await analyzer.analyze_repository(args.owner, args.repo, args.limit)

if __name__ == "__main__":
    asyncio.run(main())