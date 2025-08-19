#!/usr/bin/env python3
"""
Test script to verify RAG workflow is triggered on document upload
"""

import asyncio
import httpx
import time
import os
import sys
from pathlib import Path

# Test configuration
BACKEND_URL = "http://localhost:8000"
API_BASE = f"{BACKEND_URL}/api/v1"

# Test data
TEST_CLONE_ID = "test-clone-12345"  # You'll need to create this clone or use an existing one
TEST_USER_TOKEN = "test-jwt-token"  # You'll need a valid JWT token

async def test_rag_workflow():
    """Test the complete RAG workflow from upload to processing"""
    
    print("🚀 Starting RAG Workflow Test")
    print("=" * 50)
    
    # Check if test document exists
    test_doc_path = Path(__file__).parent / "test_document.txt"
    if not test_doc_path.exists():
        print("❌ Test document not found!")
        return False
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        
        # Step 1: Test backend health
        print("\n1️⃣ Testing backend health...")
        try:
            health_response = await client.get(f"{BACKEND_URL}/health")
            if health_response.status_code == 200:
                print("✅ Backend is healthy")
                health_data = health_response.json()
                print(f"   Version: {health_data.get('version', 'unknown')}")
            else:
                print(f"❌ Backend health check failed: {health_response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Backend health check failed: {e}")
            return False
        
        # Step 2: Check detailed health for services
        print("\n2️⃣ Checking service health...")
        try:
            detailed_health = await client.get(f"{BACKEND_URL}/health/detailed")
            if detailed_health.status_code == 200:
                services = detailed_health.json().get("services", {})
                for service, status in services.items():
                    status_emoji = "✅" if status.get("status") == "healthy" else "⚠️"
                    print(f"   {status_emoji} {service}: {status.get('status', 'unknown')}")
            else:
                print("⚠️ Could not get detailed health info")
        except Exception as e:
            print(f"⚠️ Detailed health check failed: {e}")
        
        # Step 3: Check if we can access the upload endpoint (without auth for now)
        print("\n3️⃣ Testing upload endpoint accessibility...")
        
        # Create a test clone first (simplified for testing)
        print("   Creating test clone...")
        test_clone_data = {
            "name": "Test ML Expert",
            "description": "A test clone for machine learning expertise",
            "bio": "Expert in machine learning and AI development",
            "expertise_areas": ["Machine Learning", "AI Development"],
            "category": "technology",
            "is_published": False
        }
        
        # Note: For a real test, you'd need proper authentication
        # For now, let's test with a simple document upload simulation
        
        # Step 4: Upload test document
        print("\n4️⃣ Attempting document upload...")
        try:
            with open(test_doc_path, 'rb') as file:
                files = {
                    'file': ('test_document.txt', file, 'text/plain')
                }
                data = {
                    'title': 'Machine Learning Best Practices',
                    'description': 'Test document for RAG workflow',
                    'tags_str': 'machine learning, AI, best practices',
                    'force_overwrite': 'false'
                }
                
                # This will fail without proper auth, but we can see if the endpoint exists
                upload_response = await client.post(
                    f"{API_BASE}/clones/{TEST_CLONE_ID}/documents",
                    files=files,
                    data=data,
                    headers={"Authorization": f"Bearer {TEST_USER_TOKEN}"}
                )
                
                if upload_response.status_code == 201:
                    print("✅ Document uploaded successfully!")
                    doc_data = upload_response.json()
                    document_id = doc_data.get('id')
                    print(f"   Document ID: {document_id}")
                    print(f"   Processing Status: {doc_data.get('processing_status')}")
                    
                    # Step 5: Monitor processing status
                    print("\n5️⃣ Monitoring processing status...")
                    await monitor_processing_status(client, TEST_CLONE_ID, document_id)
                    
                elif upload_response.status_code == 401:
                    print("⚠️ Authentication required (expected for real test)")
                    print("   Upload endpoint is accessible but needs valid JWT token")
                elif upload_response.status_code == 404:
                    print("⚠️ Clone not found - you need to create a test clone first")
                else:
                    print(f"❌ Upload failed: {upload_response.status_code}")
                    print(f"   Response: {upload_response.text}")
                    
        except Exception as e:
            print(f"❌ Upload test failed: {e}")
        
        # Step 6: Test enhanced RAG endpoints
        print("\n6️⃣ Testing enhanced RAG endpoints...")
        await test_enhanced_rag_endpoints(client)
        
    print("\n" + "=" * 50)
    print("🏁 RAG Workflow Test Complete")
    return True


async def monitor_processing_status(client, clone_id, document_id, max_wait=60):
    """Monitor document processing status"""
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        try:
            # Check document status
            status_response = await client.get(
                f"{API_BASE}/documents/{document_id}",
                headers={"Authorization": f"Bearer {TEST_USER_TOKEN}"}
            )
            
            if status_response.status_code == 200:
                doc_data = status_response.json()
                status = doc_data.get('processing_status', 'unknown')
                print(f"   Status: {status}")
                
                if status == 'completed':
                    print("✅ Document processing completed!")
                    break
                elif status == 'failed':
                    print("❌ Document processing failed!")
                    break
                elif status == 'processing':
                    print("⏳ Processing in progress...")
                
            await asyncio.sleep(5)  # Wait 5 seconds before checking again
            
        except Exception as e:
            print(f"   Error checking status: {e}")
            break
    
    else:
        print("⏰ Timeout waiting for processing to complete")


async def test_enhanced_rag_endpoints(client):
    """Test enhanced RAG endpoints availability"""
    endpoints_to_test = [
        "/api/enhanced-rag/search-strategies",
        f"/api/enhanced-rag/status/{TEST_CLONE_ID}",
        f"/api/enhanced-rag/analytics/{TEST_CLONE_ID}"
    ]
    
    for endpoint in endpoints_to_test:
        try:
            response = await client.get(
                f"{API_BASE}{endpoint}",
                headers={"Authorization": f"Bearer {TEST_USER_TOKEN}"}
            )
            
            if response.status_code == 200:
                print(f"   ✅ {endpoint}")
            elif response.status_code == 401:
                print(f"   🔒 {endpoint} (auth required)")
            elif response.status_code == 404:
                print(f"   ❌ {endpoint} (not found)")
            else:
                print(f"   ⚠️ {endpoint} ({response.status_code})")
                
        except Exception as e:
            print(f"   ❌ {endpoint} (error: {e})")


def create_real_test_instructions():
    """Print instructions for running a real test"""
    print("\n" + "🔧 Real Test Instructions")
    print("=" * 50)
    print("To run a complete end-to-end test:")
    print()
    print("1. Start the backend server:")
    print("   cd backend && python -m app.main")
    print()
    print("2. Create a test clone via API or UI")
    print("3. Get a valid JWT token for authentication")
    print("4. Update TEST_CLONE_ID and TEST_USER_TOKEN in this script")
    print("5. Run this script again")
    print()
    print("Expected flow:")
    print("   📄 Upload document → 🔄 Auto RAG processing → ✅ Ready for queries")


if __name__ == "__main__":
    print("RAG Workflow Test Script")
    print("This script tests the automatic RAG processing after document upload")
    print()
    
    # Check if backend is likely running
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    backend_running = sock.connect_ex(('localhost', 8000)) == 0
    sock.close()
    
    if not backend_running:
        print("⚠️ Backend does not appear to be running on localhost:8000")
        print("Please start the backend first:")
        print("   cd backend && python -m app.main")
        print()
        create_real_test_instructions()
        sys.exit(1)
    
    # Run the test
    asyncio.run(test_rag_workflow())
    
    # Show instructions for real testing
    create_real_test_instructions()