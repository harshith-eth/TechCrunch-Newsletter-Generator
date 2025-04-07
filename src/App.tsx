import React, { useState } from 'react';
import { Send, Loader2, ArrowRight, Check } from 'lucide-react';
import FirecrawlApp from '@mendable/firecrawl-js';

// TypeScript interfaces
interface FirecrawlMetadata {
  title: string;
  description: string;
  language?: string;
  sourceURL: string;
  statusCode: number;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    html?: string;
    metadata: FirecrawlMetadata;
  };
  error?: string;
  details?: string[];
}

interface AzureResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    type?: string;
    param?: string;
    code?: string;
  };
}

// API Configuration
const FIRECRAWL_API_KEY = import.meta.env.VITE_FIRECRAWL_API_KEY;
const AZURE_API_KEY = import.meta.env.VITE_AZURE_API_KEY;
const AZURE_ENDPOINT = import.meta.env.VITE_AZURE_ENDPOINT;

if (!FIRECRAWL_API_KEY || !AZURE_API_KEY || !AZURE_ENDPOINT) {
  throw new Error('Missing required environment variables. Please check your .env file.');
}

// Initialize Firecrawl
const firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

function App() {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'scraping' | 'generating'>('idle');
  const [newsletter, setNewsletter] = useState('');
  const [error, setError] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const validateUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.toLowerCase().includes('techcrunch.com');
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset states
    setError('');
    setNewsletter('');
    setArticleTitle('');
    
    // Validate URL
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid TechCrunch article URL');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('scraping');

    try {
      console.log('Fetching article from:', url);
      
      // Step 1: Fetch article content using Firecrawl SDK
      const scrapeResult = await firecrawl.scrapeUrl(url);

      console.log('Firecrawl response:', scrapeResult);

      if (!scrapeResult.success) {
        throw new Error('Failed to fetch article');
      }

      const markdown = scrapeResult.markdown;
      if (!markdown) {
        throw new Error('No content found in the article');
      }

      // Store the article title
      const title = scrapeResult.metadata?.title || 'TechCrunch Article';
      setArticleTitle(title);
      console.log('Article title:', title);

      setCurrentStep('generating');

      // Step 2: Generate newsletter using Azure OpenAI
      const prompt = `Convert this TechCrunch article into an engaging newsletter format. Make it professional but conversational.
      
      Article Title: ${title}
      Article Content: ${markdown}
      
      Please format the newsletter with the following sections:
      
      📰 SUBJECT LINE
      [Write a compelling subject line that would make someone want to open this email]
      
      👋 INTRODUCTION
      [A brief, engaging introduction that sets up the context]
      
      🔑 KEY HIGHLIGHTS
      [3-4 main points from the article, each with a brief explanation]
      
      💡 ANALYSIS
      [A thoughtful analysis of what this means for the industry/readers]
      
      🎯 TAKEAWAY
      [One clear, actionable takeaway for the reader]
      
      Note: Do not use any markdown headings (###) in the output. Just use the emojis as section markers.
      Make it concise, engaging, and valuable for the reader.`;

      const azureResponse = await fetch(AZURE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_API_KEY
        },
        body: JSON.stringify({
          messages: [
            { 
              role: 'system', 
              content: 'You are a professional newsletter writer who specializes in converting tech news into engaging email newsletters. Your writing style is professional yet conversational, and you excel at making complex topics accessible and interesting.' 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1500,
          temperature: 0.7
        })
      });

      if (!azureResponse.ok) {
        const errorData = await azureResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to generate newsletter (Status: ${azureResponse.status})`);
      }

      const newsletterData = await azureResponse.json();
      
      if (!newsletterData.choices?.[0]?.message?.content) {
        throw new Error('No newsletter content generated');
      }

      setNewsletter(newsletterData.choices[0].message.content);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
      setCurrentStep('idle');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-orange-100/30 to-orange-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-4xl animate-bounce">📰</span>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
              TechCrunch Newsletter Generator
            </h1>
          </div>
          <p className="text-gray-600 text-lg mb-2">
            Transform TechCrunch articles into engaging newsletters instantly
          </p>
          <div className="text-sm text-gray-500">Built by Harshith Vaddiparthy - for Growth Engineer role at Firecrawl</div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste your TechCrunch article URL here..."
              className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
              required
            />
            <button
              type="submit"
              disabled={isProcessing}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium flex items-center gap-2 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm hover:shadow-md"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 animate-shake">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Processing Steps with Matrix-style animation */}
        {isProcessing && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-4 text-gray-600 mb-4">
              <div className={`flex items-center gap-2 ${currentStep === 'scraping' ? 'text-orange-500 font-medium' : ''}`}>
                <div className={`w-3 h-3 rounded-full ${currentStep === 'scraping' ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'}`} />
                Fetching article
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
              <div className={`flex items-center gap-2 ${currentStep === 'generating' ? 'text-orange-500 font-medium' : ''}`}>
                <div className={`w-3 h-3 rounded-full ${currentStep === 'generating' ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'}`} />
                Generating newsletter
              </div>
            </div>
            <div className="font-mono text-sm text-orange-500/75 h-20 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-matrix-rain" style={{ animationDelay: `${i * 0.2}s` }}>
                  {currentStep === 'scraping' ? 'Analyzing content...' : 'Generating insights...'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Newsletter Output */}
        {newsletter && !isProcessing && (
          <div className="bg-white rounded-lg shadow-lg p-8 transition-all duration-500 ease-in-out transform hover:shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">
              Newsletter: {articleTitle}
            </h2>
            <div className="prose prose-orange max-w-none">
              {newsletter.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4 leading-relaxed">
                  {paragraph.replace(/\*/g, '').replace(/^###\s*/g, '')}
                </p>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(newsletter);
                  setCopyStatus('copied');
                  setTimeout(() => setCopyStatus('idle'), 2000);
                }}
                className="text-orange-500 hover:text-orange-600 font-medium flex items-center gap-2 transition-all duration-300 transform hover:scale-105"
              >
                {copyStatus === 'copied' ? (
                  <>
                    <Check className="w-5 h-5 animate-bounce" />
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy to clipboard
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          Powered by Firecrawl
        </div>
      </div>
    </div>
  );
}

export default App;