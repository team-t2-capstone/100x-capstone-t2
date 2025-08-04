#!/usr/bin/env python3
"""
Test script to verify backend setup
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

def test_imports():
    """Test that all imports work correctly"""
    try:
        from app.config import settings
        print("✅ Config import successful")
        
        from app.main import app
        print("✅ FastAPI app import successful")
        
        print(f"✅ App name: {settings.PROJECT_NAME}")
        print(f"✅ Version: {settings.VERSION}")
        print(f"✅ Debug mode: {settings.DEBUG}")
        
        return True
    except Exception as e:
        print(f"❌ Import error: {e}")
        return False

def test_environment():
    """Test environment setup"""
    try:
        from app.config import settings
        
        # Check if critical settings exist (won't validate values yet)
        critical_settings = ['SECRET_KEY', 'API_V1_STR', 'PROJECT_NAME']
        
        for setting in critical_settings:
            value = getattr(settings, setting, None)
            if value:
                print(f"✅ {setting}: configured")
            else:
                print(f"⚠️  {setting}: not configured")
        
        return True
    except Exception as e:
        print(f"❌ Environment test error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing CloneAI Backend Setup...")
    print("=" * 50)
    
    # Test imports
    print("\n📦 Testing imports...")
    import_success = test_imports()
    
    # Test environment
    print("\n🔧 Testing environment...")
    env_success = test_environment()
    
    # Summary
    print("\n" + "=" * 50)
    if import_success and env_success:
        print("🎉 Backend setup test PASSED!")
        print("\n📋 Next steps:")
        print("1. Set up your .env file with actual values")
        print("2. Set up Supabase project") 
        print("3. Get OpenAI API key")
        print("4. Install dependencies: pip install -r requirements.txt")
        print("5. Run the server: uvicorn app.main:app --reload")
    else:
        print("❌ Backend setup test FAILED!")
        sys.exit(1)