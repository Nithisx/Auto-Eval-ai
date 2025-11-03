from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from .models import ChatRequest, ChatResponse
from .agent import get_ai_agent

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    agent = Depends(get_ai_agent)
):
    """
    Chat endpoint for interacting with the AI database agent
    
    - **query**: User's message (casual chat or database operation)
    - **conversation_id**: Optional ID for maintaining conversation context
    """
    try:
        result = await agent.process_query(
            query=request.query,
            conversation_id=request.conversation_id
        )
        
        return ChatResponse(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing query: {str(e)}"
        )

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Database Agent",
        "version": "1.0.0"
    }