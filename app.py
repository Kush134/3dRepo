import streamlit as st
# Must be the first Streamlit command
st.set_page_config(page_title="Repository Analyzer", layout="wide")

import requests
from dotenv import load_dotenv, set_key
import os
import json
import sys
import asyncio
import logging

# Add RAG folder to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'RAG'))

# Import RAG components
from repo_analyzer import RepositoryAnalyzer
from dashboard import CodeAnalyticsApp

# Load environment variables
load_dotenv()

# Configure environment variables with defaults
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://main-jc47.onrender.com')
BACKEND_URL = os.getenv('BACKEND_URL', 'https://backend-a8mm.onrender.com')

# Apply custom styling
st.markdown("""
    <style>
        /* Main theme colors */
        [data-testid="stAppViewContainer"], 
        [data-testid="stHeader"],
        [data-testid="stToolbar"] {
            background-color: #0a1930 !important;
            color: #e6e6ff;
        }
        
        [data-testid="stSidebar"] {
            background-color: #1f2b47;
            border-right: 1px solid #2a3b5c;
        }
        
        /* Fix top and bottom bars */
        header[data-testid="stHeader"] {
            background-color: #0a1930 !important;
        }
        
        .stDeployButton {
            display: none;
        }
        
        /* Headers and text */
        h1, h2, h3, .stMarkdown {
            color: #e6e6ff !important;
        }
        
        /* Chat container and messages */
        .chat-container {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 80px);
            margin: -1rem;
            padding: 1rem;
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 2rem;
            margin-bottom: 60px;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .welcome-message {
            text-align: center;
            padding: 2rem;
            color: #a0aec0;
            font-size: 1.1em;
        }
        
        .chat-input {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 1rem;
            background: #1f2b47;
            border-top: 1px solid #3d4f76;
        }
        
        /* Components styling */
        .stButton button {
            background: linear-gradient(90deg, #4a90e2 0%, #357abd 100%);
            color: white;
            border: none;
            border-radius: 5px;
            padding: 0.5rem 1rem;
            transition: all 0.3s ease;
        }
        
        .stButton button:hover {
            background: linear-gradient(90deg, #357abd 0%, #2d6aa3 100%);
            box-shadow: 0 0 10px rgba(74, 144, 226, 0.3);
        }
        
        .stTextInput input {
            background-color: #2a3b5c;
            color: #ffffff;
            border: 1px solid #3d4f76;
            border-radius: 5px;
        }
        
        .stChatMessage {
            background-color: #2a3b5c;
            border: 1px solid #3d4f76;
            border-radius: 10px;
            padding: 10px;
            margin: 5px 0;
        }
        
        /* For 3D view */
        .block-container { 
            padding: 0; 
            max-width: 100%; 
        }
        
        iframe { 
            height: calc(100vh - 60px) !important; 
            background-color: #0a1930 !important;
        }
    </style>
""", unsafe_allow_html=True)

def analyze_repository(owner, repo):
    """Run repository analysis with progress bar"""
    progress_text = st.empty()
    progress_bar = st.progress(0)
    
    try:
        # Step 1: Initialize
        progress_text.text("Initializing repository analyzer...")
        progress_bar.progress(10)
        
        github_token = os.getenv('GITHUB_TOKEN')
        analyzer = RepositoryAnalyzer(github_token)
        
        # Step 2: Analyze
        progress_text.text(f"Analyzing repository: {owner}/{repo}")
        progress_bar.progress(30)
        
        asyncio.run(analyzer.analyze_repository(owner, repo))
        
        # Step 3: RAG Setup
        progress_text.text("Setting up RAG system...")
        progress_bar.progress(60)
        
        app = CodeAnalyticsApp()
        connection_params = {
            "account": os.getenv('SNOWFLAKE_ACCOUNT'),
            "user": os.getenv('SNOWFLAKE_USER'),
            "password": os.getenv('SNOWFLAKE_PASSWORD'),
            "database": os.getenv('SNOWFLAKE_DATABASE'),
            "schema": os.getenv('SNOWFLAKE_SCHEMA'),
            "warehouse": os.getenv('SNOWFLAKE_WAREHOUSE'),
            "role": "ACCOUNTADMIN"
        }
        
        app.process_json('app.json', connection_params)
        
        progress_text.text("Analysis complete! Ready for chat!")
        progress_bar.progress(100)
        return True
        
    except Exception as e:
        st.error(f"Error during analysis: {str(e)}")
        return False

def create_visualization_html(repo_data=None, owner=None, repo=None):
    """Create HTML for the 3D visualization"""
    frontend_url = FRONTEND_URL
    if owner and repo:
        frontend_url = f"{FRONTEND_URL}/?owner={owner}&repo={repo}"

    return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body, html {{
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }}
                .visualization-container {{
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    overflow: hidden;
                }}
                iframe {{
                    width: 100%;
                    height: 100%;
                    border: none;
                }}
            </style>
        </head>
        <body>
            <div class="visualization-container">
                <iframe src="{frontend_url}" frameborder="0" allow="clipboard-write"></iframe>
            </div>
        </body>
        </html>
    """

def main():
    # Initialize session states
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    if 'repo_data' not in st.session_state:
        st.session_state.repo_data = None
    if 'visualization_counter' not in st.session_state:
        st.session_state.visualization_counter = 0
    if 'show_visualization' not in st.session_state:
        st.session_state.show_visualization = True
    if 'analyzed' not in st.session_state:
        st.session_state.analyzed = False

    # Sidebar
    with st.sidebar:
        st.header("Repository Analysis")
        owner = st.text_input("Repository Owner", value="mabhi02")
        repo = st.text_input("Repository Name", value="ChatCHW")
        
        if st.button("🔄 Toggle View", 
                    help="Switch between 3D visualization and chat view",
                    use_container_width=True,
                    type="primary"):
            st.session_state.show_visualization = not st.session_state.show_visualization
        
        st.markdown(f"Current: **{'3D View' if st.session_state.show_visualization else 'Chat View'}**")
        
        # Debug info
        with st.expander("Debug Info"):
            st.write(f"GitHub Token: {'Present' if os.getenv('GITHUB_TOKEN') else 'Missing'}")
            st.write(f"Analysis Status: {'Complete' if st.session_state.analyzed else 'Not Started'}")
        
        if st.button("Analyze Repository", type="primary"):
            st.session_state.analyzed = analyze_repository(owner, repo)
            if st.session_state.analyzed:
                st.success("Repository analyzed successfully!")

    # Main content area
    if not st.session_state.show_visualization:
        # Chat view with fixed input at bottom
        st.markdown('<div class="chat-container">', unsafe_allow_html=True)
        
        # Messages area
        st.markdown('<div class="chat-messages">', unsafe_allow_html=True)
        if not st.session_state.messages:
            st.markdown("""
                <div class="welcome-message">
                    <h2>👋 Welcome to Repository Chat!</h2>
                    <p>To get started:</p>
                    <ol>
                        <li>Enter your repository details</li>
                        <li>Click "Analyze Repository"</li>
                        <li>Ask questions about your code!</li>
                    </ol>
                </div>
            """, unsafe_allow_html=True)
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.write(message["content"])
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Fixed bottom input
        st.markdown('<div class="chat-input">', unsafe_allow_html=True)
        if st.session_state.analyzed:
            if prompt := st.chat_input("Ask about the repository...", key="chat_input"):
                st.session_state.messages.append({"role": "user", "content": prompt})
                
                try:
                    app = CodeAnalyticsApp()
                    connection_params = {
                        "account": os.getenv('SNOWFLAKE_ACCOUNT'),
                        "user": os.getenv('SNOWFLAKE_USER'),
                        "password": os.getenv('SNOWFLAKE_PASSWORD'),
                        "database": os.getenv('SNOWFLAKE_DATABASE'),
                        "schema": os.getenv('SNOWFLAKE_SCHEMA'),
                        "warehouse": os.getenv('SNOWFLAKE_WAREHOUSE'),
                        "role": "ACCOUNTADMIN"
                    }
                    response = app.process_query(prompt, connection_params)
                    st.session_state.messages.append({"role": "assistant", "content": response})
                except Exception as e:
                    st.error(f"Error processing query: {str(e)}")
                st.rerun()
        else:
            st.info("Please analyze a repository first!")
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        
    else:
        # 3D visualization view
        html_content = create_visualization_html(
            repo_data=st.session_state.repo_data,
            owner=owner,
            repo=repo
        )
        st.components.v1.html(html_content, height=1000)

if __name__ == "__main__":
    main()