"""
Core RAG utilities extracted from rag-workflow
Direct integration with OpenAI API and vector stores for document processing and querying
"""

import os
import httpx
import urllib.parse
import asyncio
import time
import re
from typing import List, Dict, Optional, Any
from io import BytesIO
from openai import OpenAI

# Supabase client will be imported from database.py in our backend
from ..database import get_supabase

# Configuration - we'll get these from our backend config
def get_openai_client() -> OpenAI:
    """Get OpenAI client with API key from environment"""
    from ..config import settings
    
    if not settings.OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY not configured. RAG functionality requires OpenAI API access.")
    
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # Test the client by making a simple request to validate the API key
        return client
    except Exception as e:
        raise Exception(f"Failed to initialize OpenAI client: {str(e)}")

def validate_openai_configuration() -> dict:
    """Validate OpenAI configuration and return status"""
    from ..config import settings
    
    validation_result = {
        "valid": False,
        "api_key_configured": bool(settings.OPENAI_API_KEY),
        "client_initialized": False,
        "error": None
    }
    
    if not settings.OPENAI_API_KEY:
        validation_result["error"] = "OPENAI_API_KEY not configured"
        return validation_result
    
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # Test with a minimal request to validate the key
        models = client.models.list()
        validation_result["client_initialized"] = True
        validation_result["valid"] = True
    except Exception as e:
        validation_result["error"] = f"OpenAI client validation failed: {str(e)}"
    
    return validation_result

# Vector Store Management
async def create_vector_store(client: OpenAI, vector_name: str):
    """Create a vector store for documents"""
    try:
        if not client:
            raise Exception("OpenAI client is not initialized")
        
        vector_store = client.vector_stores.create(name=vector_name)
        print(f"Successfully created vector store: {vector_name} with ID: {vector_store.id}")
        return vector_store
    except Exception as e:
        error_msg = f"Error creating vector store '{vector_name}': {str(e)}"
        print(error_msg)
        raise Exception(error_msg)

async def create_file_for_vector_store(
    client: OpenAI, 
    document_url: str, 
    document_name: str = None, 
    domain_name: str = None, 
    expert_name: str = None, 
    client_name: str = None
) -> str:
    """
    Create a file from a document URL and return the file ID
    
    Args:
        client: OpenAI client
        document_url: URL or local path to the document
        document_name: Optional name for the document
        domain_name: Optional domain name to associate the document with
        expert_name: Optional expert name to associate the document with
        client_name: Optional client name to associate the document with
        
    Returns:
        File ID created in OpenAI
    """
    try:
        print(f"Processing document from URL: {document_url}")
        supabase = get_supabase()
        
        # Download the document if it's a web URL
        if document_url.startswith(('http://', 'https://')):
            # Extract file extension from URL
            url_path = urllib.parse.urlparse(document_url).path
            file_extension = os.path.splitext(url_path)[1]
            print(f"Detected file extension from URL: {file_extension}")
            
            if not file_extension or file_extension not in [
                '.c', '.cpp', '.css', '.csv', '.doc', '.docx', '.gif', '.go', '.html', 
                '.java', '.jpeg', '.jpg', '.js', '.json', '.md', '.pdf', '.php', '.pkl', 
                '.png', '.pptx', '.py', '.rb', '.tar', '.tex', '.ts', '.txt', '.webp', 
                '.xlsx', '.xml', '.zip'
            ]:
                # If no extension found or invalid extension, default to PDF
                file_extension = '.pdf'
                print(f"No valid extension detected, defaulting to: {file_extension}")
            
            async with httpx.AsyncClient(timeout=60.0) as httpclient:
                response = await httpclient.get(document_url)
                response.raise_for_status()
                file_content = BytesIO(response.content)
                file_name = document_url.split("/")[-1]
                file_tuple = (file_name, file_content)
                result = client.files.create(
                    file=file_tuple,
                    purpose="assistants"
                )
        else:
            # It's a local file path
            with open(document_url, "rb") as file_content:
                result = client.files.create(
                    file=file_content,
                    purpose="assistants"
                )

        # Store document information in the documents table if domain is provided
        if domain_name:
            # Use provided document name or generate one if not provided
            if document_name:
                doc_name = document_name
            else:
                doc_count_result = supabase.table("documents").select("id").eq("domain", domain_name).execute()
                doc_count = len(doc_count_result.data) + 1
                doc_name = f"Document {doc_count}"
                
            # Initialize variables with default values
            created_by = expert_name if expert_name else None
                
            # Check if document with same name already exists
            existing_doc = supabase.table("documents").select("*").eq("name", doc_name).execute()
            
            if existing_doc.data and len(existing_doc.data) > 0:
                # Document with this name already exists
                print(f"Document with name '{doc_name}' already exists. Checking URL...")
                
                # If it's the same URL, just return the existing OpenAI file ID
                if existing_doc.data[0].get("document_link") == document_url:
                    print(f"Same URL found. Reusing existing OpenAI file ID: {existing_doc.data[0].get('openai_file_id')}")
                    return existing_doc.data[0].get("openai_file_id")
                
                # If it's a different URL, make the name unique by adding a timestamp
                timestamp = int(time.time())
                doc_name = f"{doc_name}_{timestamp}"
                print(f"Different URL. Using unique name: {doc_name}")
            
            # Insert document record
            doc_record = {
                "name": doc_name,
                "document_link": document_url,
                "domain": domain_name,
                "openai_file_id": result.id
            }
            
            # Only add these fields if they have values
            if created_by:
                doc_record["created_by"] = created_by
            if client_name:
                doc_record["client_name"] = client_name
            
            # Insert the complete record
            supabase.table("documents").insert(doc_record).execute()
            print(f"Stored document in database: {doc_name}, OpenAI file ID: {result.id}")
            
        return result.id
    except Exception as e:
        print(f"Error in create_file_for_vector_store: {str(e)}")
        raise Exception(f"Error creating file: {str(e)}")

async def create_files_for_vector_store(
    client: OpenAI, 
    document_urls: dict, 
    domain_name: str = None, 
    expert_name: str = None, 
    client_name: str = None
) -> list:
    """
    Create multiple files from document URLs and return the file IDs
    """
    print(f"Processing batch of {len(document_urls)} documents")
    file_ids = []
    failed_docs = []
    
    # Process each document URL and collect file IDs
    for doc_name, document_url in document_urls.items():
        try:
            file_id = await create_file_for_vector_store(
                client, document_url, document_name=doc_name, 
                domain_name=domain_name, expert_name=expert_name, client_name=client_name
            )
            file_ids.append(file_id)
            print(f"Created file with ID: {file_id} for document: {doc_name}")
        except Exception as e:
            print(f"Failed to process document '{doc_name}' with URL '{document_url}': {str(e)}")
            failed_docs.append(doc_name)
            continue
    
    # Report on any failed documents
    if failed_docs:
        print(f"Warning: {len(failed_docs)} documents failed to process: {', '.join(failed_docs)}")
    
    return file_ids

async def add_batch_to_vector_store(client: OpenAI, vector_store_id: str, document_ids: list):
    """Add multiple documents to a vector store using batch API"""
    try:
        print(f"Adding batch of {len(document_ids)} documents to vector store {vector_store_id}")
        result = client.vector_stores.file_batches.create(
            vector_store_id=vector_store_id,
            file_ids=document_ids
        )
        print(f"Batch creation initiated with ID: {result.id}")
        
        return {
            "id": result.id,
            "status": result.status,
            "vector_store_id": vector_store_id,
            "file_ids": document_ids
        }
    except Exception as e:
        print(f"Error adding batch to vector store: {str(e)}")
        raise Exception(f"Error adding batch to vector store: {str(e)}")

async def add_documents_to_vector_store(
    client: OpenAI, 
    vector_store_id: str, 
    document_urls: dict, 
    domain_name: str, 
    expert_name: str, 
    client_name: str = None
):
    """
    Process multiple documents and add them to a vector store using batch API
    """
    # Validate inputs
    if not client:
        raise Exception("OpenAI client is not initialized")
    
    if not vector_store_id:
        raise Exception("Vector store ID is required")
    
    if not document_urls:
        raise Exception("No document URLs provided")
    
    print(f"Starting document processing for vector store {vector_store_id} with {len(document_urls)} documents")
    
    # First create files from the documents
    try:
        file_ids = await create_files_for_vector_store(client, document_urls, domain_name, expert_name, client_name)
        print(f"Created {len(file_ids)} files with IDs: {file_ids}")
    except Exception as e:
        error_msg = f"Failed to create files from documents: {str(e)}"
        print(error_msg)
        return {
            "file_ids": [],
            "batch_id": None,
            "vector_store_id": vector_store_id,
            "status": "failed",
            "error": error_msg,
            "message": "Document file creation failed"
        }
    
    # If no files were successfully created, return early with a detailed error
    if not file_ids:
        error_msg = "No files were successfully created from the provided document URLs"
        print(f"Error: {error_msg}")
        return {
            "file_ids": [],
            "batch_id": None,
            "vector_store_id": vector_store_id,
            "status": "failed",
            "error": error_msg,
            "message": error_msg
        }
    
    try:
        # Then add the files to the vector store as a batch
        batch_result = await add_batch_to_vector_store(client, vector_store_id, file_ids)
        print(f"Added files to vector store as batch: {batch_result['id']}")
        
        return {
            "file_ids": file_ids,
            "batch_id": batch_result['id'],
            "vector_store_id": vector_store_id,
            "status": batch_result['status'],
            "message": f"Successfully added {len(file_ids)} files to vector store"
        }
    except Exception as e:
        error_msg = f"Failed to add files to vector store: {str(e)}"
        print(error_msg)
        return {
            "file_ids": file_ids,
            "batch_id": None,
            "vector_store_id": vector_store_id,
            "status": "partial_failure",
            "error": error_msg,
            "message": f"Created {len(file_ids)} files but failed to add them to vector store"
        }

async def check_batch_status(client: OpenAI, vector_store_id: str, batch_id: str):
    """Check the status of a file batch operation"""
    try:
        result = client.vector_stores.file_batches.retrieve(
            vector_store_id=vector_store_id,
            file_batch_id=batch_id
        )
        print(f"Batch status: {result.status}")
        return result
    except Exception as e:
        print(f"Error checking batch status: {str(e)}")
        raise Exception(f"Error checking batch status: {str(e)}")

# Query Functions
def extract_text_from_response(response):
    """Extract text content from various OpenAI response formats"""
    try:
        print(f"[DEBUG] extract_text_from_response: Response type: {type(response)}")
        
        # Standard way based on OpenAI's response structure
        if hasattr(response, 'output'):
            if isinstance(response.output, list):
                print(f"[DEBUG] extract_text_from_response: Output is a list with {len(response.output)} items")
                
                # Extract text using the pattern shown in the example
                for msg in response.output:
                    if hasattr(msg, 'role') and msg.role == "assistant" and hasattr(msg, 'content'):
                        for content in msg.content:
                            if hasattr(content, 'text'):
                                print(f"[DEBUG] extract_text_from_response: Found text in assistant message")
                                return content.text
                
                # If we didn't find an assistant message, try any message
                for msg in response.output:
                    if hasattr(msg, 'content') and isinstance(msg.content, list):
                        for content in msg.content:
                            if hasattr(content, 'text'):
                                return content.text
        
        # Handle ResponseOutputMessage string representation
        if hasattr(response, 'text'):
            text_value = response.text
            if isinstance(text_value, str):
                if 'ResponseOutputMessage' in text_value and 'text=' in text_value:
                    # Extract using regex
                    match = re.search(r"text='([^']*)'(?:, type='output_text')", text_value)
                    if match:
                        extracted_text = match.group(1)
                        extracted_text = extracted_text.replace("\'", "'")
                        return extracted_text
                    else:
                        # Try a more general pattern
                        match = re.search(r"text='(.*?)'", text_value)
                        if match:
                            extracted_text = match.group(1)
                            extracted_text = extracted_text.replace("\'", "'")
                            return extracted_text
                return text_value
            elif hasattr(text_value, 'text'):
                return text_value.text
        
        # Check for content attribute
        if hasattr(response, 'content') and isinstance(response.content, list):
            for item in response.content:
                if hasattr(item, 'text'):
                    return item.text
        
        # If we got here, return the string representation as a last resort
        return str(response)
    except Exception as e:
        print(f"[ERROR] extract_text_from_response: {str(e)}")
        return str(response)

async def query_vector_index(query: str, vector_store_ids: list = None, context: str = "") -> dict:
    """
    Query a vector index using OpenAI's vectorStores API with file_search tool
    If vector_store_ids is None, use LLM memory (no vector search)
    """
    try:
        client = get_openai_client()
        print(f"[DEBUG] query_vector_index: Starting query '{query}' with vector_store_ids '{vector_store_ids}'")

        try:
            # Use LLM directly if no vector_store_ids provided
            if not vector_store_ids:
                print(f"[DEBUG] query_vector_index: No vector_store_ids provided, using LLM directly")
                response = client.responses.create(
                    model="gpt-4o",
                    input=[
                        {"role": "system", "content": context},
                        {"role": "user", "content": query}
                    ],
                    temperature=0
                )
            else:
                # Use vector search
                print(f"[DEBUG] query_vector_index: Creating OpenAI response with file_search tool")
                response = client.responses.create(
                    model="gpt-4o",
                    input=[
                        {"role": "system", "content": context},
                        {"role": "user", "content": query}
                    ],
                    tools=[
                        {
                            "type": "file_search",
                            "vector_store_ids": vector_store_ids,
                            "max_num_results": 2
                        }
                    ],
                    include=["file_search_call.results"],
                    temperature=0
                )
        except Exception as e:
            print(f"[ERROR] query_vector_index: Failed to create OpenAI response: {str(e)}")
            raise

        # Process the response
        actual_text = extract_text_from_response(response)
        
        # Ensure we have a string
        if not isinstance(actual_text, str):
            actual_text = str(actual_text)
            
        return {"text": actual_text, "citations": None}
    except Exception as e:
        print(f"[ERROR] query_vector_index: {str(e)}")
        raise Exception(f"Error querying vector index: {str(e)}")

# OpenAI Assistant API Functions
async def create_assistant(expert_name: str, memory_type: str = "expert", client_name: str = None, model: str = "gpt-4o"):
    """Create an OpenAI Assistant for a specific expert and memory type"""
    try:
        # Validate OpenAI configuration first
        validation = validate_openai_configuration()
        if not validation["valid"]:
            raise Exception(f"Cannot create assistant - OpenAI configuration invalid: {validation['error']}")
        
        client = get_openai_client()
        supabase = get_supabase()
        print(f"[DEBUG] create_assistant: Creating assistant for expert '{expert_name}' with memory type '{memory_type}'")
        
        # Get expert context
        expert_result = supabase.table("experts").select("*").eq("name", expert_name).execute()
        if not expert_result.data or len(expert_result.data) == 0:
            raise Exception(f"Expert '{expert_name}' not found")
        
        expert_data = expert_result.data[0]
        
        # Get vector store ID based on memory type
        vector_id = None
        try:
            query = supabase.table("vector_stores").select("vector_id")
            
            # Apply filters based on available information
            domain_name = expert_data.get("domain")
            if domain_name:
                query = query.eq("domain_name", domain_name)
            
            if expert_name:
                query = query.eq("expert_name", expert_name)
            else:
                query = query.is_("expert_name", "null")
            
            if client_name:
                if not expert_name:
                    raise Exception("Cannot specify client name without expert name")
                query = query.eq("client_name", client_name)
            else:
                query = query.is_("client_name", "null")
            
            vector_store_result = query.execute()
            
            if vector_store_result.data and len(vector_store_result.data) > 0:
                vector_id = vector_store_result.data[0].get("vector_id")
                
            print(f"[DEBUG] create_assistant: Found {vector_id} vector store ID")
            
        except Exception as e:
            print(f"[ERROR] create_assistant: Error getting vector IDs: {str(e)}")
        
        # Create assistant instructions
        instructions = f"You are an AI assistant named {expert_name}."
        
        if expert_data.get("context"):
            instructions += f"\\n\\nYou have the following experience and expertise: {expert_data.get('context')}."
        
        if memory_type == "domain":
            instructions += f"\\n\\nYou have access to domain knowledge about {expert_data.get('domain')}."
        elif memory_type == "expert":
            instructions += f"\\n\\nYou have access to expert-specific knowledge."
        elif memory_type == "client" and client_name:
            instructions += f"\\n\\nYou have access to client-specific knowledge for {client_name}."
        
        # Create the assistant
        tools = []
        tool_resources = {}
        if vector_id and memory_type != "llm":
            tools.append({"type": "file_search"})
            tool_resources = {
                "file_search": {
                    "vector_store_ids": [vector_id]
                }
            }
        
        assistant = client.beta.assistants.create(
            name=f"{expert_name}_{memory_type}" + (f"_{client_name}" if client_name else ""),
            instructions=instructions,
            model=model,
            tools=tools,
            tool_resources=tool_resources
        )
        
        # Store assistant ID in database
        try:
            assistant_data = {
                "assistant_id": assistant.id,
                "expert_name": expert_name,
                "memory_type": memory_type,
                "client_name": client_name,
                "vector_id": vector_id
            }
            
            supabase.table("assistants").insert(assistant_data).execute()
            print(f"[DEBUG] create_assistant: Assistant created with ID: {assistant.id}")
        except Exception as e:
            print(f"[ERROR] create_assistant: Error storing assistant data: {str(e)}")
            try:
                client.beta.assistants.delete(assistant.id)
            except:
                pass
            raise Exception(f"Error storing assistant data: {str(e)}")
        
        return assistant
    except Exception as e:
        print(f"[ERROR] create_assistant: {str(e)}")
        raise Exception(f"Error creating assistant: {str(e)}")

async def get_or_create_assistant(expert_name: str, memory_type: str = "expert", client_name: str = None, model: str = "gpt-4o"):
    """Get an existing assistant or create a new one"""
    try:
        # Validate OpenAI configuration first
        validation = validate_openai_configuration()
        if not validation["valid"]:
            raise Exception(f"Cannot get or create assistant - OpenAI configuration invalid: {validation['error']}")
        
        supabase = get_supabase()
        client = get_openai_client()
        print(f"[DEBUG] get_or_create_assistant: Looking for assistant for expert '{expert_name}' with memory type '{memory_type}'")
        
        # Check if assistant already exists
        query = supabase.table("assistants").select("*").eq("expert_name", expert_name).eq("memory_type", memory_type)
        
        if memory_type == "client" and client_name:
            query = query.eq("client_name", client_name)
        elif memory_type != "client":
            query = query.is_("client_name", "null")
        
        result = query.execute()
        
        if result.data and len(result.data) > 0:
            assistant_id = result.data[0].get("assistant_id")
            print(f"[DEBUG] get_or_create_assistant: Found existing assistant with ID: {assistant_id}")
            
            try:
                assistant = client.beta.assistants.retrieve(assistant_id)
                return assistant
            except Exception as e:
                print(f"[ERROR] get_or_create_assistant: Error retrieving assistant: {str(e)}")
                return await create_assistant(expert_name, memory_type, client_name, model)
        else:
            print(f"[DEBUG] get_or_create_assistant: No existing assistant found, creating new one")
            return await create_assistant(expert_name, memory_type, client_name, model)
    except Exception as e:
        print(f"[ERROR] get_or_create_assistant: {str(e)}")
        raise Exception(f"Error getting or creating assistant: {str(e)}")

async def create_thread():
    """Create a new thread for conversation"""
    try:
        client = get_openai_client()
        thread = client.beta.threads.create()
        return thread
    except Exception as e:
        raise Exception(f"Error creating thread: {str(e)}")

async def add_message_to_thread(thread_id: str, content: str, role: str = "user"):
    """Add a message to a thread"""
    try:
        client = get_openai_client()
        message = client.beta.threads.messages.create(
            thread_id=thread_id,
            role=role,
            content=content
        )
        return message
    except Exception as e:
        raise Exception(f"Error adding message to thread: {str(e)}")

async def run_thread(thread_id: str, assistant_id: str):
    """Run a thread with an assistant"""
    try:
        client = get_openai_client()
        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=assistant_id
        )
        return run
    except Exception as e:
        raise Exception(f"Error running thread: {str(e)}")

async def get_run_status(thread_id: str, run_id: str):
    """Get the status of a run"""
    try:
        client = get_openai_client()
        run = client.beta.threads.runs.retrieve(
            thread_id=thread_id,
            run_id=run_id
        )
        return run
    except Exception as e:
        raise Exception(f"Error getting run status: {str(e)}")

async def get_thread_messages(thread_id: str, limit: int = 10):
    """Get messages from a thread"""
    try:
        client = get_openai_client()
        messages = client.beta.threads.messages.list(
            thread_id=thread_id,
            limit=limit
        )
        return messages
    except Exception as e:
        raise Exception(f"Error getting thread messages: {str(e)}")

async def wait_for_run_completion(thread_id: str, run_id: str, max_wait_seconds: int = 60):
    """Wait for a run to complete"""
    try:
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            run = await get_run_status(thread_id, run_id)
            
            if run.status in ["completed", "failed", "cancelled", "expired"]:
                return run
            
            await asyncio.sleep(1)
        
        # If we get here, we timed out
        return await get_run_status(thread_id, run_id)
    except Exception as e:
        raise Exception(f"Error waiting for run completion: {str(e)}")

async def get_assistant_response(thread_id: str, run_id: str):
    """Get the assistant's response from a completed run"""
    try:
        messages = await get_thread_messages(thread_id, limit=1)
        
        if not messages.data:
            return "No response from assistant."
        
        latest_message = messages.data[0]
        
        if latest_message.role != "assistant":
            return "No response from assistant."
        
        # Extract the text from the message content
        response_text = ""
        for content_item in latest_message.content:
            if content_item.type == "text":
                response_text += content_item.text.value
        
        return response_text
    except Exception as e:
        raise Exception(f"Error getting assistant response: {str(e)}")

async def query_expert_with_assistant(
    expert_name: str, 
    query: str, 
    memory_type: str = "expert", 
    client_name: str = None, 
    thread_id: str = None
):
    """
    Query an expert using the OpenAI Assistant API
    
    Args:
        expert_name: Name of the expert
        query: User query
        memory_type: Type of memory to use (llm, domain, expert, client)
        client_name: Optional client name for client-specific memory
        thread_id: Optional thread ID for continuing a conversation
        
    Returns:
        Dictionary with response, thread_id, and run_id
    """
    try:
        print(f"[DEBUG] query_expert_with_assistant: Querying expert '{expert_name}' with memory type '{memory_type}'")
        
        # Validate OpenAI configuration before proceeding
        validation = validate_openai_configuration()
        if not validation["valid"]:
            raise Exception(f"OpenAI configuration invalid: {validation['error']}")
        
        # Validate inputs
        if not expert_name or not query:
            raise Exception("Expert name and query are required")
        
        # Get or create the assistant
        assistant = await get_or_create_assistant(expert_name, memory_type, client_name)
        if not assistant:
            raise Exception(f"Failed to get or create assistant for expert '{expert_name}'")
        
        # Create a thread if one wasn't provided
        if not thread_id:
            thread = await create_thread()
            thread_id = thread.id
            print(f"[DEBUG] Created new thread: {thread_id}")
        
        # Add the user message to the thread
        await add_message_to_thread(thread_id, query)
        
        # Run the thread with the assistant
        run = await run_thread(thread_id, assistant.id)
        
        # Wait for the run to complete
        run = await wait_for_run_completion(thread_id, run.id)
        
        if run.status != "completed":
            raise Exception(f"Assistant run failed with status: {run.status}")
        
        # Get the assistant's response
        response = await get_assistant_response(thread_id, run.id)
        
        if not response:
            raise Exception("No response received from assistant")
        
        return {
            "response": {"text": response},
            "thread_id": thread_id,
            "run_id": run.id,
            "assistant_id": assistant.id,
            "expert_name": expert_name,
            "status": run.status
        }
    except Exception as e:
        error_msg = f"Error querying expert '{expert_name}' with assistant: {str(e)}"
        print(f"[ERROR] query_expert_with_assistant: {error_msg}")
        raise Exception(error_msg)

async def generate_persona_from_qa(client: OpenAI, qa_data: List[Dict[str, str]]):
    """Generate a persona summary from question-answer data"""
    try:
        if not client:
            raise Exception("OpenAI client is not initialized")
        
        if not qa_data:
            raise Exception("No QA data provided for persona generation")
        
        print(f"[DEBUG] generate_persona_from_qa: Generating persona from {len(qa_data)} QA pairs")
        
        # Format QA data as a string
        qa_formatted = ""
        for i, qa in enumerate(qa_data):
            qa_formatted += f"Question {i+1}: {qa.get('question', '')}\\n"
            qa_formatted += f"Answer {i+1}: {qa.get('answer', '')}\\n\\n"
        
        # Create system prompt
        system_prompt = """Use the question and answers to understand the experience and expertise of the individual. 
        Summarize them into a five to six line summary describing the individual's persona. 
        This summary should capture their expertise, experience, and communication style 
        so that it can be passed as a system prompt to any LLM call."""
        
        # Create user prompt
        user_prompt = f"Here are the question-answer pairs:\\n\\n{qa_formatted}\\n\\nBased on these, create a concise persona summary."
        
        # Call OpenAI API
        response = client.responses.create(
            model="gpt-4o",
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7
        )
        
        # Extract the generated persona
        persona_summary = extract_text_from_response(response)
        return persona_summary
    except Exception as e:
        print(f"[ERROR] generate_persona_from_qa: {str(e)}")
        raise Exception(f"Error generating persona from QA data: {str(e)}")