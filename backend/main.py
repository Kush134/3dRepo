from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(title="Repository Visualizer API")

# Add root route
@app.get("/")
async def root():
    return {
        "message": "Welcome to Repository Visualizer API",
        "documentation": "/docs",
        "status": "online"
    }

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://main-jc47.onrender.com",  # Production frontend
        "http://localhost:5173",           # Development frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)

# Startup event to verify environment
@app.on_event("startup")
async def startup_event():
    # Check for required environment variables
    required_vars = {
        "GITHUB_TOKEN": os.getenv("GITHUB_TOKEN"),
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY")
    }
    
    missing_vars = [var for var, value in required_vars.items() if not value]
    
    if missing_vars:
        print(f"WARNING: Missing required environment variables: {', '.join(missing_vars)}")
    else:
        print("All required environment variables are present")
    
    # Use environment variable for port, with 8000 as fallback
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0"
    
    print(f"API will be available at: http://{host}:{port}")
    print(f"Documentation will be available at: http://{host}:{port}/docs")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app", 
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )