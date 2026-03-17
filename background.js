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
    MAX_STORED_TIMES: 5,
    TEST_MESSAGE: 'Say "API key is valid"'
  },
  // Debug mode
  DEBUG: false
};

// Conditional logger
const log = CONFIG.DEBUG ? console.log : () => {};
const logError = CONFIG.DEBUG ? console.error : () => {};

// ============================================================================
// Response Validation Functions
// ============================================================================

/**
 * Validates the OpenRouter chat completion API response structure
 * @param {any} response - The parsed JSON response from the API
 * @returns {{ valid: boolean, error?: string, content?: string }}
 */
function validateChatCompletionResponse(response) {
  // Check if response is an object
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'Response is not a valid object' };
  }

  // Check for error field (OpenRouter returns errors in the response)
  if (response.error) {
    const errorMessage = response.error.message || response.error.code || 'Unknown API error';
    return { valid: false, error: `API Error: ${errorMessage}` };
  }

  // Check for required top-level fields
  if (!response.id || typeof response.id !== 'string') {
    return { valid: false, error: 'Missing or invalid response ID' };
  }

  if (!response.choices || !Array.isArray(response.choices)) {
    return { valid: false, error: 'Missing or invalid choices array' };
  }

  if (response.choices.length === 0) {
    return { valid: false, error: 'Choices array is empty' };
  }

  // Validate first choice structure
  const firstChoice = response.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    return { valid: false, error: 'First choice is not a valid object' };
  }

  // Check for message structure
  if (!firstChoice.message || typeof firstChoice.message !== 'object') {
    return { valid: false, error: 'Missing or invalid message object in choice' };
  }

  // Extract and validate content
  const content = firstChoice.message.content;
  if (content === undefined || content === null) {
    return { valid: false, error: 'Message content is null or undefined' };
  }

  if (typeof content !== 'string') {
    return { valid: false, error: `Message content is not a string (got ${typeof content})` };
  }

  if (content.trim().length === 0) {
    return { valid: false, error: 'Message content is empty' };
  }

  // Validate finish_reason if present
  if (firstChoice.finish_reason && firstChoice.finish_reason === 'length') {
    log('[Background] Warning: Response was truncated due to length');
  }

  return { valid: true, content: content.trim() };
}

/**
 * Validates the OpenRouter models list API response
 * @param {any} response - The parsed JSON response from the API
 * @returns {{ valid: boolean, error?: string, models?: Array }}
 */
function validateModelsResponse(response) {
  // Check if response is an object
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'Models response is not a valid object' };
  }

  // Check for error field
  if (response.error) {
    const errorMessage = response.error.message || response.error.code || 'Unknown API error';
    return { valid: false, error: `API Error: ${errorMessage}` };
  }

  // Check for data array
  if (!response.data || !Array.isArray(response.data)) {
    return { valid: false, error: 'Missing or invalid data array in models response' };
  }

  // Validate each model has required fields
  const validModels = [];
  for (let i = 0; i < response.data.length; i++) {
    const model = response.data[i];
    
    // Skip invalid model entries
    if (!model || typeof model !== 'object') {
      log(`[Background] Warning: Model at index ${i} is not a valid object`);
      continue;
    }

    // Check required fields
    if (!model.id || typeof model.id !== 'string') {
      log(`[Background] Warning: Model at index ${i} missing valid ID`);
      continue;
    }

    // Model is valid enough to use
    validModels.push(model);
  }

  return { valid: true, models: validModels };
}

/**
 * Validates a parsed comment object
 * @param {any} comment - The comment object to validate
 * @param {number} index - Index for logging purposes
 * @returns {{ valid: boolean, text?: string, error?: string }}
 */
function validateCommentObject(comment, index) {
  // Handle string comments (convert to object)
  if (typeof comment === 'string') {
    const trimmed = comment.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: `Comment ${index} is empty string` };
    }
    if (trimmed.length > 2000) {
      log(`[Background] Warning: Comment ${index} exceeds 2000 chars, truncating`);
      return { valid: true, text: trimmed.substring(0, 2000) };
    }
    return { valid: true, text: trimmed };
  }

  // Check if comment is an object
  if (!comment || typeof comment !== 'object') {
    return { valid: false, error: `Comment ${index} is not a valid object or string` };
  }

  // Check for text field
  if (comment.text === undefined || comment.text === null) {
    // Try alternative fields
    const textValue = comment.content || comment.message || comment.comment;
    if (typeof textValue === 'string') {
      const trimmed = textValue.trim();
      if (trimmed.length > 0) {
        return { valid: true, text: trimmed.substring(0, 2000) };
      }
    }
    return { valid: false, error: `Comment ${index} missing valid text field` };
  }

  // Validate text field
  const text = String(comment.text).trim();
  if (text.length === 0) {
    return { valid: false, error: `Comment ${index} has empty text` };
  }

  if (text.length > 2000) {
    log(`[Background] Warning: Comment ${index} exceeds 2000 chars, truncating`);
    return { valid: true, text: text.substring(0, 2000) };
  }

  return { valid: true, text };
}

/**
 * Validates the final comments array before returning to content script
 * @param {Array} comments - The parsed comments array
 * @returns {{ valid: boolean, error?: string, comments?: Array }}
 */
function validateFinalCommentsArray(comments) {
  if (!Array.isArray(comments)) {
    return { valid: false, error: 'Comments is not an array' };
  }

  if (comments.length === 0) {
    return { valid: false, error: 'No valid comments could be extracted' };
  }

  // Validate each comment and filter out invalid ones
  const validComments = [];
  for (let i = 0; i < comments.length; i++) {
    const validation = validateCommentObject(comments[i], i);
    if (validation.valid) {
      validComments.push({ text: validation.text });
    } else {
      log(`[Background] Skipping invalid comment: ${validation.error}`);
    }
  }

  if (validComments.length === 0) {
    return { valid: false, error: 'All comments were invalid after validation' };
  }

  // Limit to maximum 5 comments
  if (validComments.length > 5) {
    log(`[Background] Limiting ${validComments.length} comments to 5`);
    validComments.splice(5);
  }

  return { valid: true, comments: validComments };
}

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
    testApiKey(request.apiKey, request.modelId || 'meta-llama/llama-3.1-8b-instruct')
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
  
  if (request.action === 'generateMessageReplies') {
    handleGenerateMessageReplies(request.data)
      .then(result => {
        console.log('[Background] Generated message replies successfully');
        sendResponse({
          replies: result.replies,
          usedFallback: result.usedFallback,
          model: result.model
        });
        if (chrome.runtime.lastError) {
          console.error('[Background] Message error:', chrome.runtime.lastError);
        }
      })
      .catch(error => {
        console.error('[Background] Error generating message replies:', error);
        sendResponse({ error: error.message });
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
  const settings = await chrome.storage.local.get(['apiKey', 'selectedModel', 'userProfile', 'customPrompts']);
  console.log('[Background] Settings loaded:', {
    hasApiKey: !!settings.apiKey,
    selectedModel: settings.selectedModel,
    hasUserProfile: !!settings.userProfile,
    hasCustomPrompts: !!settings.customPrompts
  });

  if (!settings.apiKey) {
    console.error('[Background] API key not configured');
    throw new Error('API key not configured. Please add your OpenRouter API key in settings.');
  }

  const model = settings.selectedModel || 'meta-llama/llama-3.1-8b-instruct';
  const userProfile = settings.userProfile || '';
  const customPrompts = settings.customPrompts || {};

  console.log('[Background] Building prompt for comment type:', commentType);
  // Build the prompt with custom prompts
  const prompt = buildPrompt(postData, commentType, userProfile, customPrompts);
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
    
    // Validate the API response structure
    const validation = validateChatCompletionResponse(result);
    if (!validation.valid) {
      console.error('[Background] Response validation failed:', validation.error);
      throw new Error(`Invalid API response: ${validation.error}`);
    }

    // Extract the validated content
    const content = validation.content;
    console.log('[Background] Validated API content length:', content.length);
    console.log('[Background] Raw API content:', content.substring(0, 500));
    
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

// Generate message replies using OpenRouter API
async function handleGenerateMessageReplies(data) {
  console.log('[Background] handleGenerateMessageReplies called with:', {
    messageType: data.messageType,
    conversationLength: data.conversationData?.messages?.length,
    recipient: data.conversationData?.recipient
  });
  
  const { conversationData, messageType } = data;
  
  // Get settings from storage
  console.log('[Background] Loading settings from storage...');
  const settings = await chrome.storage.local.get(['apiKey', 'selectedModel', 'userProfile', 'customMessagePrompts']);
  console.log('[Background] Settings loaded:', {
    hasApiKey: !!settings.apiKey,
    selectedModel: settings.selectedModel,
    hasUserProfile: !!settings.userProfile,
    hasCustomMessagePrompts: !!settings.customMessagePrompts
  });

  if (!settings.apiKey) {
    console.error('[Background] API key not configured');
    throw new Error('API key not configured. Please add your OpenRouter API key in settings.');
  }

  const model = settings.selectedModel || 'meta-llama/llama-3.1-8b-instruct';
  const userProfile = settings.userProfile || '';
  const customPrompts = settings.customMessagePrompts || {};

  console.log('[Background] Building message prompt for type:', messageType);
  // Build the prompt with custom prompts
  const prompt = buildMessagePrompt(conversationData, messageType, userProfile, customPrompts);
  console.log('[Background] Message prompt built, length:', prompt.length);

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
            content: 'You are a helpful assistant that writes SHORT, NATURAL LinkedIn messages (1-2 sentences, 10-30 words each). Your replies are conversational, authentic, and sound like they were written quickly by a real person.'
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
    
    // Validate the API response structure
    const validation = validateChatCompletionResponse(result);
    if (!validation.valid) {
      console.error('[Background] Response validation failed:', validation.error);
      throw new Error(`Invalid API response: ${validation.error}`);
    }

    // Extract the validated content
    const content = validation.content;
    console.log('[Background] Validated API content length:', content.length);
    console.log('[Background] Raw API content:', content.substring(0, 500));
    
    const replies = parseMessageRepliesFromResponse(content);
    console.log('[Background] Parsed replies:', replies.length);
    
    return { replies, usedFallback: isFallback, model: modelToUse };
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
function buildPrompt(postData, commentType, userProfile, customPrompts = {}) {
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

  // Add style guide for this comment type - use custom prompt if available
  const styleGuide = customPrompts[commentType] || styleGuides[commentType];
  if (styleGuide) {
    prompt += `\n\nSTYLE GUIDE FOR THIS COMMENT TYPE:${styleGuide}`;
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

// Build the prompt for message reply generation
function buildMessagePrompt(conversationData, messageType, userProfile, customPrompts = {}) {
  // Message type descriptions and style guides
  const typeDescriptions = {
    professional_networking: 'Polished, industry-appropriate response that maintains professionalism',
    casual_friendly: 'Friendly and approachable tone, like talking to a colleague',
    follow_up: 'Keep the conversation moving forward, reference previous messages',
    cold_outreach: 'Warm but professional approach, clear but not pushy',
    collaborative: 'Open to working together, exploring opportunities',
    gratitude: 'Thankful and appreciative, acknowledging their time or message'
  };

  // Detailed style guides for each message type - SHORTER for messages
  const styleGuides = {
    professional_networking: `
WRITE LIKE: Quick professional note between colleagues
STYLE: Polished but brief, gets to the point fast.
GOOD EXAMPLES:
- "Thanks for sharing this. Would love to connect and hear more about your work in AI."
- "This aligns with what we're building. Mind if I reach out about potential collaboration?"
BAD EXAMPLES:
- "I hope this message finds you well..."
- "I wanted to take a moment to introduce myself..."
RULES:
- 1-2 sentences max
- Skip formal greetings and closings
- Be direct about next steps or interest`,

    casual_friendly: `
WRITE LIKE: Slack message to a coworker you like
STYLE: Relaxed, conversational, uses casual language.
GOOD EXAMPLES:
- "Haha same! This is exactly what I needed today"
- "Love this perspective. How long have you been working on this?"
BAD EXAMPLES:
- "I completely agree with your assessment..."
- "Thank you for your thoughtful message..."
RULES:
- Use contractions: I'm, don't, can't
- Short sentences are fine
- Show personality`,

    follow_up: `
WRITE LIKE: Keeping the ball rolling
STYLE: Reference what they said, add something new.
GOOD EXAMPLES:
- "That makes sense. When you tried X, did you run into Y issue?"
- "Interesting point about scaling. Have you seen this work with smaller teams?"
BAD EXAMPLES:
- "Following up on our previous conversation..."
- "I wanted to circle back on..."
RULES:
- Acknowledge their last point briefly
- Ask a follow-up question or add insight
- Move conversation forward`,

    cold_outreach: `
WRITE LIKE: Warm intro that respects their time
STYLE: Brief, clear value, easy to respond to.
GOOD EXAMPLES:
- "Saw your post on X. We're solving similar problems - mind if I share what we're seeing?"
- "Quick question: have you explored Y approach? We've had interesting results"
BAD EXAMPLES:
- "I came across your profile and..."
- "I wanted to reach out because..."
RULES:
- Lead with why you're reaching out
- Keep it under 2 sentences
- Make it easy to say yes or no`,

    collaborative: `
WRITE LIKE: Exploring partnership opportunities
STYLE: Open, curious, not pushy.
GOOD EXAMPLES:
- "This is really interesting. Have you considered partnering with companies in X space?"
- "We're working on something similar. Would love to compare notes if you're open to it"
BAD EXAMPLES:
- "I think we should work together..."
- "Let me tell you about my company..."
RULES:
- Express interest without commitment
- Focus on mutual benefit
- Leave room for them to suggest next steps`,

    gratitude: `
WRITE LIKE: Quick thank you that feels genuine
STYLE: Specific, warm, not over the top.
GOOD EXAMPLES:
- "Thanks for sharing this - exactly what I needed to hear today"
- "Appreciate you taking the time to explain. Really helpful perspective"
BAD EXAMPLES:
- "Thank you so much for your valuable insights..."
- "I am incredibly grateful for..."
RULES:
- Be specific about what you're thankful for
- One sentence is often enough
- Don't overdo it`
  };

  // Anti-AI rules specific to messaging
  const antiAIRules = `
AVOID THESE AI GIVEAWAYS:
- ❌ "I hope this message finds you well"
- ❌ "Thank you for reaching out"
- ❌ Perfect grammar throughout (use contractions!)
- ❌ Formal closings: "Best regards", "Sincerely"
- ❌ "I wanted to..."
- ❌ Multiple paragraphs
- ❌ Overly enthusiastic punctuation!!!

INSTEAD, USE:
- ✅ Short, punchy sentences
- ✅ Contractions: I'm, don't, can't, we're
- ✅ Casual connectors: tbh, actually, honestly
- ✅ Imperfect grammar is GOOD
- ✅ Skip greetings when replying to an ongoing conversation
- ✅ Show you're actually reading their message`;

  let prompt = `Write 3 reply options for this LinkedIn conversation.`;

  // Add recipient info
  if (conversationData.recipient) {
    prompt += `\n\nCONVERSATION WITH: ${conversationData.recipient}`;
  }

  // Add shared post content if present
  if (conversationData.sharedPost) {
    prompt += `\n\nSHARED POST CONTENT:`;
    if (conversationData.sharedPost.author) {
      prompt += `\nPost by: ${conversationData.sharedPost.author}`;
    }
    if (conversationData.sharedPost.text) {
      prompt += `\n"""${conversationData.sharedPost.text.substring(0, 500)}"""`;
    }
  }

  // Add conversation history (last 20 messages)
  if (conversationData.messages && conversationData.messages.length > 0) {
    prompt += `\n\nCONVERSATION HISTORY (${conversationData.messages.length} messages):\n`;
    conversationData.messages.forEach((msg, idx) => {
      const sender = msg.isSent ? 'You' : (msg.sender || 'Them');
      prompt += `\n${sender}: ${msg.text.substring(0, 200)}${msg.text.length > 200 ? '...' : ''}`;
    });
    
    // Highlight the most recent message
    const lastMessage = conversationData.messages[conversationData.messages.length - 1];
    if (lastMessage && !lastMessage.isSent) {
      prompt += `\n\nMOST RECENT MESSAGE (Reply to this):\n${lastMessage.sender || 'Them'}: ${lastMessage.text}`;
    }
  }

  prompt += `\n\nREPLY TYPE: ${messageType}
OBJECTIVE: ${typeDescriptions[messageType] || 'write a natural reply'}`;

  // Add style guide for this message type - use custom prompt if available
  const styleGuide = customPrompts[messageType] || styleGuides[messageType];
  if (styleGuide) {
    prompt += `\n\nSTYLE GUIDE FOR THIS REPLY TYPE:${styleGuide}`;
  }

  if (userProfile) {
    prompt += `\n\nABOUT YOU:\n${userProfile}\n\nUse this context to personalize the reply appropriately.`;
  }

  prompt += `\n\n${antiAIRules}`;

  prompt += `\n\nWRITE NATURAL MESSAGES - KEY RULES:
- 1-2 sentences max. Seriously short.
- Write like you're typing on your phone between meetings
- Skip formal structure entirely
- Use contractions: I'm, don't, can't, we're
- Casual abbreviations: tbh, actually, ngl
- Imperfect grammar is BETTER than perfect grammar
- Sometimes start with lowercase
- Trail off with "..." occasionally
- 10-30 words ideal (5 words is fine too!)`;

  prompt += `\n\nREAL EXAMPLES THAT SOUND HUMAN:
- "Thanks for sharing this. Would love to hear more about your approach."
- "Haha same! This is exactly what I needed"
- "That makes sense. Did you run into any scaling issues?"
- "Love this perspective. How long have you been working on it?"
- "This aligns with what we're building. Mind if I reach out?"
- "Saw your post. We're solving similar problems - mind if I share what we're seeing?"
- "Thanks for explaining. Really helpful perspective on this"`;

  prompt += `\n\nMAKE IT SOUND NATURAL:
- Don't explain yourself fully
- Use lowercase sometimes at the start
- Drop words occasionally
- React, don't overthink
- Skip transitions entirely
- One idea per message`;

  prompt += `\n\nNEVER DO THIS:
- "I hope this message finds you well"
- "Thank you for reaching out"
- "Best regards" or "Sincerely"
- Multiple sentences explaining your background
- "I wanted to take a moment to..."
- Perfect formal grammar throughout`;

  prompt += `\n\nTHE SECRET: Write fast, hit send. Replies should feel immediate and effortless.`;

  prompt += `\n\n${antiAIRules}`;

  prompt += `\n\nGENERATE 3 DIFFERENT REPLY OPTIONS:
All three should be different approaches. They should feel like they came from three different real people replying quickly. No labels needed, just three distinct natural replies.`;

  prompt += `\n\nIMPORTANT: Respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, no extra text):
{"replies":[{"text":"First reply here"},{"text":"Second reply here"},{"text":"Third reply here"}]}`;

  return prompt;
}

// Parse message replies from API response
function parseMessageRepliesFromResponse(content) {
  console.log('[Background] parseMessageRepliesFromResponse called, content length:', content.length);
  
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

  let parsedReplies = null;

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(cleanContent);
    console.log('[Background] Successfully parsed JSON, has replies:', !!parsed.replies);
    
    if (parsed.replies && Array.isArray(parsed.replies)) {
      console.log('[Background] JSON parsing successful, found', parsed.replies.length, 'replies');
      parsedReplies = parsed.replies;
    } else if (parsed.reply && typeof parsed.reply === 'string') {
      // Handle single reply format
      parsedReplies = [{ text: parsed.reply }];
    } else if (Array.isArray(parsed)) {
      // Handle direct array format
      parsedReplies = parsed;
    } else {
      console.log('[Background] JSON parsed but no recognized reply structure found');
    }
  } catch (e) {
    console.log('[Background] JSON parsing failed:', e.message);
  }

  // Validate JSON-parsed replies if found
  if (parsedReplies) {
    const validation = validateFinalRepliesArray(parsedReplies);
    if (validation.valid) {
      console.log('[Background] JSON replies validated:', validation.replies.length);
      return validation.replies;
    }
    console.log('[Background] JSON replies validation failed:', validation.error);
  }

  // Fallback: extract replies using various patterns
  const replies = [];
  
  // Pattern 1: Look for "Reply X:" or "Option X:" format
  const replyPattern = /(?:reply|option)\s*\d*[\s:]*["']?([^"']+)["']?/gi;
  let match;
  while ((match = replyPattern.exec(cleanContent)) !== null && replies.length < 3) {
    const text = match[1].trim();
    if (text.length > 5 && text.length < 300) {
      replies.push({ text });
    }
  }
  console.log('[Background] Pattern 1 found:', replies.length, 'replies');
  
  // Pattern 2: Split by newlines and look for substantial lines
  if (replies.length === 0) {
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
      
      if (cleaned && cleaned.length > 10 && cleaned.length < 300 && !cleaned.includes('{') && !cleaned.includes('}')) {
        replies.push({ text: cleaned });
      }
      if (replies.length >= 3) break;
    }
    console.log('[Background] Pattern 2 found:', replies.length, 'replies');
  }

  // Pattern 3: If no structured replies found, split by sentences
  if (replies.length === 0) {
    const sentences = cleanContent.match(/[^.!?]+[.!?]+/g) || [];
    console.log('[Background] Pattern 3: checking', sentences.length, 'sentences');
    if (sentences.length >= 3) {
      replies.push({ text: sentences[0].trim() });
      replies.push({ text: sentences[1].trim() });
      replies.push({ text: sentences[2].trim() });
    } else if (sentences.length >= 2) {
      replies.push({ text: sentences[0].trim() });
      replies.push({ text: sentences[1].trim() });
    }
    console.log('[Background] Pattern 3 found:', replies.length, 'replies');
  }

  // Last resort: use the whole content
  if (replies.length === 0) {
    console.log('[Background] Last resort: using truncated content');
    replies.push({ text: cleanContent.substring(0, 300).trim() });
  }

  // Final validation of fallback replies
  const finalValidation = validateFinalRepliesArray(replies);
  if (finalValidation.valid) {
    console.log('[Background] Total replies returned:', finalValidation.replies.length);
    return finalValidation.replies;
  }

  // Ultimate fallback: return the raw content as a single reply
  console.log('[Background] All validation failed, returning raw content');
  return [{ text: cleanContent.substring(0, 300).trim() || 'Unable to parse reply' }];
}

// Validate the final replies array before returning to content script
function validateFinalRepliesArray(replies) {
  if (!Array.isArray(replies)) {
    return { valid: false, error: 'Replies is not an array' };
  }

  if (replies.length === 0) {
    return { valid: false, error: 'No valid replies could be extracted' };
  }

  // Validate each reply and filter out invalid ones
  const validReplies = [];
  for (let i = 0; i < replies.length; i++) {
    const validation = validateReplyObject(replies[i], i);
    if (validation.valid) {
      validReplies.push({ text: validation.text });
    } else {
      log(`[Background] Skipping invalid reply: ${validation.error}`);
    }
  }

  if (validReplies.length === 0) {
    return { valid: false, error: 'All replies were invalid after validation' };
  }

  // Limit to maximum 3 replies
  if (validReplies.length > 3) {
    log(`[Background] Limiting ${validReplies.length} replies to 3`);
    validReplies.splice(3);
  }

  return { valid: true, replies: validReplies };
}

// Validate a parsed reply object
function validateReplyObject(reply, index) {
  // Handle string replies (convert to object)
  if (typeof reply === 'string') {
    const trimmed = reply.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: `Reply ${index} is empty string` };
    }
    if (trimmed.length > 500) {
      log(`[Background] Warning: Reply ${index} exceeds 500 chars, truncating`);
      return { valid: true, text: trimmed.substring(0, 500) };
    }
    return { valid: true, text: trimmed };
  }

  // Check if reply is an object
  if (!reply || typeof reply !== 'object') {
    return { valid: false, error: `Reply ${index} is not a valid object or string` };
  }

  // Check for text field
  if (reply.text === undefined || reply.text === null) {
    // Try alternative fields
    const textValue = reply.content || reply.message || reply.reply;
    if (typeof textValue === 'string') {
      const trimmed = textValue.trim();
      if (trimmed.length > 0) {
        return { valid: true, text: trimmed.substring(0, 500) };
      }
    }
    return { valid: false, error: `Reply ${index} missing valid text field` };
  }

  // Validate text field
  const text = String(reply.text).trim();
  if (text.length === 0) {
    return { valid: false, error: `Reply ${index} has empty text` };
  }

  if (text.length > 500) {
    log(`[Background] Warning: Reply ${index} exceeds 500 chars, truncating`);
    return { valid: true, text: text.substring(0, 500) };
  }

  return { valid: true, text };
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

  let parsedComments = null;

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(cleanContent);
    console.log('[Background] Successfully parsed JSON, has comments:', !!parsed.comments);
    
    if (parsed.comments && Array.isArray(parsed.comments)) {
      console.log('[Background] JSON parsing successful, found', parsed.comments.length, 'comments');
      parsedComments = parsed.comments;
    } else if (parsed.comment && typeof parsed.comment === 'string') {
      // Handle single comment format
      parsedComments = [{ text: parsed.comment }];
    } else if (Array.isArray(parsed)) {
      // Handle direct array format
      parsedComments = parsed;
    } else {
      console.log('[Background] JSON parsed but no recognized comment structure found');
    }
  } catch (e) {
    console.log('[Background] JSON parsing failed:', e.message);
  }

  // Validate JSON-parsed comments if found
  if (parsedComments) {
    const validation = validateFinalCommentsArray(parsedComments);
    if (validation.valid) {
      console.log('[Background] JSON comments validated:', validation.comments.length);
      return validation.comments;
    }
    console.log('[Background] JSON comments validation failed:', validation.error);
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

  // Final validation of fallback comments
  const finalValidation = validateFinalCommentsArray(comments);
  if (finalValidation.valid) {
    console.log('[Background] Total comments returned:', finalValidation.comments.length);
    return finalValidation.comments;
  }

  // Ultimate fallback: return the raw content as a single comment
  console.log('[Background] All validation failed, returning raw content');
  return [{ text: cleanContent.substring(0, 400).trim() || 'Unable to parse comment' }];
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
  
  // Validate the models response structure
  const validation = validateModelsResponse(data);
  if (!validation.valid) {
    throw new Error(`Models API response validation failed: ${validation.error}`);
  }
  
  // Filter for free models (prompt and completion pricing are both 0)
  const freeModels = validation.models
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
        messages: [{ role: 'user', content: CONFIG.SPEED_TEST.TEST_MESSAGE }],
        max_tokens: CONFIG.API.TEST_MAX_TOKENS
      })
    });

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    if (response.ok) {
      // Validate the response structure
      const data = await response.json();
      console.log('[Background] API response data:', JSON.stringify(data).substring(0, 500));
      const validation = validateChatCompletionResponse(data);
      
      if (!validation.valid) {
        console.error('[Background] Validation failed:', validation.error);
        return { 
          valid: false, 
          error: `Response validation failed: ${validation.error}`,
          responseTime,
          modelId
        };
      }
      
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
    
    // Enable opening side panel when clicking the toolbar icon
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('[Background] Failed to set panel behavior:', error));
  }
});
