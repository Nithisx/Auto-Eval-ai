import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import asyncpg
from .models import DatabaseConfig

class DatabaseManager:
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.engine = None
        self.async_session = None
        
    async def initialize(self):
        """Initialize database connection and session"""
        try:
            self.engine = create_async_engine(
                self.config.database_url,
                echo=False,
                poolclass=NullPool,  # Using NullPool for better async performance
                future=True
            )
            
            self.async_session = sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # Test connection
            async with self.engine.begin() as conn:
                # Use sqlalchemy.text() to make the string executable
                await conn.execute(text("SELECT 1"))
                
            print("✅ Database connection established successfully")
            
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            raise

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get async database session"""
        if not self.async_session:
            raise RuntimeError("Database not initialized. Call initialize() first.")
            
        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def execute_query(self, query: str, params: dict = None) -> list:
        """Execute a raw SQL query safely"""
        try:
            async with self.get_session() as session:
                params = params or {}
                # Ensure the query string is wrapped with text() so SQLAlchemy treats it as an executable
                stmt = text(query)
                result = await session.execute(stmt, params)

                # For SELECT-like queries return rows as list of dicts
                if query.strip().lower().startswith(('select', 'with', 'show')):
                    rows = result.mappings().all()
                    return [dict(r) for r in rows]
                else:
                    return [{"affected_rows": result.rowcount}]
                    
        except Exception as e:
            raise Exception(f"Query execution failed: {str(e)}")

    async def close(self):
        """Close database connections"""
        if self.engine:
            await self.engine.dispose()

# Global database instance
db_manager = None

async def get_database_manager() -> DatabaseManager:
    """Get the global database manager instance"""
    if db_manager is None:
        raise RuntimeError("Database manager not initialized")
    return db_manager