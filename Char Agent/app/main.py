from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from .routes import router
from . import database, agent
from .models import DatabaseConfig

# Load environment variables
load_dotenv()

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title="AI Database Agent",
        description="Professional AI agent for PostgreSQL database operations and casual chat",
        version="1.0.0"
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routes
    app.include_router(router, prefix="/api/v1")
    
    @app.on_event("startup")
    async def startup_event():
        """Initialize services on startup"""
        try:
            # Initialize database
            db_config = DatabaseConfig(
                database_url=os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/mydatabase"),
                pool_size=5,
                max_overflow=10
            )
            
            # Initialize and assign the database manager on the database module
            database.db_manager = database.DatabaseManager(db_config)
            await database.db_manager.initialize()
            
            # Initialize AI agent
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if not gemini_api_key:
                raise ValueError("GEMINI_API_KEY environment variable is required")
            
            # Initialize and assign the AI agent on the agent module so
            # other modules (and dependency injectors) access the same instance
            agent.ai_agent = agent.AIAgent(gemini_api_key=gemini_api_key)
            await agent.ai_agent.initialize()
            
            print("🚀 AI Database Agent started successfully!")
            
        except Exception as e:
            print(f"❌ Startup failed: {e}")
            raise
    
    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup on shutdown"""
        if database.db_manager:
            await database.db_manager.close()
        print("👋 AI Database Agent shut down successfully")
    
    return app

# Create app instance
app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )