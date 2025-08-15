"""
Optimized RAG Core - Simplified version of your existing implementation
This removes unnecessary complexity while maintaining all functionality
"""

import asyncio
import httpx
from typing import Dict, List, Optional, Any
from openai import OpenAI
from io import BytesIO
from ..database import get_supabase
from ..config import settings

class OptimizedRAGCore:
    """Optimized version of your RAG implementation"""
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise Exception("OPENAI_API_KEY not configured")
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.supabase = get_supabase()
    
    async def create_clone_knowledge_base(
        self,
        clone_id: str,
        clone_name: str,
        document_urls: Dict[str, str],  # {doc_name: url}
        bio: str = "",
        personality: Dict = None
    ) -> Dict[str, Any]:
        """
        Simplified clone knowledge base creation
        Replaces your complex multi-step process with streamlined approach
        """
        try:
            # Generate expert name (consistent with your current approach)
            expert_name = clone_name.replace(" ", "_").lower() + f"_{clone_id[:8]}"
            
            # Create vector store
            vector_store = self.client.beta.vector_stores.create(
                name=f"{expert_name}_knowledge"
            )
            
            # Upload documents in parallel for better performance
            file_ids = await self._upload_documents_batch(document_urls)
            
            if not file_ids:
                raise Exception("No documents were successfully processed")
            
            # Add files to vector store
            file_batch = self.client.beta.vector_stores.file_batches.create(
                vector_store_id=vector_store.id,
                file_ids=file_ids
            )
            
            # Wait for processing to complete
            await self._wait_for_batch_completion(vector_store.id, file_batch.id)
            
            # Create assistant with personality
            instructions = self._build_instructions(clone_name, bio, personality)
            
            assistant = self.client.beta.assistants.create(
                name=expert_name,
                instructions=instructions,
                model="gpt-4o",
                tools=[{"type": "file_search"}],
                tool_resources={
                    "file_search": {
                        "vector_store_ids": [vector_store.id]
                    }
                }
            )
            
            # Store in database (simplified)
            self._store_clone_data(clone_id, expert_name, assistant.id, vector_store.id)
            
            return {
                "status": "success",
                "expert_name": expert_name,
                "assistant_id": assistant.id,
                "vector_store_id": vector_store.id,
                "documents_processed": len(file_ids)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _upload_documents_batch(self, document_urls: Dict[str, str]) -> List[str]:
        """Upload documents in parallel for better performance"""
        tasks = []
        for doc_name, url in document_urls.items():
            tasks.append(self._upload_single_document(url, doc_name))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter successful uploads
        file_ids = []
        for result in results:
            if isinstance(result, str):  # file_id
                file_ids.append(result)
            elif isinstance(result, Exception):
                print(f"Document upload failed: {result}")
        
        return file_ids
    
    async def _upload_single_document(self, url: str, doc_name: str) -> str:
        """Upload a single document to OpenAI"""
        try:
            if url.startswith(('http://', 'https://')):
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    
                    file_content = BytesIO(response.content)
                    filename = doc_name or url.split("/")[-1] or "document.pdf"
                    
                    file_obj = self.client.files.create(
                        file=(filename, file_content),
                        purpose="assistants"
                    )
                    return file_obj.id
            else:
                # Local file
                with open(url, "rb") as file:
                    file_obj = self.client.files.create(
                        file=file,
                        purpose="assistants"
                    )
                    return file_obj.id
        except Exception as e:
            raise Exception(f"Failed to upload {doc_name}: {str(e)}")
    
    async def _wait_for_batch_completion(self, vector_store_id: str, batch_id: str, timeout: int = 300):
        """Wait for file batch processing to complete"""
        start_time = asyncio.get_event_loop().time()
        
        while True:
            try:
                batch = self.client.beta.vector_stores.file_batches.retrieve(
                    vector_store_id=vector_store_id,
                    file_batch_id=batch_id
                )
                
                if batch.status in ["completed", "failed"]:
                    if batch.status == "failed":
                        raise Exception("Batch processing failed")
                    break
                
                # Check timeout
                if asyncio.get_event_loop().time() - start_time > timeout:
                    raise Exception("Batch processing timeout")
                
                await asyncio.sleep(2)  # Check every 2 seconds
                
            except Exception as e:
                if "timeout" in str(e) or "failed" in str(e):
                    raise
                # Continue on temporary errors
                await asyncio.sleep(5)
    
    def _build_instructions(self, clone_name: str, bio: str, personality: Dict = None) -> str:
        """Build assistant instructions with personality"""
        instructions = f"You are {clone_name}, an AI assistant."
        
        if bio:
            instructions += f"\n\nBackground: {bio}"
        
        if personality:
            traits = []
            if personality.get("communication_style"):
                traits.append(f"Communication style: {personality['communication_style']}")
            if personality.get("expertise_level"):
                traits.append(f"Expertise level: {personality['expertise_level']}")
            if personality.get("response_length"):
                traits.append(f"Response length preference: {personality['response_length']}")
            
            if traits:
                instructions += f"\n\nPersonality traits: {', '.join(traits)}"
        
        instructions += "\n\nUse the knowledge from uploaded documents to answer questions accurately. Always cite sources when referencing specific information."
        
        return instructions
    
    def _store_clone_data(self, clone_id: str, expert_name: str, assistant_id: str, vector_store_id: str):
        """Store clone data in database"""
        try:
            # Update clones table with RAG info
            self.supabase.table("clones").update({
                "rag_expert_name": expert_name,
                "rag_assistant_id": assistant_id,
                "rag_status": "completed"
            }).eq("id", clone_id).execute()
            
            # Store assistant info (if table exists)
            try:
                self.supabase.table("clone_assistants").upsert({
                    "clone_id": clone_id,
                    "assistant_id": assistant_id,
                    "expert_name": expert_name,
                    "vector_store_id": vector_store_id
                }).execute()
            except:
                pass  # Table might not exist yet
                
        except Exception as e:
            print(f"Warning: Failed to store clone data: {e}")
            # Don't fail the entire process for database storage issues
    
    async def query_clone(
        self,
        clone_id: str,
        query: str,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Query a clone using simplified approach"""
        try:
            # Get assistant ID from database
            clone_data = self.supabase.table("clones").select("rag_assistant_id").eq("id", clone_id).execute()
            
            if not clone_data.data or not clone_data.data[0].get("rag_assistant_id"):
                raise Exception("Clone not found or not properly initialized")
            
            assistant_id = clone_data.data[0]["rag_assistant_id"]
            
            # Create or use existing thread
            if not thread_id:
                thread = self.client.beta.threads.create()
                thread_id = thread.id
            
            # Add message and run
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=query
            )
            
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=assistant_id
            )
            
            # Wait for completion
            run = await self._wait_for_run_completion(thread_id, run.id)
            
            if run.status == "completed":
                # Get response
                messages = self.client.beta.threads.messages.list(
                    thread_id=thread_id,
                    limit=1
                )
                
                response_text = ""
                if messages.data and messages.data[0].role == "assistant":
                    for content in messages.data[0].content:
                        if content.type == "text":
                            response_text += content.text.value
                
                return {
                    "response": {"text": response_text},
                    "thread_id": thread_id,
                    "status": "success"
                }
            else:
                raise Exception(f"Query failed with status: {run.status}")
                
        except Exception as e:
            return {
                "response": {"text": "I'm sorry, I'm experiencing technical difficulties."},
                "status": "error",
                "error": str(e)
            }
    
    async def _wait_for_run_completion(self, thread_id: str, run_id: str, timeout: int = 60):
        """Wait for assistant run to complete"""
        start_time = asyncio.get_event_loop().time()
        
        while True:
            run = self.client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run_id
            )
            
            if run.status in ["completed", "failed", "cancelled", "expired"]:
                return run
            
            if asyncio.get_event_loop().time() - start_time > timeout:
                raise Exception("Query timeout")
            
            await asyncio.sleep(1)

# Convenience functions for your existing API endpoints
async def process_clone_knowledge_optimized(
    clone_id: str,
    clone_name: str,
    document_urls: Dict[str, str],
    clone_bio: str = "",
    personality_traits: Dict = None
) -> Dict[str, Any]:
    """Optimized version of your process_clone_knowledge function"""
    rag = OptimizedRAGCore()
    return await rag.create_clone_knowledge_base(
        clone_id=clone_id,
        clone_name=clone_name,
        document_urls=document_urls,
        bio=clone_bio,
        personality=personality_traits
    )

async def query_clone_expert_optimized(
    clone_id: str,
    query: str,
    thread_id: Optional[str] = None
) -> Dict[str, Any]:
    """Optimized version of your query_clone_expert function"""
    rag = OptimizedRAGCore()
    return await rag.query_clone(clone_id, query, thread_id)