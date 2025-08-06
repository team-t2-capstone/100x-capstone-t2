#!/usr/bin/env python3
"""
Test OpenAI Integration
Tests the AI chat endpoints and OpenAI service
"""
import asyncio
import httpx
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://127.0.0.1:8001"
API_V1 = "/api/v1"

# Test user credentials (you may need to update these)
TEST_USER = {
    "email": "ai.test@gmail.com",
    "password": "TestPassword123!",
    "full_name": "AI Test User",
    "role": "user"
}

class AITestRunner:
    def __init__(self):
        self.access_token = None
        
    async def authenticate(self):
        """Get access token for testing"""
        print("🔐 Authenticating test user...")
        
        async with httpx.AsyncClient() as client:
            # Try to login first
            try:
                response = await client.post(
                    f"{BASE_URL}{API_V1}/auth/login",
                    json={
                        "email": TEST_USER["email"],
                        "password": TEST_USER["password"]
                    },
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self.access_token = result.get('access_token')
                    print("✅ Login successful")
                    return True
                    
            except Exception as e:
                print(f"Login failed, trying registration: {e}")
            
            # If login fails, try registration
            try:
                response = await client.post(
                    f"{BASE_URL}{API_V1}/auth/signup",
                    json=TEST_USER,
                    timeout=15.0
                )
                
                if response.status_code == 201:
                    print("✅ Registration successful (email verification may be required)")
                    return True
                else:
                    print(f"❌ Authentication failed: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Authentication error: {e}")
                return False

    def get_headers(self):
        """Get authorization headers"""
        if self.access_token:
            return {"Authorization": f"Bearer {self.access_token}"}
        return {}

    async def test_ai_health(self):
        """Test AI service health"""
        print("\n🏥 Testing AI Service Health...")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BASE_URL}{API_V1}/ai/health",
                    timeout=10.0
                )
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ AI service health check:")
                    print(f"   Service Available: {result.get('available', 'N/A')}")
                    print(f"   API Key Configured: {result.get('api_key_configured', 'N/A')}")
                    print(f"   Usage: {result.get('usage', {})}")
                    
                    if result.get('test_successful'):
                        print(f"   Test Model: {result.get('test_model', 'N/A')}")
                        return True
                    else:
                        print(f"   Test Error: {result.get('test_error', 'N/A')}")
                        return False
                else:
                    print(f"❌ Health check failed: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Health check error: {e}")
                return False

    async def test_simple_chat(self):
        """Test simple chat endpoint"""
        print("\n💬 Testing Simple Chat...")
        
        if not self.access_token:
            print("⚠️ No access token, testing without authentication")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{BASE_URL}{API_V1}/ai/chat/simple",
                    params={"message": "Hello! Can you tell me what you are?"},
                    headers=self.get_headers(),
                    timeout=30.0
                )
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Simple chat successful:")
                    print(f"   Response: {result.get('message', 'N/A')[:100]}...")
                    print(f"   Model: {result.get('model', 'N/A')}")
                    print(f"   Usage: {result.get('usage', {})}")
                    return True
                else:
                    print(f"❌ Simple chat failed: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Simple chat error: {e}")
                return False

    async def test_chat_completion(self):
        """Test full chat completion endpoint"""
        print("\n🤖 Testing Chat Completion...")
        
        chat_request = {
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant for testing."
                },
                {
                    "role": "user", 
                    "content": "Explain what you are in exactly 20 words."
                }
            ],
            "model": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_tokens": 100,
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{BASE_URL}{API_V1}/ai/chat/completions",
                    json=chat_request,
                    headers=self.get_headers(),
                    timeout=30.0
                )
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Chat completion successful:")
                    
                    if result.get('choices'):
                        message = result['choices'][0].get('message', {})
                        print(f"   Response: {message.get('content', 'N/A')}")
                        print(f"   Model: {result.get('model', 'N/A')}")
                        print(f"   Session ID: {result.get('session_id', 'N/A')}")
                        print(f"   Usage: {result.get('usage', {})}")
                        return True
                    else:
                        print("❌ No choices in response")
                        return False
                else:
                    print(f"❌ Chat completion failed: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Chat completion error: {e}")
                return False

    async def test_embeddings(self):
        """Test embeddings endpoint"""
        print("\n🔢 Testing Embeddings...")
        
        embedding_request = {
            "texts": [
                "Hello world",
                "This is a test sentence for embeddings",
                "AI and machine learning are fascinating topics"
            ],
            "model": "text-embedding-3-small"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{BASE_URL}{API_V1}/ai/embeddings",
                    json=embedding_request,
                    headers=self.get_headers(),
                    timeout=30.0
                )
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Embeddings successful:")
                    print(f"   Model: {result.get('model', 'N/A')}")
                    print(f"   Embeddings Count: {len(result.get('data', []))}")
                    
                    if result.get('data'):
                        first_embedding = result['data'][0].get('embedding', [])
                        print(f"   First Embedding Dimensions: {len(first_embedding)}")
                        print(f"   Usage: {result.get('usage', {})}")
                        return True
                    else:
                        print("❌ No embedding data received")
                        return False
                else:
                    print(f"❌ Embeddings failed: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Embeddings error: {e}")
                return False

    async def test_models_list(self):
        """Test available models endpoint"""
        print("\n📋 Testing Available Models...")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BASE_URL}{API_V1}/ai/models",
                    timeout=10.0
                )
                
                print(f"Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ Models list successful:")
                    
                    models = result.get('data', [])
                    print(f"   Available Models: {len(models)}")
                    
                    for model in models[:3]:  # Show first 3 models
                        print(f"   - {model.get('id', 'N/A')}: {model.get('description', 'N/A')}")
                    
                    return True
                else:
                    print(f"❌ Models list failed: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Models list error: {e}")
                return False

async def main():
    """Run all AI integration tests"""
    print("🚀 OpenAI Integration Testing")
    print("=" * 50)
    
    tester = AITestRunner()
    results = []
    
    # Note: Authentication is optional for testing AI endpoints
    # They can work with or without authentication
    auth_success = await tester.authenticate()
    results.append(("Authentication", auth_success))
    
    # Test AI endpoints
    tests = [
        ("AI Health Check", tester.test_ai_health),
        ("Models List", tester.test_models_list),
        ("Simple Chat", tester.test_simple_chat),
        ("Chat Completion", tester.test_chat_completion),
        ("Embeddings", tester.test_embeddings),
    ]
    
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name}: CRASHED - {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 AI INTEGRATION TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! OpenAI integration is working!")
        print("\n🚀 Ready for:")
        print("   • Chat interface implementation")
        print("   • Clone creation with AI personalities") 
        print("   • Knowledge base RAG integration")
        print("   • Streaming chat responses")
    else:
        print("⚠️  Some tests failed. Check the issues above.")
        print("\n🔧 Common fixes:")
        print("   • Add a valid OpenAI API key to .env")
        print("   • Ensure backend server is running")
        print("   • Check authentication setup")
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    asyncio.run(main())