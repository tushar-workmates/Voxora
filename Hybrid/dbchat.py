

import os
import json
import boto3
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Optional, Dict, Any
import uuid
from jose import jwt, JWTError
from fastapi import Depends, HTTPException

CHAT_ROOT = os.path.join(os.getcwd(), "db_chat_store", "users")
os.makedirs(CHAT_ROOT, exist_ok=True)


# ---------------- CONFIG ---------------- #
load_dotenv()

PORT = int(os.getenv("PORT", 5005))
REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("TEXT_MODEL_ID", "amazon.nova-lite-v1:0")
NEON_DATABASE_URL = os.getenv("NEON_DATABASE_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081")

if not NEON_DATABASE_URL:
    raise ValueError("NEON_DATABASE_URL environment variable is required")

# ---------------- CLIENTS ---------------- #
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# ---------------- DATABASE CONNECTION ---------------- #
def get_db_connection():
    """Create and return a PostgreSQL connection"""
    try:
        conn = psycopg2.connect(
            NEON_DATABASE_URL,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise

def get_current_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization")

    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = auth.split(" ")[1]

    try:
        payload = jwt.decode(
            token,
            os.getenv("JWT_SECRET"),
            algorithms=[os.getenv("JWT_ALGORITHM", "HS256")]
        )
        print("JWT PAYLOAD:", payload)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = (
        payload.get("user_id")
        or payload.get("_id")
        or payload.get("id")
        or payload.get("uid")
        or (payload.get("user", {}) or {}).get("_id")
        or (payload.get("user", {}) or {}).get("id")
    )
    

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return str(user_id)
    auth = request.headers.get("Authorization")

    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization token missing")

    token = auth.split(" ")[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id") or payload.get("_id") or payload.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return str(user_id)

# ---------------- HELPERS ---------------- #
def execute_postgres_query(query_str):
    """Execute PostgreSQL query safely"""
    try:
        print(f"Original query string: {query_str}")
        
        # Clean up the query string
        query_str = query_str.strip().rstrip(';')
        
        # Basic safety check - prevent destructive operations
        destructive_keywords = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter', 'create', 'modify']
        if any(keyword in query_str.lower() for keyword in destructive_keywords):
            return {"error": "Destructive operations are not allowed"}
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(query_str)
            
            if query_str.lower().startswith('select'):
                results = cursor.fetchall()
                # Convert to list of dictionaries
                results_list = [dict(row) for row in results]
                return results_list if results_list else []
            else:
                conn.commit()
                return {"success": True, "rows_affected": cursor.rowcount}
                
        except Exception as e:
            conn.rollback()
            return {"error": f"Error executing query: {str(e)}"}
        finally:
            cursor.close()
            conn.close()
    
    except Exception as e:
        return {"error": f"Database error: {str(e)}"}

def bedrock_generate_text(prompt: str, max_tokens: int = 500) -> str:
    """Generate PostgreSQL query using Bedrock"""
    system_prompt = """
    
    ** if user asks like greeting message response them like "Hello! I'm here to help you with SQL queries."  dont generate any query**
    
    You are an expert SQL query generator for PostgreSQL. 
Your task is to translate user questions into efficient SQL queries. 
Always generate correct and optimized queries based on the schema below. 
Do not add or assume extra tables or columns outside the schema. 
Never use DROP, DELETE, or destructive operations unless explicitly asked. 
Always return a query with LIMIT 50 for preview queries unless the user specifies otherwise.

Database schema (PostgreSQL):

Table: employees.employee
- id (BIGINT, PRIMARY KEY)
- birth_date (DATE)
- first_name (VARCHAR)
- last_name (VARCHAR)
- gender (USER-DEFINED)
- hire_date (DATE)

Table: employees.department
- id (CHAR, PRIMARY KEY)
- dept_name (VARCHAR)

Table: employees.department_employee
- employee_id (BIGINT, FOREIGN KEY → employee.id)
- department_id (CHAR, FOREIGN KEY → department.id)
- from_date (DATE)
- to_date (DATE)

Table: employees.department_manager
- employee_id (BIGINT, FOREIGN KEY → employee.id)
- department_id (CHAR, FOREIGN KEY → department.id)
- from_date (DATE)
- to_date (DATE)

Table: employees.title
- employee_id (BIGINT, FOREIGN KEY → employee.id)
- title (VARCHAR)
- from_date (DATE)
- to_date (DATE)

Table: employees.salary
- employee_id (BIGINT, FOREIGN KEY → employee.id)
- amount (BIGINT)
- from_date (DATE)
- to_date (DATE)

Relationships:
- Each employee belongs to one or more departments (via department_employee).
- Each department has one or more managers (via department_manager).
- Each employee can hold multiple titles over time (via title).
- Each employee has multiple salary records with valid date ranges (via salary).
- Departments are identified by id and employees by id.

Query rules:
1. Use explicit JOINs instead of subqueries when possible for clarity.
2. Use table aliases for readability (e.g., e for employee, d for department, s for salary).
3. Use ORDER BY for sorting results and LIMIT 50 for preview queries.
4. Only generate SELECT queries unless explicitly asked for updates.
5. If a user asks for a vague question (e.g., "highest salary"), assume they want employee names along with the requested value.
6. Use the exact table and column names as shown above.

Always return only the SQL query, nothing else.
"""

    messages = [
        {"role": "user", "content": [{"text": prompt}]}
    ]

    inf_params = {"maxTokens": max_tokens, "temperature": 0.1, "topP": 0.9}

    try:
        resp = bedrock_runtime.converse(
            modelId=MODEL_ID,
            system=[{"text": system_prompt}],
            messages=messages,
            inferenceConfig=inf_params
        )
        
        response_text = resp["output"]["message"]["content"][0]["text"]
        print(f"Bedrock response: {response_text}")
        
        # Extract PostgreSQL query using regex
        query_match = re.search(r'SELECT.*?;', response_text, re.DOTALL | re.IGNORECASE)
        if query_match:
            return query_match.group(0)
        
        # If no complete query found, look for query patterns
        select_match = re.search(r'SELECT.*', response_text, re.DOTALL | re.IGNORECASE)
        if select_match:
            query = select_match.group(0).strip()
            if not query.endswith(';'):
                query += ';'
            # Add LIMIT if not present
            if 'limit' not in query.lower():
                query = query.rstrip(';') + ' LIMIT 10;'
            return query
        
        # Fallback query
        return "SELECT * FROM employees.employee LIMIT 5;"
    
    except Exception as e:
        print("Bedrock API Error:", e)
        return "SELECT * FROM employees.employee LIMIT 5;"

def is_greeting_message(message: str) -> bool:
    """Check if the message is a greeting (more precise detection)"""
    message_lower = message.lower().strip()
    
    # Exact greeting matches
    exact_greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
    
    # Check for exact matches or messages that only contain greeting words
    if message_lower in exact_greetings:
        return True
    
    # Check if message starts with greeting but might have other content
    greeting_starts = ['hi ', 'hello ', 'hey ', 'greetings ']
    if any(message_lower.startswith(start) for start in greeting_starts):
        # If it's just a greeting with minimal additional text, treat as greeting
        words = message_lower.split()
        if len(words) <= 3:  # "hi there", "hello how are", etc.
            return True
    
    return False

async def generate_response(user_query: str):
    """Generate response by creating PostgreSQL query and executing it"""
    try:
        print(f"User query: {user_query}")
        
        # Check for greetings or non-query questions with more precise detection
        if is_greeting_message(user_query):
            return {
                "query": "",
                "results": [],
                "message": "Hello! I'm here to help you with SQL queries. Ask me questions about employees, departments, salaries, or any other data in the database.",
                "error": None
            }
        
        # Generate PostgreSQL query using Bedrock
        query_prompt = f"User question: {user_query}\n\nGenerate a simple PostgreSQL query to answer this question:"
        postgres_query = bedrock_generate_text(query_prompt)
        
        print(f"Generated PostgreSQL query: {postgres_query}")
        
        # Execute the query
        query_results = execute_postgres_query(postgres_query)
        
        print(f"Query results type: {type(query_results)}")
        
        if isinstance(query_results, dict) and "error" in query_results:
            return {
                "query": postgres_query,
                "results": [],
                "message": f"❌ Error: {query_results['error']}",
                "error": query_results['error']
            }
        
        if isinstance(query_results, dict) and "success" in query_results:
            return {
                "query": postgres_query,
                "results": [],
                "message": f"✅ Query executed successfully. Rows affected: {query_results.get('rows_affected', 0)}",
                "error": None
            }
        
        # For SELECT queries
        if isinstance(query_results, list):
            if len(query_results) == 0:
                return {
                    "query": postgres_query,
                    "results": [],
                    "message": "No matching records found.",
                    "error": None
                }
            else:
                # Format employee names in a cleaner way
                formatted_results = []
                for record in query_results:
                    # Check if this is an employee query (has first_name and last_name)
                    if 'first_name' in record and 'last_name' in record:
                        formatted_name = f"{record['first_name']} {record['last_name']}"
                        formatted_results.append({"employee_name": formatted_name})
                    else:
                        # For non-employee queries, keep original structure
                        formatted_results.append(record)
                
                # Create a more user-friendly message
                if formatted_results and 'employee_name' in formatted_results[0]:
                    names_list = [item['employee_name'] for item in formatted_results]
                    if len(names_list) == 1:
                        message = f"✅ Found 1 matching record:\n\n**Employee:** {names_list[0]}"
                    else:
                        message = f"✅ Found {len(names_list)} matching records:\n\n**Employees:**\n" + "\n".join([f"- {name}" for name in names_list])
                else:
                    # For other types of results
                    if len(query_results) == 1:
                        message = f"✅ Found 1 matching record."
                    else:
                        message = f"✅ Found {len(query_results)} matching records."
                
                return {
                    "query": postgres_query,
                    "results": formatted_results,
                    "message": message,
                    "error": None
                }
        
        return {
            "query": postgres_query,
            "results": [],
            "message": "Query executed successfully.",
            "error": None
        }
    
    except Exception as e:
        print("Error in generate_response:", e)
        return {
            "query": "Error generating query",
            "results": [],
            "message": f"❌ Sorry, I'm having trouble processing your request right now. Error: {str(e)}",
            "error": str(e)
        }
    """Generate response by creating PostgreSQL query and executing it"""
    try:
        print(f"User query: {user_query}")
        
        # Check for greetings or non-query questions with more precise detection
        if is_greeting_message(user_query):
            return {
                "query": "",
                "results": [],
                "message": "Hello! I'm here to help you with SQL queries. Ask me questions about employees, departments, salaries, or any other data in the database.",
                "error": None
            }
        
        # Generate PostgreSQL query using Bedrock
        query_prompt = f"User question: {user_query}\n\nGenerate a simple PostgreSQL query to answer this question:"
        postgres_query = bedrock_generate_text(query_prompt)
        
        print(f"Generated PostgreSQL query: {postgres_query}")
        
        # Execute the query
        query_results = execute_postgres_query(postgres_query)
        
        print(f"Query results type: {type(query_results)}")
        
        if isinstance(query_results, dict) and "error" in query_results:
            return {
                "query": postgres_query,
                "results": [],
                "message": f"❌ Error: {query_results['error']}",
                "error": query_results['error']
            }
        
        if isinstance(query_results, dict) and "success" in query_results:
            return {
                "query": postgres_query,
                "results": [],
                "message": f"✅ Query executed successfully. Rows affected: {query_results.get('rows_affected', 0)}",
                "error": None
            }
        
        # For SELECT queries
        if isinstance(query_results, list):
            if len(query_results) == 0:
                return {
                    "query": postgres_query,
                    "results": [],
                    "message": "No matching records found.",
                    "error": None
                }
            else:
                return {
                    "query": postgres_query,
                    "results": query_results,
                    "message": f"Found {len(query_results)} matching records.",
                    "error": None
                }
        
        return {
            "query": postgres_query,
            "results": [],
            "message": "Query executed successfully.",
            "error": None
        }
    
    except Exception as e:
        print("Error in generate_response:", e)
        return {
            "query": "Error generating query",
            "results": [],
            "message": f"❌ Sorry, I'm having trouble processing your request right now. Error: {str(e)}",
            "error": str(e)
        }

# ============================================================
# Session-based chat storage (React Query compatible)
# ============================================================
db_chat_sessions = {}  # In-memory session storage

def get_db_session_chat(session_id: str) -> List[Dict]:
    return db_chat_sessions.get(session_id, [])

def add_db_message_to_session(session_id: str, message: Dict):
    if session_id not in db_chat_sessions:
        db_chat_sessions[session_id] = []
    db_chat_sessions[session_id].append(message)

def clear_db_session_chat(session_id: str):
    if session_id in db_chat_sessions:
        del db_chat_sessions[session_id]

def clear_all_db_sessions():
    """Clear all db chat sessions"""
    global db_chat_sessions
    db_chat_sessions = {}

# ---------------- DATA MODELS ---------------- #
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class Message(BaseModel):
    id: str
    text: str
    isUser: bool
    timestamp: str

class ChatHistory(BaseModel):
    session_id: str
    messages: List[Message]

class ChatResponse(BaseModel):
    success: bool
    query: str
    results: List[Dict[str, Any]]
    message: str
    error: Optional[str] = None

# In-memory storage for chat history (in production, use a database)
def get_user_chat_dir(user_id: str):
    path = os.path.join(CHAT_ROOT, user_id)
    os.makedirs(path, exist_ok=True)
    return path

def get_chat_file(user_id: str, session_id: str):
    return os.path.join(get_user_chat_dir(user_id), f"{session_id}.json")

def save_chat_to_file(user_id: str, session_id: str, messages: list):
    with open(get_chat_file(user_id, session_id), "w", encoding="utf-8") as f:
        json.dump({
            "session_id": session_id,
            "messages": messages
        }, f, indent=2)

def load_chat_from_file(user_id: str, session_id: str):
    path = get_chat_file(user_id, session_id)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)["messages"]



# ---------------- FASTAPI ROUTES ---------------- #
@app.post("/db-auth/logout")
async def logout_db_user(request: Request):
    """Logout user and clear their db chat session"""
    try:
        user_id = get_current_user_id(request)
        session_id = f"db_session_{user_id}"
        clear_db_session_chat(session_id)
        return {"success": True, "message": "Logged out successfully"}
    except Exception as e:
        return {"success": True, "message": "Logged out"}

@app.get("/db-chat/session")
async def get_db_chat_session(request: Request):
    """Get current session chat messages"""
    user_id = get_current_user_id(request)
    session_id = f"db_session_{user_id}"
    messages = get_db_session_chat(session_id)
    return {"success": True, "messages": messages}

@app.post("/db-chat/message")
async def send_db_chat_message(
    req: ChatRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    """Send message and get AI response"""
    message = req.message.strip()
    session_id = f"db_session_{user_id}"

    if not message:
        raise HTTPException(400, "Message cannot be empty")

    # Add user message to session
    user_message = {
        "id": str(uuid.uuid4()),
        "text": message,
        "isUser": True,
        "timestamp": str(uuid.uuid1())
    }
    add_db_message_to_session(session_id, user_message)

    # Generate response
    response_data = await generate_response(message)

    # Add AI response to session
    ai_message = {
        "id": str(uuid.uuid4()),
        "text": response_data["message"],
        "isUser": False,
        "timestamp": str(uuid.uuid1()),
        "query": response_data["query"],
        "results": response_data["results"],
        "error": response_data["error"]
    }
    add_db_message_to_session(session_id, ai_message)

    return {
        "success": True,
        "message": ai_message,
        "query": response_data["query"],
        "results": response_data["results"],
        "error": response_data["error"]
    }

@app.post("/db-auth/logout")
async def logout_db_user(request: Request):
    """Logout and clear session chat"""
    try:
        user_id = get_current_user_id(request)
        session_id = f"db_session_{user_id}"
        clear_db_session_chat(session_id)
        return {"success": True, "message": "Logged out successfully"}
    except:
        return {"success": True, "message": "Logged out"}


@app.get("/")
async def root():
    return {"message": "SQL Query Assistant API", "status": "running"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    session_id = req.session_id or str(uuid.uuid4())

    # Load existing chat
    messages = load_chat_from_file(user_id, session_id)

    # Add user message
    messages.append({
        "id": str(uuid.uuid4()),
        "text": req.message,
        "isUser": True,
        "timestamp": str(uuid.uuid1())
    })

    # Generate response
    response_data = await generate_response(req.message)

    # Add AI message
    messages.append({
        "id": str(uuid.uuid4()),
        "text": response_data["message"],
        "isUser": False,
        "timestamp": str(uuid.uuid1())
    })

    # ✅ SAVE TO FILE
    save_chat_to_file(user_id, session_id, messages)

    return ChatResponse(
        success=response_data["error"] is None,
        query=response_data["query"],
        results=response_data["results"],
        message=response_data["message"],
        error=response_data["error"]
    )


@app.post("/api/chat/save")
async def save_chat(
    chat: ChatHistory,
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    save_chat_to_file(user_id, chat.session_id, chat.messages)
    return {"success": True}


@app.get("/api/chat/load/{session_id}")
async def load_chat(
    session_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id)
):
    messages = load_chat_from_file(user_id, session_id)
    return {"success": True, "messages": messages}


@app.get("/api/stats")
async def get_stats():
    """Get database statistics"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        stats = {}
        
        # Get counts for each table
        tables = ['employee', 'department', 'department_employee', 'department_manager', 'title', 'salary']
        
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) as count FROM employees.{table}")
            result = cursor.fetchone()
            stats[f"{table}_count"] = result["count"]
        
        cursor.close()
        conn.close()
        
        return {"success": True, "stats": stats}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Health check endpoint to test database connection
@app.get("/api/health")
async def health_check():
    try:
        conn = get_db_connection()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)