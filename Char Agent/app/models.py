from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class ChatRequest(BaseModel):
    query: str = Field(..., description="User query for the AI agent")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID for context")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI agent's response")
    is_database_operation: bool = Field(False, description="Whether the response involved database operations")
    sql_query: Optional[str] = Field(None, description="SQL query that was executed (if any)")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for continuing context")

class DatabaseConfig(BaseModel):
    database_url: str = Field(..., description="PostgreSQL database URL")
    pool_size: int = Field(5, description="Database connection pool size")
    max_overflow: int = Field(10, description="Maximum overflow connections")