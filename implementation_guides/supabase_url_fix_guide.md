# Supabase Storage URL Fix for OpenAI File Extension Validation

## Issue Description

The OpenAI API was rejecting file uploads with the error:
```
Error code: 400 - {'error': {'message': 'Invalid extension txt?. Supported formats: ...', 'type': 'invalid_request_error'}}
```

This occurred because Supabase storage URLs were being passed to OpenAI with trailing URL parameters (like `?` at the end), which caused OpenAI to misinterpret the file extension as `txt?` instead of `txt`.

Example problematic URL:
```
https://qspwdnnbxjurlmgmztco.supabase.co/storage/v1/object/public/documents/documents/dad8f866-35d4-413e-95ed-e3adbae43604/d3e14831-b888-49a3-97a0-782d02393d74.txt?
```

## Root Cause Analysis

The issue was present in multiple locations throughout the codebase where filenames were extracted from URLs using `url.split("/")[-1]`, which preserved query parameters in the filename when passed to OpenAI's file API.

## Files Fixed

### 1. Backend RAG Core Service
**File:** `/backend/app/services/rag_core.py`
- **Lines:** 139-148
- **Issue:** `file_name = document_url.split("/")[-1]` kept query parameters
- **Fix:** Used `urllib.parse.urlparse()` and `os.path.basename()` to extract clean filename

### 2. Simplified RAG Service
**File:** `/backend/app/services/simplified_rag.py`
- **Lines:** 85-98
- **Issue:** Same filename extraction issue
- **Fix:** Added proper URL parsing and filename cleaning

### 3. Optimized RAG Core
**File:** `/backend/app/services/optimized_rag_core.py`
- **Lines:** 118
- **Issue:** Same filename extraction issue
- **Fix:** Added proper URL parsing with fallback logic

### 4. Knowledge API
**File:** `/backend/app/api/knowledge.py`
- **Lines:** 377-383, 1462-1477, 1537-1547
- **Issue:** Supabase `get_public_url()` returning URLs with trailing `?`
- **Fix:** Added URL cleaning to strip trailing query parameters

### 5. Frontend Upload Function
**File:** `/app/create-clone/wizard/page.tsx`
- **Lines:** 1701
- **Issue:** Supabase `getPublicUrl()` returning URLs with trailing `?`
- **Fix:** Added client-side URL cleaning before returning

## Implementation Details

### Backend URL Processing Fix
```python
# Before (problematic)
file_name = document_url.split("/")[-1]

# After (fixed)
parsed_url = urllib.parse.urlparse(document_url)
file_name = os.path.basename(parsed_url.path)
# Additional cleaning for edge cases
if '?' in file_name:
    file_name = file_name.split('?')[0]
if not file_name or '.' not in file_name:
    file_name = f"document{file_extension}"
```

### Frontend URL Cleaning Fix
```typescript
// Before (problematic)
return urlData.publicUrl

// After (fixed)
let cleanUrl = urlData.publicUrl
if (cleanUrl.endsWith('?')) {
  cleanUrl = cleanUrl.slice(0, -1)
}
return cleanUrl
```

### API URL Cleaning Fix
```python
# Added to all Supabase storage URL generations
if storage_url and storage_url.endswith('?'):
    storage_url = storage_url.rstrip('?')
```

## Testing

The fix ensures that:
1. File extensions are properly preserved without query parameters
2. OpenAI receives clean filenames that pass validation
3. Both frontend and backend handle URL cleaning consistently
4. Edge cases (empty filenames, missing extensions) are handled gracefully

## Prevention

To prevent this issue in the future:
1. Always use proper URL parsing when extracting filenames from URLs
2. Clean URLs returned by Supabase before passing to external APIs
3. Test file uploads with various file types and URL formats
4. Monitor OpenAI API errors for extension validation issues

## Impact

This fix resolves:
- OpenAI file upload rejections due to invalid extensions
- RAG document processing failures
- Knowledge base upload errors
- Clone creation failures when documents are involved

The fix is backward compatible and handles both clean URLs and URLs with query parameters.