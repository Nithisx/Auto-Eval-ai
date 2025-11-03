import os
from typing import Any, Dict, List, Optional
from sqlalchemy import create_engine
from langchain.agents import AgentType, initialize_agent
from langchain.agents.agent_toolkits import SQLDatabaseToolkit
from langchain.sql_database import SQLDatabase
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain.agents.agent import AgentExecutor
from langchain.tools import Tool
from langchain.schema import SystemMessage
import google.generativeai as genai
from .database import get_database_manager
import re

class AIAgent:
    def __init__(self, gemini_api_key: str):
        self.gemini_api_key = gemini_api_key
        self.llm = None
        self.agent = None
        # Toggle to allow destructive operations (DELETE/UPDATE/INSERT/CREATE/DROP)
        # Should be enabled explicitly via environment variable for production use
        self.allow_full_crud = os.getenv("ALLOW_FULL_CRUD", "false").lower() in ("1", "true", "yes")
        self.memory = ConversationBufferMemory(memory_key="chat_history")
        self.casual_patterns = [
            r'\b(hi|hello|hey|greetings|howdy)\b',
            r'\b(how are you|how\'s it going|what\'s up)\b',
            r'\b(thanks|thank you|thx)\b',
            r'\b(bye|goodbye|see ya|cya)\b',
            r'\b(yes|no|maybe|ok|okay)\b',
            r'\b(please|sorry|excuse me)\b'
        ]
        
    async def initialize(self):
        """Initialize the AI agent with database connection"""
        try:
            # Configure Gemini
            genai.configure(api_key=self.gemini_api_key)
            
            # Initialize LLM
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                google_api_key=self.gemini_api_key,
                temperature=0.1,
                convert_system_message_to_human=True
            )
            
            # Get database connection
            db_manager = await get_database_manager()

            # The langchain SQLDatabase expects a synchronous engine or a database URL
            # Inspection of AsyncEngine is not supported. Use the database URL and
            # convert an async driver URL (e.g. postgresql+asyncpg://...) to the
            # corresponding sync URL (postgresql://...) so SQLAlchemy inspection works.
            try:
                database_url = db_manager.config.database_url
            except Exception:
                # Fallback: if DatabaseManager exposes an engine, try to read its URL
                database_url = None
                if getattr(db_manager, "engine", None) is not None:
                    try:
                        database_url = str(db_manager.engine.url)
                    except Exception:
                        database_url = None

            if not database_url:
                raise RuntimeError("No database URL available for SQL inspection")

            # Convert async driver URL to sync URL if needed
            sync_url = database_url.replace("+asyncpg", "")

            # Create a synchronous SQLAlchemy Engine for inspection (required by SQLDatabase)
            sync_engine = create_engine(sync_url, future=True)

            db = SQLDatabase(sync_engine)
            
            # Create SQL toolkit
            toolkit = SQLDatabaseToolkit(db=db, llm=self.llm)
            
            # Custom tools
            custom_tools = [
                Tool(
                    name="casual_chat",
                    func=self._handle_casual_chat,
                    description="Use this for casual conversations like greetings, thanks, goodbyes, or general chat"
                )
            ]

            # Optional destructive tool (only registered when explicitly allowed)
            if self.allow_full_crud:
                custom_tools.append(
                    Tool(
                        name="execute_sql",
                        func=self._execute_sql_tool,
                        description=(
                            "Execute a parameterized SQL statement. "
                            "Payload should be a JSON-like string with keys: 'sql' and optional 'params'. "
                            "Destructive operations require this tool to be enabled via ALLOW_FULL_CRUD env var."
                        )
                    )
                )
            
            # Combine tools
            tools = toolkit.get_tools() + custom_tools
            
            # System message for the agent
            system_message = SystemMessage(content="""
You are a professional AI database assistant. Your responsibilities:

1. **Database Operations**: Handle all database queries professionally and safely
2. **Casual Chat**: Be friendly and helpful in casual conversations
3. **Safety**: NEVER execute destructive operations without confirmation
4. **Clarity**: Explain complex database operations in simple terms
5. **Accuracy**: Always verify queries before execution

**CRITICAL RULES:**
- For DELETE, DROP, TRUNCATE operations, ask for confirmation
- Always use parameterized queries to prevent SQL injection
- If unsure about a table's schema, check first before querying
- Format results clearly and concisely
- For casual greetings, use the casual_chat tool

**Response Format:**
- Database results: Present as clean tables or lists
- Casual chat: Be warm and engaging
- Errors: Explain what went wrong and suggest fixes
""")
            
            # Initialize agent
            self.agent = initialize_agent(
                tools=tools,
                llm=self.llm,
                agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
                memory=self.memory,
                verbose=True,
                handle_parsing_errors=True,
                agent_kwargs={
                    "system_message": system_message,
                }
            )
            
            print("✅ AI Agent initialized successfully")
            
        except Exception as e:
            print(f"❌ AI Agent initialization failed: {e}")
            raise

    def _handle_casual_chat(self, query: str) -> str:
        """Handle casual conversation"""
        query_lower = query.lower().strip()
        
        # Greetings
        if any(re.match(pattern, query_lower) for pattern in [r'hi', r'hello', r'hey', r'greetings']):
            return "Hey! 👋 I'm your AI database assistant. How can I help you with your database today?"
        
        # How are you
        elif any(phrase in query_lower for phrase in ['how are you', "how's it going", "what's up"]):
            return "I'm doing great! Ready to help you with any database operations or questions you have. What can I do for you?"
        
        # Thanks
        elif any(phrase in query_lower for phrase in ['thank', 'thanks', 'thx']):
            return "You're welcome! 😊 Let me know if you need anything else."
        
        # Goodbye
        elif any(phrase in query_lower for phrase in ['bye', 'goodbye', 'see you', 'cya']):
            return "Goodbye! 👋 Feel free to reach out if you need more database assistance."
        
        # Default friendly response
        else:
            return "I'm here to help! Whether you need database operations or just want to chat, I'm ready. What's on your mind?"

    def _is_casual_query(self, query: str) -> bool:
        """Determine if the query is casual conversation"""
        query_lower = query.lower().strip()
        
        # Check against casual patterns
        for pattern in self.casual_patterns:
            if re.search(pattern, query_lower):
                return True
        
        # Check for very short queries that aren't database commands
        if len(query.split()) <= 2 and not any(keyword in query_lower for keyword in 
            ['select', 'insert', 'update', 'delete', 'create', 'drop', 'show', 'list']):
            return True
            
        return False

    async def process_query(self, query: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """Process user query and return response"""
        try:
            if not self.agent:
                raise RuntimeError("Agent not initialized")
            
            # Handle casual queries directly
            if self._is_casual_query(query):
                response = self._handle_casual_chat(query)
                return {
                    "response": response,
                    "is_database_operation": False,
                    "sql_query": None,
                    "conversation_id": conversation_id
                }
            
            # Process database-related queries through the agent
            agent_response = await self.agent.arun(input=query)

            # Extract SQL query from agent's thought process (if any)
            sql_query = self._extract_sql_query(agent_response)

            # If the agent produced a SELECT-like SQL query, execute it for a clean, human-readable result
            if sql_query and sql_query.strip().lower().startswith(('select', 'with', 'show')):
                try:
                    db_manager = await get_database_manager()
                    rows = await db_manager.execute_query(sql_query)

                    # Format rows (list[dict]) into a markdown table
                    if isinstance(rows, list) and rows:
                        # Determine ordered columns from first row, then union with others
                        cols = []
                        for r in rows:
                            for k in r.keys():
                                if k not in cols:
                                    cols.append(k)

                        # Build markdown table
                        header = "| " + " | ".join(cols) + " |"
                        sep = "| " + " | ".join(["---"] * len(cols)) + " |"
                        body_lines = []
                        for r in rows:
                            vals = [str(r.get(c, "")) for c in cols]
                            body_lines.append("| " + " | ".join(vals) + " |")

                        formatted = "\n".join([header, sep] + body_lines)
                        # Preserve agent preamble if any
                        preamble = agent_response.split("\n", 1)[0]
                        response_text = f"{preamble}\n\nFormatted results:\n{formatted}"
                    else:
                        response_text = agent_response + "\n\nQuery returned no rows."

                    return {
                        "response": response_text,
                        "is_database_operation": True,
                        "sql_query": sql_query,
                        "conversation_id": conversation_id
                    }
                except Exception as e:
                    # If executing or formatting fails, fall back to the raw agent response
                    fallback = f"{agent_response}\n\n(Note: failed to fetch/format results: {e})"
                    return {
                        "response": fallback,
                        "is_database_operation": True,
                        "sql_query": sql_query,
                        "conversation_id": conversation_id
                    }

            return {
                "response": agent_response,
                "is_database_operation": sql_query is not None,
                "sql_query": sql_query,
                "conversation_id": conversation_id
            }
            
        except Exception as e:
            error_msg = f"I encountered an error while processing your request: {str(e)}"
            return {
                "response": error_msg,
                "is_database_operation": False,
                "sql_query": None,
                "conversation_id": conversation_id
            }

    async def _execute_sql_tool(self, payload: str) -> str:
        """Tool handler to execute parameterized SQL safely.

        payload: JSON-like string, e.g. '{"sql": "DELETE FROM users WHERE id=:id", "params": {"id": 1}}'
        Only active when ALLOW_FULL_CRUD is enabled.
        """
        if not self.allow_full_crud:
            return "Full CRUD operations are disabled on this agent. Enable by setting ALLOW_FULL_CRUD=true"

        # Parse payload safely - support simple Python dict literal or JSON
        try:
            import json
            data = json.loads(payload)
        except Exception:
            try:
                # Fallback to eval on a restricted namespace
                data = eval(payload, {"__builtins__": {}}, {})
            except Exception as e:
                return f"Failed to parse payload: {e}"

        sql = data.get("sql") if isinstance(data, dict) else None
        params = data.get("params", {}) if isinstance(data, dict) else {}

        if not sql:
            return "Payload must include an 'sql' key with the SQL statement to execute."

        # Very basic safety: require a confirmation keyword for destructive operations
        destructive = any(sql.strip().lower().startswith(op) for op in ("delete", "update", "insert", "create", "drop", "truncate"))
        if destructive and not data.get("confirm", False):
            return "Destructive operation detected. Add \"confirm\": true to the payload to proceed."

        try:
            db_manager = await get_database_manager()
            result = await db_manager.execute_query(sql, params=params)
            # Format for readability
            if isinstance(result, list) and result:
                cols = []
                for r in result:
                    for k in r.keys():
                        if k not in cols:
                            cols.append(k)

                header = "| " + " | ".join(cols) + " |"
                sep = "| " + " | ".join(["---"] * len(cols)) + " |"
                body_lines = []
                for r in result:
                    vals = [str(r.get(c, "")) for c in cols]
                    body_lines.append("| " + " | ".join(vals) + " |")

                return "\n".join([header, sep] + body_lines)
            else:
                return str(result)
        except Exception as e:
            return f"Execution failed: {e}"

    def _extract_sql_query(self, agent_response: str) -> Optional[str]:
        """Extract SQL query from agent's response"""
        # Look for SQL patterns in the response
        sql_patterns = [
            r'```sql\n(.*?)\n```',
            r'SELECT.*?;',
            r'INSERT.*?;',
            r'UPDATE.*?;',
            r'DELETE.*?;',
            r'CREATE.*?;',
            r'DROP.*?;'
        ]
        
        for pattern in sql_patterns:
            matches = re.findall(pattern, agent_response, re.IGNORECASE | re.DOTALL)
            if matches:
                return matches[0].strip()
        
        return None

# Global agent instance
ai_agent = None

async def get_ai_agent() -> AIAgent:
    """Get the global AI agent instance"""
    if ai_agent is None:
        raise RuntimeError("AI agent not initialized")
    return ai_agent