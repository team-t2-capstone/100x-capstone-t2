/**
 * Test RAG Integration - Quick verification script
 * Tests the authentication and basic API endpoints
 */

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: any;
}

class RAGIntegrationTester {
  private results: TestResult[] = [];
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  async runTests(): Promise<TestResult[]> {
    console.log('🧪 Starting RAG Integration Tests...');
    
    // Test 1: Backend Health Check
    await this.testBackendHealth();
    
    // Test 2: Auth Test (no auth)
    await this.testNoAuthEndpoint();
    
    // Test 3: Auth Test (with invalid token)
    await this.testInvalidAuthEndpoint();
    
    console.log('✅ RAG Integration Tests Complete');
    return this.results;
  }

  private async testBackendHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        this.results.push({
          test: 'Backend Health Check',
          status: 'pass',
          message: `Backend is healthy (${data.status})`,
          details: data
        });
      } else {
        this.results.push({
          test: 'Backend Health Check',
          status: 'fail',
          message: `Backend health check failed: ${response.status}`,
          details: { status: response.status, statusText: response.statusText }
        });
      }
    } catch (error) {
      this.results.push({
        test: 'Backend Health Check',
        status: 'fail',
        message: `Backend health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  private async testNoAuthEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/clones/test-no-auth`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.results.push({
          test: 'No Auth Endpoint Test',
          status: 'pass',
          message: 'No-auth endpoint accessible',
          details: data
        });
      } else {
        this.results.push({
          test: 'No Auth Endpoint Test',
          status: 'fail',
          message: `No-auth endpoint failed: ${response.status}`,
          details: { status: response.status, statusText: response.statusText }
        });
      }
    } catch (error) {
      this.results.push({
        test: 'No Auth Endpoint Test',
        status: 'fail',
        message: `No-auth endpoint error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  private async testInvalidAuthEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/clones/test-auth`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token-for-testing'
        }
      });
      
      // Should fail with 401 or 403
      if (response.status === 401 || response.status === 403) {
        this.results.push({
          test: 'Invalid Auth Endpoint Test',
          status: 'pass',
          message: `Invalid auth correctly rejected (${response.status})`,
          details: { status: response.status }
        });
      } else {
        this.results.push({
          test: 'Invalid Auth Endpoint Test',
          status: 'fail',
          message: `Expected 401/403 but got ${response.status}`,
          details: { status: response.status, statusText: response.statusText }
        });
      }
    } catch (error) {
      this.results.push({
        test: 'Invalid Auth Endpoint Test',
        status: 'fail',
        message: `Invalid auth test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      });
    }
  }

  printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    this.results.forEach((result, index) => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏸️';
      console.log(`${index + 1}. ${icon} ${result.test}`);
      console.log(`   Status: ${result.status.toUpperCase()}`);
      console.log(`   Message: ${result.message}`);
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
      console.log('');
    });
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    
    console.log(`🎯 Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  }
}

// Export for use in other modules
export { RAGIntegrationTester, type TestResult };

// Auto-run if in Node.js environment
if (typeof window === 'undefined') {
  const tester = new RAGIntegrationTester();
  tester.runTests().then(() => {
    tester.printResults();
  }).catch(console.error);
}