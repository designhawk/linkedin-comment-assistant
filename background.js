/**
 * LinkedIn Comment Assistant - Background Script
 * Handles OpenRouter API calls and storage management
 */

// OpenRouter API endpoint
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

// Configuration Constants
const CONFIG = {
  // Cache duration for models list (24 hours)
  CACHE_DURATION: 24 * 60 * 60 * 1000,
  // API Configuration
  API: {
    MAX_TOKENS: 250,
    TEMPERATURE: 0.85,
    TEST_MAX_TOKENS: 10,
    TEST_TEMPERATURE: 0.7
  },
  // Speed test tracking
  SPEED_TEST: {
    MAX_STORED_TIMES: 5
  },
  // Debug mode
  DEBUG: false
};

// Conditional logger
const log = CONFIG.DEBUG ? console.log : () => {};
const logError = CONFIG.DEBUG ? console.error : () => {};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);
  
  if (request.action === 'generateComments') {
    handleGenerateComments(request.data)
      .then(result => {
        console.log('[Background] Generated comments successfully');
        // result contains { comments, usedFallback, model }
        sendResponse({ 
          comments: result.comments,
          usedFallback: result.usedFallback,
          model: result.model
        });
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      })
      .catch(error => {
        console.error('[Background] Error generating comments:', error);
        sendResponse({ error: error.message });
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      });
    return true; // Keep channel open for async
  }
  
  if (request.action === 'fetchModels') {
    fetchFreeModels()
      .then(models => {
        console.log('[Background] Fetched', models.length, 'models');
        sendResponse({ models });
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      })
      .catch(error => {
        console.error('[Background] Error fetching models:', error);
        sendResponse({ error: error.message });
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      });
    return true;
  }

  if (request.action === 'testApiKey') {
    testApiKey(request.apiKey, request.modelId)
      .then(result => {
        console.log('[Background] API key test result:', result.valid ? 'valid' : 'invalid', 'Time:', result.responseTime + 'ms');
        sendResponse(result);
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      })
      .catch(error => {
        console.error('[Background] Error testing API key:', error);
        sendResponse({ valid: false, error: error.message });
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      });
    return true;
  }

  if (request.action === 'getFastestModel') {
    getFastestModel()
      .then(result => {
        sendResponse(result);
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      })
      .catch(error => {
        console.error('[Background] Error getting fastest model:', error);
        sendResponse(null);
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      });
    return true;
  }
  
  // Unknown action
  console.warn('[Background] Unknown action:', request.action);
  sendResponse({ error: 'Unknown action: ' + request.action });
  if (chrome.runtime.lastError) {
    console.error('[Background] Message error:', chrome.runtime.lastError);
  }
  return true;
});

// Generate comments using OpenRouter API
async function handleGenerateComments(data) {
  console.log('[Background] handleGenerateComments called with:', {
    commentType: data.commentType,
    postTextLength: data.postData?.text?.length,
    hasAuthor: !!data.postData?.author
  });
  
  const { postData, commentType } = data;
  
  // Get settings from storage
  console.log('[Background] Loading settings from storage...');
  const settings = await chrome.storage.local.get(['apiKey', 'selectedModel', 'userProfile']);
  console.log('[Background] Settings loaded:', {
    hasApiKey: !!settings.apiKey,
    selectedModel: settings.selectedModel,
    hasUserProfile: !!settings.userProfile
  });
  
  if (!settings.apiKey) {
    console.error('[Background] API key not configured');
    throw new Error('API key not configured. Please add your OpenRouter API key in settings.');
  }

  const model = settings.selectedModel || 'meta-llama/llama-3.1-8b-instruct';
  const userProfile = settings.userProfile || '';

  console.log('[Background] Building prompt for comment type:', commentType);
  // Build the prompt
  const prompt = buildPrompt(postData, commentType, userProfile);
  console.log('[Background] Prompt built, length:', prompt.length);

  // Reliable fallback model
  const FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct';
  
  async function tryGenerateWithModel(modelToUse, isFallback = false) {
    console.log(`[Background] Making API request to OpenRouter with model: ${modelToUse}${isFallback ? ' (FALLBACK)' : ''}`);
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://linkedin.com',
        'X-Title': 'LinkedIn Comment Assistant'
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that writes SHORT, CRISP LinkedIn comments (1-2 sentences, 15-40 words each). Your comments are punchy, get straight to the point, and cut all fluff.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: CONFIG.API.TEMPERATURE,
        max_tokens: CONFIG.API.MAX_TOKENS
      })
    });

    console.log('[Background] API response received, status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Background] API request failed:', response.status, errorData);
      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Background] API result received, has choices:', !!result.choices);
    console.log('[Background] Full result keys:', Object.keys(result));
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('[Background] Invalid response structure:', result);
      throw new Error('Invalid response from API');
    }

    // Parse the response to extract comments
    const content = result.choices[0].message.content;
    console.log('[Background] Raw API content length:', content ? content.length : 0);
    console.log('[Background] Raw API content:', content ? content.substring(0, 500) : 'EMPTY');
    
    if (!content || content.trim().length === 0) {
      console.error('[Background] Empty content received from API');
      throw new Error('API returned empty response. The model may be overloaded or the prompt too long.');
    }
    
    const comments = parseCommentsFromResponse(content);
    console.log('[Background] Parsed comments:', comments.length);
    
    return { comments, usedFallback: isFallback, model: modelToUse };
  }
  
  // Try with selected model first
  try {
    return await tryGenerateWithModel(model, false);
  } catch (error) {
    console.error('[Background] Primary model failed:', error.message);
    
    // If primary model failed and it's not already the fallback, try fallback
    if (model !== FALLBACK_MODEL) {
      console.log('[Background] Retrying with fallback model:', FALLBACK_MODEL);
      try {
        return await tryGenerateWithModel(FALLBACK_MODEL, true);
      } catch (fallbackError) {
        console.error('[Background] Fallback model also failed:', fallbackError.message);
        throw new Error(`Both primary and fallback models failed. ${fallbackError.message}`);
      }
    } else {
      // Already using fallback and it failed
      throw error;
    }
  }
}

// Build the prompt for comment generation
function buildPrompt(postData, commentType, userProfile) {
  // New brand-focused comment types with detailed style guides
  const typeDescriptions = {
    expert_take: 'Share unique insight that positions you as knowledgeable - confident but humble, data-backed when possible',
    relatable_story: 'Share a brief personal experience that connects - vulnerable, conversational, authentic',
    thought_question: 'Ask question that sparks deeper discussion - curious, open-ended, invites stories',
    practical_tip: 'Share actionable advice or shortcut - helpful, specific, easy to implement',
    connection_bridge: 'Connect post to broader trend or community - insightful, big picture, industry-aware',
    authentic_reaction: 'Genuine reaction with personality - casual, maybe humorous, definitely human'
  };

  // Detailed style guides for each comment type - NATURAL & CONVERSATIONAL
  const styleGuides = {
    expert_take: `
WRITE LIKE: Someone sharing a quick insight in the comments, not writing a blog post
STYLE: Drop one specific fact or counterintuitive take. Don't explain yourself fully.
GOOD EXAMPLES:
- "Opposite worked for us. Cut meeting time in half, productivity jumped 30%"
- "Hot take: Most KPIs measure busy work, not actual impact"
BAD EXAMPLES:
- "I completely agree with your assessment..."
- "In my professional opinion..."
RULES:
- One sentence max, maybe two if punchy
- Skip the setup, just say the thing
- Use numbers casually ("30%" not "thirty percent")`,

    relatable_story: `
WRITE LIKE: Texting a friend who gets it
STYLE: Brief, messy, maybe trails off. Real humans don't write perfect LinkedIn comments.
GOOD EXAMPLES:
- "Oof yeah this happened to me last year. Was so focused on launch I ignored the data saying users were confused"
- "I used to think I needed all the answers as a manager lol"
BAD EXAMPLES:
- "I want to share my journey with..."
- "Your post really resonated with me..."
RULES:
- Write like you're rushing between meetings
- Imperfect grammar is GOOD (dropping words, starting with "And" or "But")
- Include one tiny specific detail, not a whole story`,

    thought_question: `
WRITE LIKE: Actually curious, not trying to sound smart
STYLE: Casual question that invites stories, not debate.
GOOD EXAMPLES:
- "How did you handle pushback on this? Always struggle with that part"
- "Curious - has anyone tried the opposite approach?"
BAD EXAMPLES:
- "What are your thoughts on..."
- "Have you considered..."
RULES:
- Start with lowercase sometimes ("how do you...")
- Add "always wondered" or "struggle with" to sound genuine
- Don't make it sound like an interview`,

    practical_tip: `
WRITE LIKE: Slack message to a coworker
STYLE: One specific shortcut, no context needed.
GOOD EXAMPLES:
- "Try scheduling all meetings Tue/Thu only. Mon/Wed/Fri for deep work changed everything"
- "We started doing async updates instead of standups. Game changer tbh"
BAD EXAMPLES:
- "Here are three strategies for..."
- "I recommend implementing..."
RULES:
- Lead with the action ("Try this:" or just say it)
- One tip only, no list
- Use "we" or "I" casually`,

    connection_bridge: `
WRITE LIKE: Connecting dots in a group chat
STYLE: "This reminds me of..." but brief and casual.
GOOD EXAMPLES:
- "Reminds me of how everyone thought remote work would kill productivity. Same pattern here"
- "We're seeing this across our industry too. The shift is real"
BAD EXAMPLES:
- "This is indicative of a broader trend..."
- "From a macro perspective..."
RULES:
- Casual comparison, not analysis
- Use "reminds me" or "same thing happened"
- One sentence, drop the mic`,

    authentic_reaction: `
WRITE LIKE: Reacting in real-time
STYLE: First thought, best thought. Raw and unfiltered.
GOOD EXAMPLES:
- "Same. Still recovering from my last job tbh"
- "Love this. Bookmarked for my team"
- "Wait this is genius. Why didn't I think of this"
BAD EXAMPLES:
- "Congratulations on your achievement"
- "Thank you for sharing this valuable insight"
RULES:
- Short as possible (3-8 words is fine)
- Use abbreviations: tbh, ngl, oof, lol
- Show actual emotion: surprise, envy, relief, excitement`
  };

  // Anti-AI rules to make comments sound more natural
  const antiAIRules = `
AVOID THESE AI GIVEAWAYS:
- ❌ Starting with "This is a great post about..."
- ❌ "In today's fast-paced world..."
- ❌ Perfect grammar and punctuation (use contractions!)
- ❌ Generic phrases like "valuable insights" or "food for thought"
- ❌ Bullet points or numbered lists in comments
- ❌ Overly formal language ("Furthermore", "Moreover", "Additionally")
- ❌ Generic questions like "What do you think?"
- ❌ "I couldn't agree more" or "I completely agree"
- ❌ "It's important to note that..."

INSTEAD, USE:
- ✅ Start with specific observation: "The part about...", "Love that you mentioned..."
- ✅ Imperfect sentences: "This hit home because...", "Oof, been there..."
- ✅ Contractions: I'm, don't, can't, won't, we've, they've
- ✅ Casual connectors: "Tbh", "ngl", "imo", "Oof", "Same", "Honestly"
- ✅ Specific references to post content: names, details, examples
- ✅ Personal pronouns: I, me, my, we, our
- ✅ Conversational questions: "Has anyone else...?", "How did you...?", "Curious if..."
- ✅ Short punchy sentences mixed with longer ones
- ✅ Show personality: mild disagreement, humor, enthusiasm`;

  let prompt = `Write 2 LinkedIn comments for this post.`;
  
  // Add post type context
  if (postData.postType && postData.postType !== 'text') {
    prompt += `\n\nPOST TYPE: ${postData.postType.toUpperCase()}`;
    
    if (postData.postType === 'job' && postData.job) {
      prompt += `\nJOB DETAILS:`;
      if (postData.job.title) prompt += `\n- Title: ${postData.job.title}`;
      if (postData.job.company) prompt += `\n- Company: ${postData.job.company}`;
      if (postData.job.location) prompt += `\n- Location: ${postData.job.location}`;
    }
    
    if (postData.postType === 'article' && postData.article) {
      prompt += `\nARTICLE DETAILS:`;
      if (postData.article.title) prompt += `\n- Title: ${postData.article.title}`;
      if (postData.article.source) prompt += `\n- Source: ${postData.article.source}`;
    }
    
    if (postData.postType === 'image') {
      prompt += `\nIMAGE DETAILS:`;
      if (postData.isSingleImage) prompt += `\n- Type: Single image`;
      if (postData.isImageGrid) prompt += `\n- Type: Multiple images (grid)`;
    }
  }

  prompt += `\n\nPOST CONTENT:\n"""${postData.text}"""`;

  if (postData.author) {
    prompt += `\n\nPOST AUTHOR: ${postData.author}`;
    if (postData.authorVerified) prompt += ` ✓ Verified`;
    if (postData.authorPremium) prompt += ` ⭐ Premium`;
  }

  if (postData.authorHeadline) {
    prompt += `\nAUTHOR HEADLINE: ${postData.authorHeadline}`;
  }
  
  if (postData.connectionDegree) {
    prompt += `\nCONNECTION: ${postData.connectionDegree} degree connection`;
  }
  
  if (postData.hashtags && postData.hashtags.length > 0) {
    prompt += `\nHASHTAGS: ${postData.hashtags.join(' ')}`;
  }
  
  // Add engagement context if available
  if (postData.engagement) {
    const { reactions, comments, reposts } = postData.engagement;
    if (reactions > 0 || comments > 0 || reposts > 0) {
      prompt += `\n\nENGAGEMENT:`;
      if (reactions > 0) prompt += ` ${reactions} reactions`;
      if (comments > 0) prompt += `, ${comments} comments`;
      if (reposts > 0) prompt += `, ${reposts} reposts`;
    }
  }
  
  // Add social proof if available
  if (postData.socialProof && postData.socialProof.hasSocialProof && postData.socialProof.text) {
    prompt += `\n\nSOCIAL PROOF: ${postData.socialProof.text}`;
  }

  prompt += `\n\nCOMMENT TYPE: ${commentType}
OBJECTIVE: ${typeDescriptions[commentType] || 'write an engaging comment'}`;

  // Add style guide for this comment type
  if (styleGuides[commentType]) {
    prompt += `\n\nSTYLE GUIDE FOR THIS COMMENT TYPE:${styleGuides[commentType]}`;
  }

  if (userProfile) {
    prompt += `\n\nABOUT THE COMMENTER:\n${userProfile}\n\nUse this context to personalize the comment appropriately.`;
  }

  prompt += `\n\n${antiAIRules}`;

  prompt += `\n\nWRITE NATURAL COMMENTS - KEY RULES:
- 1-2 sentences max. Seriously. That's it.
- Write like you're rushing between meetings - quick, messy, real
- Drop the setup, get to the point immediately
- Use contractions: I'm, don't, can't, we're
- Casual abbreviations are GOOD: tbh, ngl, lol, oof
- Imperfect grammar is BETTER than perfect grammar
- Start sentences with "And" or "But" sometimes
- Trail off with "..." occasionally
- 15-40 words ideal (but 5 words is fine too!)`;

  prompt += `\n\nREAL EXAMPLES THAT SOUND HUMAN:
- "Opposite worked for us tbh. Cut meetings in half, productivity jumped"
- "Oof yeah been there. Last year I ignored the data saying users were confused"
- "How do you handle pushback? Always struggle with that part"
- "Same lol. Still recovering from my last job"
- "Wait this is genius"
- "Hot take: most KPIs measure busy work, not impact"
- "Tried this. Game changer"
- "Reminds me of when everyone thought remote work would fail. Same pattern"`;

  prompt += `\n\nMAKE IT SOUND NATURAL:
- Don't explain yourself fully. Real humans don't.
- Use lowercase sometimes at the start
- Drop words occasionally ("Opposite worked for us" not "The opposite approach worked...")
- React don't analyze. First thought, best thought.
- Skip transitions: no "However," "Moreover," "Additionally"
- One idea per comment. Period.`;

  prompt += `\n\nNEVER DO THIS:
- "Thanks for sharing"
- "Great post!"
- "I completely agree..."
- "In my experience..."
- "What are your thoughts?"
- "This is so important..."
- "I couldn't agree more"
- "Here are three strategies..."
- "From my perspective..."
- Multiple paragraphs
- Perfect grammar throughout`;

  prompt += `\n\nTHE SECRET: Write fast, don't overthink. Comments should feel like they took 10 seconds to write.`;

  prompt += `\n\n${antiAIRules}`;

  // Add post-type specific guidance
  if (postData.postType === 'job') {
    prompt += `\n- For job posts: Show genuine interest, mention relevant experience, or ask thoughtful questions about the role`;
  } else if (postData.postType === 'article') {
    prompt += `\n- For shared articles: Reference the article topic, share your take on it, or add related insights`;
  } else if (postData.postType === 'image') {
    prompt += `\n- For image posts: Acknowledge what you see in the images, relate it to the caption`;
  }

  prompt += `\n\nGENERATE 3 DIFFERENT VARIATIONS:
All three should be different angles or approaches to the same post. They should feel like they came from three different real people commenting quickly. No labels needed, just three distinct natural comments.`;

  prompt += `\n\nIMPORTANT: Respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, no extra text):
{"comments":[{"text":"First comment here"},{"text":"Second comment here"},{"text":"Third comment here"}]}`;

  return prompt;
}

// Parse comments from API response
function parseCommentsFromResponse(content) {
  console.log('[Background] parseCommentsFromResponse called, content length:', content.length);
  
  // Clean the content - remove markdown code blocks if present
  let cleanContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  console.log('[Background] Cleaned content (first 200 chars):', cleanContent.substring(0, 200));
  
  // Try to extract JSON from the content
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanContent = jsonMatch[0];
    console.log('[Background] Found JSON match, extracted object');
  }

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(cleanContent);
    console.log('[Background] Successfully parsed JSON, has comments:', !!parsed.comments);
    if (parsed.comments && Array.isArray(parsed.comments)) {
      console.log('[Background] JSON parsing successful, found', parsed.comments.length, 'comments');
      // Return comments without styles
      return parsed.comments.map(c => ({ 
        text: c.text || String(c)
      }));
    }
  } catch (e) {
    console.log('[Background] JSON parsing failed:', e.message);
  }

  // Fallback: extract comments using various patterns
  const comments = [];
  
  // Pattern 1: Look for "Comment X:" or "Option X:" format
  const commentPattern = /(?:comment|option)\s*\d*[\s:]*["']?([^"']+)["']?/gi;
  let match;
  while ((match = commentPattern.exec(cleanContent)) !== null && comments.length < 3) {
    const text = match[1].trim();
    if (text.length > 10 && text.length < 500) {
      comments.push({ text });
    }
  }
  console.log('[Background] Pattern 1 found:', comments.length, 'comments');
  
  // Pattern 2: Split by newlines and look for substantial lines
  if (comments.length === 0) {
    const lines = cleanContent.split('\n').filter(line => line.trim());
    console.log('[Background] Pattern 2: checking', lines.length, 'lines');
    
    for (const line of lines) {
      // Remove markdown formatting and common prefixes
      const cleaned = line
        .replace(/^\d+[.):\-]\s*/, '')
        .replace(/^[*\-]\s*/, '')
        .replace(/^["']|["']$/g, '')
        .replace(/^text\s*:\s*["']?/, '')
        .replace(/["']?\s*,?\s*$/, '')
      .trim();
      
      if (cleaned && cleaned.length > 20 && cleaned.length < 500 && !cleaned.includes('{') && !cleaned.includes('}')) {
        comments.push({ text: cleaned });
      }
      if (comments.length >= 3) break;
    }
    console.log('[Background] Pattern 2 found:', comments.length, 'comments');
  }

  // Pattern 3: If no structured comments found, split by sentences
  if (comments.length === 0) {
    const sentences = cleanContent.match(/[^.!?]+[.!?]+/g) || [];
    console.log('[Background] Pattern 3: checking', sentences.length, 'sentences');
    if (sentences.length >= 3) {
      comments.push({ text: sentences[0].trim() });
      comments.push({ text: sentences[1].trim() });
      comments.push({ text: sentences[2].trim() });
    } else if (sentences.length >= 2) {
      comments.push({ text: sentences[0].trim() });
      comments.push({ text: sentences[1].trim() });
    }
    console.log('[Background] Pattern 3 found:', comments.length, 'comments');
  }

  // Last resort: use the whole content
  if (comments.length === 0) {
    console.log('[Background] Last resort: using truncated content');
    comments.push({ text: cleanContent.substring(0, 400).trim() });
  }

  console.log('[Background] Total comments returned:', comments.length);
  return comments;
}

// Fetch free models from OpenRouter
async function fetchFreeModels() {
  // Check cache first
  const cached = await chrome.storage.local.get(['availableModels', 'modelsLastUpdated']);
  
  if (cached.availableModels && cached.modelsLastUpdated) {
    const age = Date.now() - cached.modelsLastUpdated;
    if (age < CONFIG.CACHE_DURATION) {
      console.log('[Background] Using cached models list');
      return cached.availableModels;
    }
  }

  console.log('[Background] Fetching fresh models list from OpenRouter');
  
  const response = await fetch(OPENROUTER_MODELS_URL);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json();
  
  // Filter for free models (prompt and completion pricing are both 0)
  const freeModels = data.data
    .filter(model => {
      const promptPrice = parseFloat(model.pricing?.prompt || 0);
      const completionPrice = parseFloat(model.pricing?.completion || 0);
      return promptPrice === 0 && completionPrice === 0;
    })
    .map(model => ({
      id: model.id,
      name: model.name,
      description: model.description || '',
      contextLength: model.context_length || 4096,
      provider: model.id.split('/')[0]
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Cache the results
  await chrome.storage.local.set({
    availableModels: freeModels,
    modelsLastUpdated: Date.now()
  });

  return freeModels;
}

// Test if API key is valid and measure response time
async function testApiKey(apiKey, modelId = 'meta-llama/llama-3.1-8b-instruct') {
  const startTime = performance.now();
  
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "API key is valid"' }],
        max_tokens: CONFIG.API.TEST_MAX_TOKENS
      })
    });

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    if (response.ok) {
      // Save the response time
      await saveModelResponseTime(modelId, responseTime);
      return { valid: true, responseTime, modelId };
    } else {
      const error = await response.json().catch(() => ({}));
      return { 
        valid: false, 
        error: error.error?.message || `HTTP ${response.status}`,
        responseTime,
        modelId
      };
    }
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    return { valid: false, error: error.message, responseTime, modelId };
  }
}

// Save model response time to storage
async function saveModelResponseTime(modelId, responseTime) {
  try {
    const result = await chrome.storage.local.get(['modelResponseTimes']);
    const times = result.modelResponseTimes || {};
    
    if (!times[modelId]) {
      times[modelId] = {
        times: [],
        average: 0,
        lastTested: Date.now()
      };
    }
    
    // Keep last N response times
    times[modelId].times.push(responseTime);
    if (times[modelId].times.length > CONFIG.SPEED_TEST.MAX_STORED_TIMES) {
      times[modelId].times.shift();
    }
    
    // Calculate average
    times[modelId].average = Math.round(
      times[modelId].times.reduce((a, b) => a + b, 0) / times[modelId].times.length
    );
    times[modelId].lastTested = Date.now();
    
    await chrome.storage.local.set({ modelResponseTimes: times });
    console.log(`[Background] Saved response time for ${modelId}: ${responseTime}ms (avg: ${times[modelId].average}ms)`);
  } catch (error) {
    console.error('[Background] Failed to save response time:', error);
  }
}

// Get fastest model based on response times
async function getFastestModel() {
  try {
    const result = await chrome.storage.local.get(['modelResponseTimes']);
    const times = result.modelResponseTimes || {};
    
    let fastestModel = null;
    let fastestTime = Infinity;
    
    for (const [modelId, data] of Object.entries(times)) {
      if (data.average < fastestTime) {
        fastestTime = data.average;
        fastestModel = modelId;
      }
    }
    
    return fastestModel ? { modelId: fastestModel, averageTime: fastestTime } : null;
  } catch (error) {
    console.error('[Background] Failed to get fastest model:', error);
    return null;
  }
}

// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Try to open sidepanel
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('[LinkedIn Comment Assistant] Failed to open sidepanel:', error);
    // Fallback: open in new tab if sidepanel fails
    chrome.tabs.create({
      url: chrome.runtime.getURL('sidepanel/sidepanel.html')
    });
  }
});

// Install handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[LinkedIn Comment Assistant] Extension installed');
    
    // Set default settings
    chrome.storage.local.set({
      selectedModel: 'meta-llama/llama-3.1-8b-instruct',
      userProfile: ''
    });
    
    // Open sidepanel on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('sidepanel/sidepanel.html')
    });
  }
});
