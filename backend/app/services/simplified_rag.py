"""
Simplified OpenAI Native RAG Implementation
This demonstrates a cleaner approach using OpenAI's built-in capabilities
"""

import asyncio
import httpx
from typing import Dict, List, Optional, Any
from openai import OpenAI
from io import BytesIO

class SimplifiedRAGService:
    """Simplified RAG service using OpenAI's native capabilities"""
    
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    async def create_knowledge_base(
        self, 
        name: str, 
        document_urls: List[str],
        instructions: str = None
    ) -> Dict[str, Any]:
        """
        Create a complete knowledge base with documents in one step
        Uses OpenAI's native file processing and vector store creation
        """
        try:
            # Step 1: Create vector store
            vector_store = self.client.beta.vector_stores.create(
                name=f"{name}_knowledge_base"
            )
            
            # Step 2: Process and upload documents
            file_ids = []
            for url in document_urls:
                try:
                    file_id = await self._upload_document(url)
                    file_ids.append(file_id)
                except Exception as e:
                    print(f"Failed to process {url}: {e}")
                    continue
            
            # Step 3: Add files to vector store in batch
            if file_ids:
                self.client.beta.vector_stores.file_batches.create(
                    vector_store_id=vector_store.id,
                    file_ids=file_ids
                )
            
            # Step 4: Create assistant with file_search
            assistant = self.client.beta.assistants.create(
                name=name,
                instructions=instructions or f"You are {name}, an AI assistant with access to uploaded knowledge.",
                model="gpt-4o",
                tools=[{"type": "file_search"}],
                tool_resources={
                    "file_search": {
                        "vector_store_ids": [vector_store.id]
                    }
                }
            )
            
            return {
                "assistant_id": assistant.id,
                "vector_store_id": vector_store.id,
                "processed_files": len(file_ids),
                "status": "success"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _upload_document(self, document_url: str) -> str:
        """Upload a document to OpenAI and return file ID"""
        if document_url.startswith(('http://', 'https://')):
            # Download from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(document_url)
                response.raise_for_status()
                
                # Create file object
                file_content = BytesIO(response.content)
                filename = document_url.split("/")[-1] or "document.pdf"
                
                # Upload to OpenAI
                file_obj = self.client.files.create(
                    file=(filename, file_content),
                    purpose="assistants"
                )
                return file_obj.id
        else:
            # Local file
            with open(document_url, "rb") as file:
                file_obj = self.client.files.create(
                    file=file,
                    purpose="assistants"
                )
                return file_obj.id
    
    async def query(
        self, 
        assistant_id: str, 
        query: str, 
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Query the assistant using native RAG"""
        try:
            # Create or use existing thread
            if not thread_id:
                thread = self.client.beta.threads.create()
                thread_id = thread.id
            
            # Add message
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=query
            )
            
            # Run with assistant
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=assistant_id
            )
            
            # Wait for completion
            while run.status in ["queued", "in_progress"]:
                await asyncio.sleep(1)
                run = self.client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run.id
                )
            
            if run.status == "completed":
                # Get response
                messages = self.client.beta.threads.messages.list(
                    thread_id=thread_id,
                    limit=1
                )
                
                response_content = ""
                if messages.data and messages.data[0].role == "assistant":
                    for content in messages.data[0].content:
                        if content.type == "text":
                            response_content += content.text.value
                
                return {
                    "response": response_content,
                    "thread_id": thread_id,
                    "status": "success"
                }
            else:
                return {
                    "status": "error",
                    "error": f"Run failed with status: {run.status}"
                }
                
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# Usage example for your CloneAI project
async def create_clone_expert_simplified(
    clone_id: str,
    clone_name: str,
    document_urls: List[str],
    bio: str = "",
    personality_traits: Dict = None
) -> Dict[str, Any]:
    """Simplified clone expert creation"""
    
    # Initialize RAG service
    rag = SimplifiedRAGService(api_key="your-openai-key")
    
    # Create instructions with personality
    instructions = f"You are {clone_name}, an AI clone."
    if bio:
        instructions += f"\n\nBackground: {bio}"
    if personality_traits:
        traits = ", ".join([f"{k}: {v}" for k, v in personality_traits.items()])
        instructions += f"\n\nPersonality: {traits}"
    
    # Create knowledge base
    result = await rag.create_knowledge_base(
        name=clone_name,
        document_urls=document_urls,
        instructions=instructions
    )
    
    return result

async def query_clone_simplified(
    assistant_id: str, 
    query: str, 
    thread_id: Optional[str] = None
) -> Dict[str, Any]:
    """Simplified clone querying"""
    
    rag = SimplifiedRAGService(api_key="your-openai-key")
    return await rag.query(assistant_id, query, thread_id)