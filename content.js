/**
 * LinkedIn Comment Assistant - Content Script
 * Handles post scraping and UI injection on LinkedIn pages
 */

(function() {
  'use strict';

  // Configuration Constants
  const CONFIG = {
    TIMEOUTS: {
      REQUEST: 30000,
      RETRY_DELAY: 1000,
      ERROR_DISPLAY: 5000,
      COPY_FEEDBACK: 2000
    },
    RETRY: {
      MAX_ATTEMPTS: 3
    },
    DEBUG: false
  };

  // Conditional logger
  const log = CONFIG.DEBUG ? console.log : () => {};
  const error = CONFIG.DEBUG ? console.error : () => {};

  // State
  let currentPostData = null;
  let currentCommentBox = null;
  let suggestionPanel = null;
  let currentMode = 'post'; // 'post' or 'message'
  let currentConversationData = null;
  let currentMessageInput = null;

  // Track event listeners for cleanup
  const activeListeners = new Map();

  // Helper to track event listeners
  function addTrackedListener(element, event, handler) {
    element.addEventListener(event, handler);
    if (!activeListeners.has(element)) {
      activeListeners.set(element, []);
    }
    activeListeners.get(element).push({ event, handler });
  }

  // Helper to clean up all listeners for an element
  function cleanupElementListeners(element) {
    const listeners = activeListeners.get(element);
    if (listeners) {
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
      activeListeners.delete(element);
    }
  }

  // Comment types with icons - Brand-focused categories
  const COMMENT_TYPES = {
    expert_take: { 
      icon: '🎯', 
      label: 'Expert Take', 
      description: 'Share unique insight that positions you as knowledgeable'
    },
    relatable_story: { 
      icon: '💭', 
      label: 'Relatable Story', 
      description: 'Share a brief personal experience that connects'
    },
    thought_question: { 
      icon: '🤔', 
      label: 'Thought Provoker', 
      description: 'Ask question that sparks deeper discussion'
    },
    practical_tip: { 
      icon: '💡', 
      label: 'Pro Tip', 
      description: 'Share actionable advice or shortcut'
    },
    connection_bridge: { 
      icon: '🔗', 
      label: 'Bridge Builder', 
      description: 'Connect post to broader trend or community'
    },
    authentic_reaction: { 
      icon: '😅', 
      label: 'Real Talk', 
      description: 'Genuine reaction with personality'
    }
  };

  // Message reply types - 6 tones for messaging
  const MESSAGE_TYPES = {
    professional_networking: {
      icon: '💼',
      label: 'Professional',
      description: 'Polished, industry-appropriate response'
    },
    casual_friendly: {
      icon: '👋',
      label: 'Casual',
      description: 'Friendly and approachable tone'
    },
    follow_up: {
      icon: '📌',
      label: 'Follow Up',
      description: 'Keep the conversation moving forward'
    },
    cold_outreach: {
      icon: '🎯',
      label: 'Outreach',
      description: 'Warm but professional cold approach'
    },
    collaborative: {
      icon: '🤝',
      label: 'Collaborate',
      description: 'Open to working together'
    },
    gratitude: {
      icon: '🙏',
      label: 'Gratitude',
      description: 'Thankful and appreciative response'
    }
  };

  // Check if extension context is valid
  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime !== undefined && 
             chrome.runtime.sendMessage !== undefined;
    } catch (e) {
      return false;
    }
  }

  // Initialize
  function init() {
    console.log('[LinkedIn Comment Assistant] Initializing...');
    
    // Verify Chrome APIs are available
    if (!isExtensionContextValid()) {
      console.error('[LinkedIn Comment Assistant] Extension context not available. Please reload the page.');
      
      // Show a subtle notification on the page
      showContextErrorNotification();
      return;
    }
    
    console.log('[LinkedIn Comment Assistant] Chrome APIs verified, starting...');
    observeCommentBoxes();
  }

  // Show error notification when context is invalid
  function showContextErrorNotification() {
    const notification = document.createElement('div');
    notification.id = 'linkedin-comment-assistant-error';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ffebee;
      border: 1px solid #ef5350;
      border-radius: 8px;
      padding: 16px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    notification.innerHTML = `
      <div style="font-weight: 600; color: #c62828; margin-bottom: 8px;">⚠️ Extension Error</div>
      <div style="font-size: 14px; color: #333; margin-bottom: 12px;">
        The extension context was invalidated. This happens when the extension is updated or reloaded.
      </div>
      <button id="reload-page-btn" style="
        background: #0a66c2;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      ">Reload Page</button>
    `;
    
    document.body.appendChild(notification);
    
    const reloadBtn = document.getElementById('reload-page-btn');
    if (reloadBtn) {
      addTrackedListener(reloadBtn, 'click', () => {
        window.location.reload();
      });
    }
  }

  // Detect if we're in messaging mode
  function detectMode() {
    const isMessaging = window.location.href.includes('/messaging/') ||
                       document.querySelector('.msg-s-message-list-content') !== null ||
                       document.querySelector('.msg-form__contenteditable') !== null;
    
    const newMode = isMessaging ? 'message' : 'post';
    if (newMode !== currentMode) {
      currentMode = newMode;
      console.log(`[LinkedIn Comment Assistant] Mode switched to: ${currentMode}`);
    }
    return currentMode;
  }

  // Watch for comment boxes and message inputs appearing
  function observeCommentBoxes() {
    console.log('[LinkedIn Comment Assistant] Starting to observe for comment boxes...');
    
    // Initial mode detection
    detectMode();
    
    // Inject mode badge if in message mode
    if (currentMode === 'message') {
      injectModeBadgeIntoHeader();
    }
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check mode on DOM changes
            const previousMode = currentMode;
            detectMode();
            
            // Handle mode badge
            if (currentMode === 'message' && previousMode !== 'message') {
              injectModeBadgeIntoHeader();
            } else if (currentMode === 'post' && previousMode === 'message') {
              removeModeBadgeFromHeader();
            }
            
            if (currentMode === 'post') {
              findAndEnhanceCommentBoxes(node);
            } else {
              findAndEnhanceMessageInputs(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check existing inputs
    if (currentMode === 'post') {
      findAndEnhanceCommentBoxes(document.body);
    } else {
      findAndEnhanceMessageInputs(document.body);
    }
  }

  // Inject mode badge into messaging header
  function injectModeBadgeIntoHeader() {
    // Check if badge already exists
    if (document.querySelector('.comment-assistant-mode-badge')) return;
    
    // Find the header container
    const headerContainer = document.querySelector('[data-test-msg-cross-pillar-inbox-top-bar-title]')?.parentElement;
    if (!headerContainer) return;
    
    // Create mode badge
    const modeBadge = document.createElement('div');
    modeBadge.className = 'comment-assistant-mode-badge';
    modeBadge.innerHTML = '💬 Message Mode';
    modeBadge.style.cssText = `
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      color: white;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 12px;
      margin-left: 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    `;
    
    headerContainer.appendChild(modeBadge);
    console.log('[LinkedIn Comment Assistant] Mode badge injected into header');
  }

  // Remove mode badge from header
  function removeModeBadgeFromHeader() {
    const badge = document.querySelector('.comment-assistant-mode-badge');
    if (badge) {
      badge.remove();
      console.log('[LinkedIn Comment Assistant] Mode badge removed from header');
    }
  }

  // Find comment input boxes and add suggest button
  function findAndEnhanceCommentBoxes(container) {
    // LinkedIn uses Quill-based rich text editor (contenteditable div)
    // Selector from SELECTORS.md
    const commentBoxes = container.querySelectorAll('.ql-editor[contenteditable="true"]');
    
    if (commentBoxes.length > 0) {
      console.log(`[LinkedIn Comment Assistant] Found ${commentBoxes.length} comment box(es)`);
    }
    
    commentBoxes.forEach((commentBox, index) => {
      if (!commentBox.dataset.commentAssistantEnhanced) {
        console.log(`[LinkedIn Comment Assistant] Enhancing comment box #${index + 1}`);
        enhanceCommentBox(commentBox);
      }
    });
  }

  // Find message input boxes and add suggest button
  function findAndEnhanceMessageInputs(container) {
    // LinkedIn messaging uses contenteditable divs in forms
    const messageInputs = container.querySelectorAll('.msg-form__contenteditable[contenteditable="true"]');
    
    if (messageInputs.length > 0) {
      console.log(`[LinkedIn Comment Assistant] Found ${messageInputs.length} message input(s)`);
    }
    
    messageInputs.forEach((messageInput, index) => {
      if (!messageInput.dataset.commentAssistantEnhanced) {
        console.log(`[LinkedIn Comment Assistant] Enhancing message input #${index + 1}`);
        enhanceMessageInput(messageInput);
      }
    });
  }

  // Enhance a message input with suggest button
  function enhanceMessageInput(messageInput) {
    messageInput.dataset.commentAssistantEnhanced = 'true';
    
    // Find the message form container - use actual LinkedIn selectors from HTML
    let formContainer = messageInput.closest('.msg-form') ||
                       messageInput.closest('.msg-form--thread-footer-feature') ||
                       messageInput.closest('.msg-compose-form') ||
                       messageInput.parentElement;
    
    if (!formContainer) return;

    // Check if button already exists
    const existingBtn = formContainer.querySelector('.comment-assistant-btn') ||
                       messageInput.parentElement?.querySelector('.comment-assistant-btn');
    if (existingBtn) return;

    // Create suggest button
    const suggestBtn = document.createElement('button');
    suggestBtn.className = 'comment-assistant-btn';
    suggestBtn.innerHTML = '💡 Suggest Reply';
    suggestBtn.title = 'Get AI message suggestions';
    suggestBtn.style.cssText = `
      background: #7c3aed;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background-color 0.2s;
      width: fit-content;
    `;

    addTrackedListener(suggestBtn, 'mouseenter', () => {
      suggestBtn.style.backgroundColor = '#6d28d9';
    });

    addTrackedListener(suggestBtn, 'mouseleave', () => {
      suggestBtn.style.backgroundColor = '#7c3aed';
    });

    addTrackedListener(suggestBtn, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleMessageSuggestClick(messageInput, formContainer);
    });

    // Insert button at the beginning of the container
    if (formContainer.firstChild) {
      formContainer.insertBefore(suggestBtn, formContainer.firstChild);
    } else {
      formContainer.appendChild(suggestBtn);
    }
  }

  // Enhance a comment box with suggest button
  function enhanceCommentBox(commentBox) {
    commentBox.dataset.commentAssistantEnhanced = 'true';
    
    // Find the comment box container using SELECTORS.md reference
    // Try multiple selectors to find the best container
    let formContainer = commentBox.closest('.comments-comment-box--cr') ||
                       commentBox.closest('.comments-comment-box__form') ||
                       commentBox.closest('.editor-container') ||
                       commentBox.closest('form') ||
                       commentBox.parentElement;
    
    if (!formContainer) return;

    // Check if button already exists in the container or nearby
    const existingBtn = formContainer.querySelector('.comment-assistant-btn') ||
                       commentBox.parentElement?.querySelector('.comment-assistant-btn');
    if (existingBtn) return;

    // Create suggest button
    const suggestBtn = document.createElement('button');
    suggestBtn.className = 'comment-assistant-btn';
    suggestBtn.innerHTML = '💡 Suggest Types';
    suggestBtn.title = 'Get AI comment suggestions';
    suggestBtn.style.cssText = `
      background: #0a66c2;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin: 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background-color 0.2s;
      width: fit-content;
    `;

    addTrackedListener(suggestBtn, 'mouseenter', () => {
      suggestBtn.style.backgroundColor = '#004182';
    });

    addTrackedListener(suggestBtn, 'mouseleave', () => {
      suggestBtn.style.backgroundColor = '#0a66c2';
    });

    addTrackedListener(suggestBtn, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSuggestClick(commentBox, formContainer);
    });

    // Insert button at the beginning of the container
    // This works better with LinkedIn's comment box structure
    if (formContainer.firstChild) {
      formContainer.insertBefore(suggestBtn, formContainer.firstChild);
    } else {
      formContainer.appendChild(suggestBtn);
    }
  }

  // Helper to clean up suggestion panel and its listeners
  function cleanupSuggestionPanel() {
    if (suggestionPanel) {
      // Clean up all tracked listeners within the panel
      const elementsWithListeners = suggestionPanel.querySelectorAll('*');
      elementsWithListeners.forEach(el => cleanupElementListeners(el));
      cleanupElementListeners(suggestionPanel);
      
      suggestionPanel.remove();
      suggestionPanel = null;
    }
  }

  // Handle suggest button click
  async function handleSuggestClick(commentBox, formContainer) {
    currentCommentBox = commentBox;
    
    // Remove existing panel
    cleanupSuggestionPanel();

    // Show loading
    showLoading(formContainer);

    try {
      // Scrape post data
      const postData = scrapePostData(commentBox);
      currentPostData = postData;

      // Analyze post to get recommended types
      const recommendedTypes = analyzePostForTypes(postData);

      // Show type selector
      showTypeSelector(formContainer, recommendedTypes);
    } catch (error) {
      console.error('[LinkedIn Comment Assistant] Error:', error);
      showError(formContainer, 'Failed to analyze post. Please try again.');
    }
  }

  // Handle message suggest button click
  async function handleMessageSuggestClick(messageInput, formContainer) {
    currentMessageInput = messageInput;
    
    // Remove existing panel
    cleanupSuggestionPanel();

    // Show loading
    showLoading(formContainer);

    try {
      // Scrape conversation data
      const conversationData = scrapeConversationData();
      currentConversationData = conversationData;

      // Show message type selector
      showMessageTypeSelector(formContainer);
    } catch (error) {
      console.error('[LinkedIn Comment Assistant] Error:', error);
      showError(formContainer, 'Failed to analyze conversation. Please try again.');
    }
  }

  // Scrape conversation data from LinkedIn messaging
  function scrapeConversationData() {
    console.log('[LinkedIn Comment Assistant] Scraping conversation data...');
    
    const conversationData = {
      messages: [],
      recipient: null,
      sharedPost: null
    };

    // Get conversation container
    const messageList = document.querySelector('.msg-s-message-list-content') ||
                       document.querySelector('.msg-s-message-group__messages');
    
    if (!messageList) {
      console.warn('[LinkedIn Comment Assistant] Could not find message list container');
      return conversationData;
    }

    // Get all message event items (limited to last 20)
    const messageItems = messageList.querySelectorAll('.msg-s-event-listitem');
    const recentItems = Array.from(messageItems).slice(-20);

    console.log(`[LinkedIn Comment Assistant] Found ${messageItems.length} messages, using last ${recentItems.length}`);

    recentItems.forEach((item, index) => {
      // Check if this is from the current user (sent) or other (received)
      const isSent = item.classList.contains('msg-s-event-listitem--other') === false;
      
      // Get message text
      const bodyElement = item.querySelector('.msg-s-event-listitem__body');
      const messageText = bodyElement ? bodyElement.textContent.trim() : '';
      
      // Get sender info
      const senderElement = item.closest('.msg-s-message-group')?.querySelector('.msg-s-message-group__name');
      const senderName = senderElement ? senderElement.textContent.trim() : (isSent ? 'You' : 'Them');
      
      // Get timestamp
      const timeElement = item.querySelector('.msg-s-message-group__timestamp');
      const timestamp = timeElement ? timeElement.textContent.trim() : '';

      if (messageText) {
        conversationData.messages.push({
          text: messageText,
          sender: senderName,
          isSent: isSent,
          timestamp: timestamp,
          index: index
        });
      }
    });

    // Get recipient info from the conversation header
    const headerElement = document.querySelector('.msg-conversation-card__title') ||
                         document.querySelector('.msg-thread__link-to-profile');
    if (headerElement) {
      conversationData.recipient = headerElement.textContent.trim();
    }

    // Check for shared post content
    const sharedPostContainer = document.querySelector('.update-components-mini-update-v2__reshared-content') ||
                               document.querySelector('.msg-s-event-listitem__external-shared-content');
    
    if (sharedPostContainer) {
      const postText = sharedPostContainer.textContent.trim();
      const postAuthor = sharedPostContainer.querySelector('.update-components-actor__name')?.textContent?.trim();
      
      conversationData.sharedPost = {
        text: postText,
        author: postAuthor
      };
      console.log('[LinkedIn Comment Assistant] Found shared post in conversation');
    }

    console.log('[LinkedIn Comment Assistant] Conversation data scraped:', {
      messageCount: conversationData.messages.length,
      recipient: conversationData.recipient,
      hasSharedPost: !!conversationData.sharedPost
    });

    return conversationData;
  }

  // Show loading indicator
  function showLoading(container) {
    const loading = document.createElement('div');
    loading.className = 'comment-assistant-loading';
    loading.innerHTML = 'Analyzing post... ⏳';
    loading.style.cssText = `
      padding: 12px;
      color: #666;
      font-size: 14px;
      margin: 8px 0;
    `;
    container.appendChild(loading);
  }

  // Scrape post data from LinkedIn
  function scrapePostData(commentBox) {
    console.log('[LinkedIn Comment Assistant] Scraping post data...');
    
    // Navigate up to find the post container
    let postContainer = commentBox.closest('.feed-shared-update-v2');
    let traversalSteps = 0;

    if (!postContainer) {
      // Try alternative: traverse up DOM tree
      let element = commentBox;
      for (let i = 0; i < 15 && element; i++) {
        element = element.parentElement;
        traversalSteps++;
        if (element && element.classList.contains('feed-shared-update-v2')) {
          postContainer = element;
          console.log(`[LinkedIn Comment Assistant] Found post container after ${traversalSteps} parent traversals`);
          break;
        }
      }
    } else {
      console.log('[LinkedIn Comment Assistant] Found post container via closest()');
    }

    if (!postContainer) {
      console.error('[LinkedIn Comment Assistant] Could not find .feed-shared-update-v2 container');
      throw new Error('Could not find post container');
    }

    // Get post ID
    const postId = postContainer.getAttribute('data-urn');
    console.log(`[LinkedIn Comment Assistant] Post ID: ${postId || 'Not found'}`);

    // Extract post text
    const textElement = postContainer.querySelector('.update-components-text .break-words');
    let postText = textElement ? textElement.textContent.trim() : '';

    // Check if text is truncated
    const hasMoreButton = postContainer.querySelector('.feed-shared-inline-show-more-text__see-more-less-toggle') !== null;
    if (hasMoreButton && postText.length < 100) {
      console.log('[LinkedIn Comment Assistant] Post text may be truncated');
    }

    // Extract hashtags
    const hashtags = postText.match(/#[\w]+/g) || [];
    console.log(`[LinkedIn Comment Assistant] Found ${hashtags.length} hashtags`);

    // Extract author info
    const authorElement = postContainer.querySelector('.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]');
    let authorName = authorElement ? authorElement.textContent.trim() : '';
    console.log(`[LinkedIn Comment Assistant] Author: ${authorName || 'Not found'}`);

    const headlineElement = postContainer.querySelector('.update-components-actor__description span[aria-hidden="true"]');
    let authorHeadline = headlineElement ? headlineElement.textContent.trim() : '';
    console.log(`[LinkedIn Comment Assistant] Headline: ${authorHeadline ? authorHeadline.substring(0, 50) + '...' : 'Not found'}`);

    // Check author badges
    const isVerified = postContainer.querySelector('.text-view-model__verified-icon') !== null;
    const isPremium = postContainer.querySelector('.text-view-model__linkedin-bug-premium-v2') !== null;
    console.log(`[LinkedIn Comment Assistant] Author badges - Verified: ${isVerified}, Premium: ${isPremium}`);

    // Get connection degree
    const connectionDegreeElement = postContainer.querySelector('.update-components-actor__supplementary-actor-info span[aria-hidden="true"]');
    const connectionDegree = connectionDegreeElement ? connectionDegreeElement.textContent.match(/•\s*(\w+)/)?.[1] : '';
    console.log(`[LinkedIn Comment Assistant] Connection degree: ${connectionDegree || 'N/A'}`);

    // Get post metadata
    const timestampElement = postContainer.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]');
    const timestamp = timestampElement ? timestampElement.textContent.split('•')[0].trim() : '';
    const isEdited = timestamp ? timestamp.includes('Edited') : false;
    console.log(`[LinkedIn Comment Assistant] Timestamp: ${timestamp || 'N/A'}, Edited: ${isEdited}`);

    // Check post visibility
    const isPublic = postContainer.querySelector('li-icon[type="globe-americas"]') !== null;
    console.log(`[LinkedIn Comment Assistant] Is public: ${isPublic}`);

    // Detect post type
    const isJobPost = postContainer.querySelector('.update-components-entity') !== null;
    const hasArticle = postContainer.querySelector('.update-components-article') !== null;
    const hasImages = postContainer.querySelector('.update-components-image') !== null;
    const isSingleImage = postContainer.querySelector('.update-components-image--single-image') !== null;
    const isImageGrid = postContainer.querySelector('.update-components-image--smart-grid') !== null;
    
    let postType = 'text';
    if (isJobPost) postType = 'job';
    else if (hasArticle) postType = 'article';
    else if (hasImages) postType = 'image';
    
    console.log(`[LinkedIn Comment Assistant] Post type: ${postType}`);
    console.log(`[LinkedIn Comment Assistant] Has images: ${hasImages}, Single: ${isSingleImage}, Grid: ${isImageGrid}`);

    // Get engagement metrics
    const reactionsText = postContainer.querySelector('.social-details-social-counts__reactions-count')?.textContent?.trim();
    const reactionsCount = parseInt(reactionsText) || 0;
    
    const commentsText = postContainer.querySelector('.social-details-social-counts__comments button span[aria-hidden="true"]')?.textContent;
    const commentsCount = commentsText ? parseInt(commentsText.match(/(\d+)/)?.[0]) || 0 : 0;
    
    const repostsElement = postContainer.querySelector('[aria-label*="reposts"]');
    const repostsMatch = repostsElement ? repostsElement.textContent.match(/(\d+)\s*repost/) : null;
    const repostsCount = repostsMatch ? parseInt(repostsMatch[1]) : 0;
    
    console.log(`[LinkedIn Comment Assistant] Engagement - Reactions: ${reactionsCount}, Comments: ${commentsCount}, Reposts: ${repostsCount}`);

    // Get social proof header (who liked/commented)
    const socialProofText = postContainer.querySelector('.update-components-header__text-view')?.textContent;
    const hasSocialProof = postContainer.querySelector('.update-components-header') !== null;
    console.log(`[LinkedIn Comment Assistant] Has social proof: ${hasSocialProof}, Text: ${socialProofText ? socialProofText.substring(0, 50) : 'N/A'}`);

    // Extract job data if job post
    let jobData = null;
    if (isJobPost) {
      const jobTitle = postContainer.querySelector('.update-components-entity__title')?.textContent;
      const companyName = postContainer.querySelector('.update-components-entity__subtitle')?.textContent?.replace('Job by ', '');
      const jobLocation = postContainer.querySelector('.update-components-entity__description')?.textContent;
      
      jobData = {
        title: jobTitle,
        company: companyName,
        location: jobLocation
      };
      console.log(`[LinkedIn Comment Assistant] Job data - Title: ${jobTitle || 'N/A'}, Company: ${companyName || 'N/A'}`);
    }

    // Extract article data if shared article
    let articleData = null;
    if (hasArticle) {
      const articleTitle = postContainer.querySelector('.update-components-article__title')?.textContent;
      const articleSource = postContainer.querySelector('.update-components-article__subtitle')?.textContent;
      
      articleData = {
        title: articleTitle,
        source: articleSource
      };
      console.log(`[LinkedIn Comment Assistant] Article data - Title: ${articleTitle || 'N/A'}, Source: ${articleSource || 'N/A'}`);
    }

    const postData = {
      text: postText,
      author: authorName,
      authorHeadline: authorHeadline,
      authorVerified: isVerified,
      authorPremium: isPremium,
      connectionDegree: connectionDegree,
      postId: postId,
      timestamp: timestamp,
      isEdited: isEdited,
      isPublic: isPublic,
      postType: postType,
      hasImages: hasImages,
      isSingleImage: isSingleImage,
      isImageGrid: isImageGrid,
      hashtags: hashtags,
      engagement: {
        reactions: reactionsCount,
        comments: commentsCount,
        reposts: repostsCount
      },
      socialProof: {
        hasSocialProof: hasSocialProof,
        text: socialProofText
      },
      job: jobData,
      article: articleData,
      url: window.location.href
    };
    
    console.log('[LinkedIn Comment Assistant] Post data scraped successfully:', {
      textLength: postText.length,
      hasAuthor: !!authorName,
      hasHeadline: !!authorHeadline,
      postType: postType,
      engagement: postData.engagement
    });
    
    return postData;
  }

  // Analyze post to determine recommended comment types
  function analyzePostForTypes(postData) {
    console.log('[LinkedIn Comment Assistant] Analyzing post for comment types...');
    const text = (postData.text || '').toLowerCase();
    const scores = {};

    // Scoring patterns for each type - Brand-focused categories
    const patterns = {
      expert_take: [
        /strategy|approach|method|framework|system/i,
        /data|research|study|survey|report|found|discovered/i,
        /industry|market|sector|field|profession/i,
        /best practice|standard|principle|theory/i,
        /analysis|breakdown|examination/i
      ],
      relatable_story: [
        /struggling|challenge|difficult|hard time|tough/i,
        /vulnerable|honest|authentic|real|genuine/i,
        /burnout|mental health|overwhelmed|stress/i,
        /journey|process|learning|growth|evolution/i,
        /experience|went through|happened to me|my story/i,
        /lesson|realized|learned|understood/i
      ],
      thought_question: [
        /\?/,
        /what do you think|how do you|what are your thoughts/i,
        /curious|wondering|interested in|want to know/i,
        /help me|advice|suggestion|recommendation/i,
        /has anyone|does anyone|who else/i
      ],
      practical_tip: [
        /tip|trick|hack|guide|how to|tutorial/i,
        /try this|do this|start with|begin by/i,
        /tool|app|software|resource|template/i,
        /step|process|checklist|blueprint/i,
        /lesson|takeaway|key point|main thing/i,
        /save time|improve|increase|boost|optimize/i
      ],
      connection_bridge: [
        /trend|pattern|shift|change|movement/i,
        /reminds me of|similar to|just like|compared to/i,
        /broader|bigger picture|larger context|wider/i,
        /industry|sector|market|field|space/i,
        /future|upcoming|next|coming|ahead/i,
        /we're seeing|i'm noticing|observing|witnessing/i
      ],
      authentic_reaction: [
        /congratulations|promoted|new role|milestone|excited/i,
        /love this|hate this|agree|disagree|same/i,
        /wow|omg|oof|yikes|tbh|ngl|imo/i,
        /this is|this hits|this resonates|so true/i,
        /celebrating|achievement|success|win|victory/i,
        /funny|hilarious|sad|touching|inspiring/i
      ]
    };

    // Calculate scores based on text patterns
    for (const [type, regexes] of Object.entries(patterns)) {
      scores[type] = 0;
      regexes.forEach(regex => {
        if (regex.test(text)) {
          scores[type] += 1;
        }
      });
    }

    // Boost scores based on post type
    if (postData.postType) {
      console.log(`[LinkedIn Comment Assistant] Post type: ${postData.postType}, adjusting scores...`);
      
      if (postData.postType === 'job') {
        // Job posts - practical tips and thought questions work best
        scores.practical_tip = (scores.practical_tip || 0) + 3;
        scores.thought_question = (scores.thought_question || 0) + 2;
        scores.expert_take = (scores.expert_take || 0) + 1;
      } else if (postData.postType === 'article') {
        // Article posts - expert takes and connection bridges work best
        scores.expert_take = (scores.expert_take || 0) + 3;
        scores.connection_bridge = (scores.connection_bridge || 0) + 2;
        scores.thought_question = (scores.thought_question || 0) + 1;
      } else if (postData.postType === 'image') {
        // Image posts - authentic reactions and relatable stories work best
        scores.authentic_reaction = (scores.authentic_reaction || 0) + 3;
        scores.relatable_story = (scores.relatable_story || 0) + 2;
      }
    }

    // Boost based on engagement level
    if (postData.engagement) {
      const { reactions, comments } = postData.engagement;
      if (reactions > 100 || comments > 20) {
        // High engagement posts - expert takes and connection bridges stand out
        scores.expert_take = (scores.expert_take || 0) + 1;
        scores.connection_bridge = (scores.connection_bridge || 0) + 1;
      }
    }

    // Sort by score and get top 3
    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    // If no matches, return default types based on post type
    if (sorted.length === 0) {
      console.log('[LinkedIn Comment Assistant] No patterns matched, using default types');
      
      if (postData.postType === 'job') {
        return ['practical_tip', 'thought_question', 'expert_take'];
      } else if (postData.postType === 'article') {
        return ['expert_take', 'connection_bridge', 'thought_question'];
      } else if (postData.postType === 'image') {
        return ['authentic_reaction', 'relatable_story', 'thought_question'];
      }
      
      return ['expert_take', 'thought_question', 'relatable_story'];
    }
    
    const recommendedTypes = sorted.slice(0, 3).map(([type]) => type);
    console.log('[LinkedIn Comment Assistant] Recommended types:', recommendedTypes, 'Scores:', scores);

    return recommendedTypes;
  }

  // Show type selector UI
  function showTypeSelector(container, recommendedTypes) {
    // Remove loading
    const loading = container.querySelector('.comment-assistant-loading');
    if (loading) loading.remove();

    // Remove existing panel
    cleanupSuggestionPanel();

    suggestionPanel = document.createElement('div');
    suggestionPanel.className = 'comment-assistant-panel';
    suggestionPanel.style.cssText = `
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin: 8px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 100%;
    `;

    const title = document.createElement('div');
    title.textContent = 'Select comment type:';
    title.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
    `;
    suggestionPanel.appendChild(title);

    const typesContainer = document.createElement('div');
    typesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Show recommended types first
    recommendedTypes.forEach(type => {
      const typeData = COMMENT_TYPES[type];
      if (typeData) {
        const btn = createTypeButton(type, typeData, true);
        typesContainer.appendChild(btn);
      }
    });

    // Show "Other types" option
    const otherBtn = document.createElement('button');
    otherBtn.textContent = 'Show other types...';
    otherBtn.style.cssText = `
      background: none;
      border: none;
      color: #0a66c2;
      text-decoration: underline;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      text-align: left;
    `;
    addTrackedListener(otherBtn, 'click', () => {
      showAllTypes(typesContainer, recommendedTypes);
      cleanupElementListeners(otherBtn);
      otherBtn.remove();
    });
    typesContainer.appendChild(otherBtn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      margin-top: 8px;
      text-align: right;
      width: 100%;
    `;
    addTrackedListener(closeBtn, 'click', () => {
      cleanupSuggestionPanel();
    });

    suggestionPanel.appendChild(typesContainer);
    suggestionPanel.appendChild(closeBtn);
    container.appendChild(suggestionPanel);
  }

  // Show message type selector UI
  function showMessageTypeSelector(container) {
    // Remove loading
    const loading = container.querySelector('.comment-assistant-loading');
    if (loading) loading.remove();

    // Remove existing panel
    cleanupSuggestionPanel();

    suggestionPanel = document.createElement('div');
    suggestionPanel.className = 'comment-assistant-panel';
    suggestionPanel.style.cssText = `
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin: 8px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 100%;
    `;

    const title = document.createElement('div');
    title.innerHTML = '💬 Select message tone:';
    title.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
    `;
    suggestionPanel.appendChild(title);

    const typesContainer = document.createElement('div');
    typesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Show all message types
    Object.keys(MESSAGE_TYPES).forEach(type => {
      const typeData = MESSAGE_TYPES[type];
      if (typeData) {
        const btn = createMessageTypeButton(type, typeData);
        typesContainer.appendChild(btn);
      }
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      margin-top: 8px;
      text-align: right;
      width: 100%;
    `;
    addTrackedListener(closeBtn, 'click', () => {
      cleanupSuggestionPanel();
    });

    suggestionPanel.appendChild(typesContainer);
    suggestionPanel.appendChild(closeBtn);
    container.appendChild(suggestionPanel);
  }

  // Create a message type selection button
  function createMessageTypeButton(type, typeData) {
    const btn = document.createElement('button');
    btn.className = 'comment-type-btn';
    btn.style.cssText = `
      background: #faf5ff;
      border: 1px solid #d8b4fe;
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const icon = document.createElement('span');
    icon.textContent = typeData.icon;
    icon.style.fontSize = '20px';

    const content = document.createElement('div');
    content.style.flex = '1';

    const label = document.createElement('div');
    label.textContent = typeData.label;
    label.style.cssText = `
      font-weight: 600;
      color: #333;
      font-size: 14px;
    `;

    const desc = document.createElement('div');
    desc.textContent = typeData.description;
    desc.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    `;

    content.appendChild(label);
    content.appendChild(desc);
    btn.appendChild(icon);
    btn.appendChild(content);

    addTrackedListener(btn, 'mouseenter', () => {
      btn.style.backgroundColor = '#f3e8ff';
    });

    addTrackedListener(btn, 'mouseleave', () => {
      btn.style.backgroundColor = '#faf5ff';
    });

    addTrackedListener(btn, 'click', () => {
      generateMessageReplies(type);
    });

    return btn;
  }

  // Create a type selection button
  function createTypeButton(type, typeData, isRecommended) {
    const btn = document.createElement('button');
    btn.className = 'comment-type-btn';
    btn.style.cssText = `
      background: ${isRecommended ? '#e7f3ff' : '#f3f2ef'};
      border: 1px solid ${isRecommended ? '#0a66c2' : '#ddd'};
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const icon = document.createElement('span');
    icon.textContent = typeData.icon;
    icon.style.fontSize = '20px';

    const content = document.createElement('div');
    content.style.flex = '1';

    const label = document.createElement('div');
    label.textContent = typeData.label;
    label.style.cssText = `
      font-weight: 600;
      color: #333;
      font-size: 14px;
    `;

    const desc = document.createElement('div');
    desc.textContent = typeData.description;
    desc.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    `;

    content.appendChild(label);
    content.appendChild(desc);
    btn.appendChild(icon);
    btn.appendChild(content);

    addTrackedListener(btn, 'mouseenter', () => {
      btn.style.backgroundColor = isRecommended ? '#d0e8ff' : '#e5e5e5';
    });

    addTrackedListener(btn, 'mouseleave', () => {
      btn.style.backgroundColor = isRecommended ? '#e7f3ff' : '#f3f2ef';
    });

    addTrackedListener(btn, 'click', () => {
      generateComments(type);
    });

    return btn;
  }

  // Show all comment types
  function showAllTypes(container, excludeTypes) {
    const allTypes = Object.keys(COMMENT_TYPES);
    const otherTypes = allTypes.filter(t => !excludeTypes.includes(t));

    otherTypes.forEach(type => {
      const typeData = COMMENT_TYPES[type];
      const btn = createTypeButton(type, typeData, false);
      
      // Insert before the "Show other types" button
      const otherBtn = container.querySelector('button');
      if (otherBtn) {
        container.insertBefore(btn, otherBtn);
      } else {
        container.appendChild(btn);
      }
    });
  }

  // Generate comments for selected type
  async function generateComments(commentType) {
    console.log(`[LinkedIn Comment Assistant] Generating comments for type: ${commentType}`);
    
    if (!suggestionPanel || !currentPostData) {
      console.warn('[LinkedIn Comment Assistant] Missing suggestionPanel or currentPostData');
      return;
    }

    // Show loading in panel
    suggestionPanel.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <div style="font-size: 24px; margin-bottom: 8px;">✨</div>
        <div>Generating ${COMMENT_TYPES[commentType].label.toLowerCase()} comments...</div>
      </div>
    `;

    // Retry logic
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[LinkedIn Comment Assistant] Retry attempt ${attempt}/${maxRetries}...`);
      }
      
      try {
        // Check if chrome.runtime is available
        console.log('[LinkedIn Comment Assistant] Checking Chrome runtime availability...');
        if (typeof chrome === 'undefined') {
          throw new Error('Chrome API not available');
        }
        
        if (!chrome.runtime) {
          throw new Error('Extension context invalidated');
        }
        
        if (!chrome.runtime.sendMessage) {
          throw new Error('Message API not available');
        }
        
        console.log('[LinkedIn Comment Assistant] Chrome runtime is available, sending message to background...');

        let response;
        try {
          // Send message to background script with timeout
          response = await Promise.race([
            chrome.runtime.sendMessage({
              action: 'generateComments',
              data: {
                postData: currentPostData,
                commentType: commentType
              }
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), CONFIG.TIMEOUTS.REQUEST)
            )
          ]);
          
          console.log('[LinkedIn Comment Assistant] Received response from background:', response ? 'success' : 'empty');
          
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
          }
        } catch (sendError) {
          console.error('[LinkedIn Comment Assistant] Error sending message:', sendError);
          // Handle specific sendMessage errors
          if (sendError.message && sendError.message.includes('Could not establish connection')) {
            throw new Error('Connection failed');
          }
          throw sendError;
        }

        if (!response) {
          throw new Error('No response from background script');
        }

        if (response.error) {
          throw new Error(response.error);
        }

        // Validate response format
        if (!response.comments || !Array.isArray(response.comments)) {
          throw new Error('Invalid response format: comments array missing');
        }

        if (response.comments.length === 0) {
          throw new Error('No comments generated');
        }

        // Success!
        displayGeneratedComments(response.comments, commentType, response.usedFallback, response.model);
        return; // Exit the function on success
        
      } catch (error) {
        lastError = error;
        console.error(`[LinkedIn Comment Assistant] Attempt ${attempt + 1} failed:`, error);
        
        // If this is a context error, don't retry
        if (error.message && (
          error.message.includes('context invalidated') ||
          error.message.includes('Chrome API not available') ||
          error.message.includes('Extension context')
        )) {
          break;
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.RETRY_DELAY * (attempt + 1)));
        }
      }
    }
    
    // All retries failed or context error
    handleGenerationError(lastError);
  }

  // Generate message replies for selected type
  async function generateMessageReplies(messageType) {
    console.log(`[LinkedIn Comment Assistant] Generating message replies for type: ${messageType}`);
    
    if (!suggestionPanel || !currentConversationData) {
      console.warn('[LinkedIn Comment Assistant] Missing suggestionPanel or currentConversationData');
      return;
    }

    // Show loading in panel
    suggestionPanel.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <div style="font-size: 24px; margin-bottom: 8px;">💬</div>
        <div>Generating ${MESSAGE_TYPES[messageType].label.toLowerCase()} reply...</div>
      </div>
    `;

    // Retry logic
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[LinkedIn Comment Assistant] Retry attempt ${attempt}/${maxRetries}...`);
      }
      
      try {
        // Check if chrome.runtime is available
        if (typeof chrome === 'undefined') {
          throw new Error('Chrome API not available');
        }
        
        if (!chrome.runtime) {
          throw new Error('Extension context invalidated');
        }
        
        if (!chrome.runtime.sendMessage) {
          throw new Error('Message API not available');
        }

        let response;
        try {
          // Send message to background script with timeout
          response = await Promise.race([
            chrome.runtime.sendMessage({
              action: 'generateMessageReplies',
              data: {
                conversationData: currentConversationData,
                messageType: messageType
              }
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), CONFIG.TIMEOUTS.REQUEST)
            )
          ]);
          
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            throw new Error(chrome.runtime.lastError.message);
          }
        } catch (sendError) {
          console.error('[LinkedIn Comment Assistant] Error sending message:', sendError);
          if (sendError.message && sendError.message.includes('Could not establish connection')) {
            throw new Error('Connection failed');
          }
          throw sendError;
        }

        if (!response) {
          throw new Error('No response from background script');
        }

        if (response.error) {
          throw new Error(response.error);
        }

        // Validate response format
        if (!response.replies || !Array.isArray(response.replies)) {
          throw new Error('Invalid response format: replies array missing');
        }

        if (response.replies.length === 0) {
          throw new Error('No replies generated');
        }

        // Success!
        displayGeneratedMessageReplies(response.replies, messageType, response.usedFallback, response.model);
        return;
        
      } catch (error) {
        lastError = error;
        console.error(`[LinkedIn Comment Assistant] Attempt ${attempt + 1} failed:`, error);
        
        if (error.message && (
          error.message.includes('context invalidated') ||
          error.message.includes('Chrome API not available') ||
          error.message.includes('Extension context')
        )) {
          break;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.RETRY_DELAY * (attempt + 1)));
        }
      }
    }
    
    handleGenerationError(lastError);
  }
  
  // Handle generation errors with specific messages
  function handleGenerationError(error) {
    console.error('[LinkedIn Comment Assistant] Final error:', error);
    
    let errorMessage = 'Failed to generate comments.';
    
    // Check if it's a context invalidated error
    if (error.message && (
      error.message.includes('context invalidated') ||
      error.message.includes('Extension context')
    )) {
      errorMessage = `
        <strong>Extension was updated or reloaded.</strong><br><br>
        Please reload this LinkedIn page and try again.<br>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #0a66c2; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      `;
    } else if (error.message && error.message.includes('Connection failed')) {
      errorMessage = 'Unable to connect to extension background. Please reload the page.';
    } else if (error.message && error.message.includes('Chrome API')) {
      errorMessage = 'Extension not properly loaded. Please reload the LinkedIn page.';
    } else if (error.message && error.message.includes('API key')) {
      errorMessage = error.message;
    } else {
      errorMessage = error.message || 'Failed to generate comments. Please check your API key in settings.';
    }
    
    showErrorInPanel(errorMessage);
  }

  // Display generated comments
  function displayGeneratedComments(comments, commentType, usedFallback = false, modelName = null) {
    if (!suggestionPanel) return;

    suggestionPanel.innerHTML = '';

    const title = document.createElement('div');
    title.innerHTML = `${COMMENT_TYPES[commentType].icon} ${COMMENT_TYPES[commentType].label} Comments`;
    title.style.cssText = `
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
      font-size: 16px;
    `;
    suggestionPanel.appendChild(title);

    // Show fallback notification if used
    if (usedFallback && modelName) {
      const fallbackNotice = document.createElement('div');
      fallbackNotice.innerHTML = `⚠️ Primary model failed. Used fallback: ${modelName.split('/').pop()}`;
      fallbackNotice.style.cssText = `
        font-size: 11px;
        color: #f57c00;
        margin-bottom: 8px;
        padding: 6px 10px;
        background: #fff8e1;
        border: 1px solid #ffc107;
        border-radius: 6px;
      `;
      suggestionPanel.appendChild(fallbackNotice);
    }



    const commentsContainer = document.createElement('div');
    commentsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    comments.forEach((comment, index) => {
      const commentCard = createCommentCard(comment, index);
      commentsContainer.appendChild(commentCard);
    });

    // Regenerate button
    const regenerateBtn = document.createElement('button');
    regenerateBtn.innerHTML = '🔄 Generate More';
    regenerateBtn.style.cssText = `
      background: #f3f2ef;
      border: 1px solid #ddd;
      border-radius: 16px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 12px;
      color: #333;
    `;
    addTrackedListener(regenerateBtn, 'click', () => generateComments(commentType));

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to types';
    backBtn.style.cssText = `
      background: none;
      border: none;
      color: #0a66c2;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      margin-top: 8px;
    `;
    addTrackedListener(backBtn, 'click', () => {
      const recommendedTypes = analyzePostForTypes(currentPostData);
      showTypeSelector(suggestionPanel.parentElement, recommendedTypes);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      margin-top: 8px;
    `;
    addTrackedListener(closeBtn, 'click', () => {
      cleanupSuggestionPanel();
    });

    suggestionPanel.appendChild(commentsContainer);
    suggestionPanel.appendChild(regenerateBtn);
    suggestionPanel.appendChild(backBtn);
    suggestionPanel.appendChild(closeBtn);
  }

  // Display generated message replies
  function displayGeneratedMessageReplies(replies, messageType, usedFallback = false, modelName = null) {
    if (!suggestionPanel) return;

    suggestionPanel.innerHTML = '';

    const title = document.createElement('div');
    title.innerHTML = `${MESSAGE_TYPES[messageType].icon} ${MESSAGE_TYPES[messageType].label} Replies`;
    title.style.cssText = `
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
      font-size: 16px;
    `;
    suggestionPanel.appendChild(title);

    // Show fallback notification if used
    if (usedFallback && modelName) {
      const fallbackNotice = document.createElement('div');
      fallbackNotice.innerHTML = `⚠️ Primary model failed. Used fallback: ${modelName.split('/').pop()}`;
      fallbackNotice.style.cssText = `
        font-size: 11px;
        color: #f57c00;
        margin-bottom: 8px;
        padding: 6px 10px;
        background: #fff8e1;
        border: 1px solid #ffc107;
        border-radius: 6px;
      `;
      suggestionPanel.appendChild(fallbackNotice);
    }

    const repliesContainer = document.createElement('div');
    repliesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    replies.forEach((reply, index) => {
      const replyCard = createMessageReplyCard(reply, index);
      repliesContainer.appendChild(replyCard);
    });

    // Regenerate button
    const regenerateBtn = document.createElement('button');
    regenerateBtn.innerHTML = '🔄 Generate More';
    regenerateBtn.style.cssText = `
      background: #f3f2ef;
      border: 1px solid #ddd;
      border-radius: 16px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 12px;
      color: #333;
    `;
    addTrackedListener(regenerateBtn, 'click', () => generateMessageReplies(messageType));

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back to types';
    backBtn.style.cssText = `
      background: none;
      border: none;
      color: #7c3aed;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      margin-top: 8px;
    `;
    addTrackedListener(backBtn, 'click', () => {
      showMessageTypeSelector(suggestionPanel.parentElement);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 8px;
      font-size: 14px;
      margin-top: 8px;
    `;
    addTrackedListener(closeBtn, 'click', () => {
      cleanupSuggestionPanel();
    });

    suggestionPanel.appendChild(repliesContainer);
    suggestionPanel.appendChild(regenerateBtn);
    suggestionPanel.appendChild(backBtn);
    suggestionPanel.appendChild(closeBtn);
  }

  // Create a message reply card
  function createMessageReplyCard(reply, index) {
    const card = document.createElement('div');
    card.style.cssText = `
      background: #faf5ff;
      border: 1px solid #d8b4fe;
      border-radius: 8px;
      padding: 12px;
      position: relative;
    `;

    const text = document.createElement('div');
    text.textContent = reply.text;
    text.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      margin-bottom: 10px;
      white-space: pre-wrap;
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    `;

    const useBtn = document.createElement('button');
    useBtn.textContent = 'Use This';
    useBtn.style.cssText = `
      background: #7c3aed;
      color: white;
      border: none;
      border-radius: 16px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    `;
    addTrackedListener(useBtn, 'click', () => insertMessageReply(reply.text));

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy';
    copyBtn.style.cssText = `
      background: white;
      border: 1px solid #ccc;
      border-radius: 16px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      color: #666;
    `;
    addTrackedListener(copyBtn, 'click', () => {
      navigator.clipboard.writeText(reply.text);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy';
      }, 2000);
    });

    actions.appendChild(useBtn);
    actions.appendChild(copyBtn);
    card.appendChild(text);
    card.appendChild(actions);

    return card;
  }

  // Insert message reply into LinkedIn message input
  function insertMessageReply(text) {
    console.log('[LinkedIn Comment Assistant] Inserting message reply:', text.substring(0, 50) + '...');
    
    if (!currentMessageInput) {
      console.error('[LinkedIn Comment Assistant] No currentMessageInput available');
      return;
    }

    // LinkedIn message inputs use contenteditable divs
    if (currentMessageInput.getAttribute('contenteditable') === 'true') {
      console.log('[LinkedIn Comment Assistant] Using contenteditable method for message');
      
      // Focus first to ensure the input is active
      currentMessageInput.focus();
      
      // Use execCommand for better React compatibility
      currentMessageInput.innerHTML = '';
      
      // Create a single paragraph with the text
      const p = document.createElement('p');
      if (text.includes('\n')) {
        // Handle multiline text
        const lines = text.split('\n');
        lines.forEach((line, index) => {
          if (index > 0) {
            p.appendChild(document.createElement('br'));
          }
          if (line) {
            p.appendChild(document.createTextNode(line));
          }
        });
      } else {
        p.textContent = text;
      }
      currentMessageInput.appendChild(p);
      
      // Trigger comprehensive events for LinkedIn's React components
      const triggerInputEvent = (element, eventType, options = {}) => {
        const event = new InputEvent(eventType, {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
          ...options
        });
        element.dispatchEvent(event);
      };
      
      // Trigger on the input itself
      ['focus', 'beforeinput', 'input', 'keyup', 'keydown', 'change'].forEach(eventType => {
        if (eventType === 'beforeinput' || eventType === 'input') {
          triggerInputEvent(currentMessageInput, eventType);
        } else {
          const event = new Event(eventType, { bubbles: true, cancelable: true });
          currentMessageInput.dispatchEvent(event);
        }
      });
      
      // Trigger on parent containers
      const scrollableContainer = currentMessageInput.closest('.msg-form__msg-content-container--scrollable');
      if (scrollableContainer) {
        triggerInputEvent(scrollableContainer, 'input');
      }
      
      const parentContainer = currentMessageInput.closest('.msg-form__msg-content-container');
      if (parentContainer) {
        ['input', 'change'].forEach(eventType => {
          triggerInputEvent(parentContainer, eventType);
        });
      }
      
      // Trigger on the form
      const form = currentMessageInput.closest('form');
      if (form) {
        ['input', 'change'].forEach(eventType => {
          triggerInputEvent(form, eventType);
        });
        
        // Also try to find and trigger the submit button's state
        const sendButton = form.querySelector('.msg-form__send-button, [type="submit"]');
        if (sendButton) {
          sendButton.disabled = false;
        }
      }
      
      // Trigger a window-level event (some frameworks listen here)
      window.dispatchEvent(new Event('input', { bubbles: true }));
      document.dispatchEvent(new Event('input', { bubbles: true }));
      
    } else {
      console.warn('[LinkedIn Comment Assistant] Unknown message input type, trying textContent');
      currentMessageInput.textContent = text;
    }

    // Place cursor at the end of the text
    setTimeout(() => {
      currentMessageInput.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(currentMessageInput);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('[LinkedIn Comment Assistant] Message reply inserted successfully');
    }, 100);

    // Close suggestion panel
    cleanupSuggestionPanel();
  }

  // Create a comment card
  function createCommentCard(comment, index) {
    const card = document.createElement('div');
    card.style.cssText = `
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      position: relative;
    `;

    const text = document.createElement('div');
    text.textContent = comment.text;
    text.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      margin-bottom: 10px;
      white-space: pre-wrap;
    `;

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    `;

    const useBtn = document.createElement('button');
    useBtn.textContent = 'Use This';
    useBtn.style.cssText = `
      background: #0a66c2;
      color: white;
      border: none;
      border-radius: 16px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    `;
    addTrackedListener(useBtn, 'click', () => insertComment(comment.text));

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy';
    copyBtn.style.cssText = `
      background: white;
      border: 1px solid #ccc;
      border-radius: 16px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      color: #666;
    `;
    addTrackedListener(copyBtn, 'click', () => {
      navigator.clipboard.writeText(comment.text);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy';
      }, 2000);
    });

    actions.appendChild(useBtn);
    actions.appendChild(copyBtn);
    card.appendChild(text);
    card.appendChild(actions);

    return card;
  }

  // Insert comment into LinkedIn comment box
  function insertComment(text) {
    console.log('[LinkedIn Comment Assistant] Inserting comment:', text.substring(0, 50) + '...');
    
    if (!currentCommentBox) {
      console.error('[LinkedIn Comment Assistant] No currentCommentBox available');
      return;
    }

    console.log('[LinkedIn Comment Assistant] Comment box type:', currentCommentBox.tagName, 'contenteditable:', currentCommentBox.getAttribute('contenteditable'));

    // Different LinkedIn comment boxes have different structures
    if (currentCommentBox.tagName === 'TEXTAREA') {
      console.log('[LinkedIn Comment Assistant] Using TEXTAREA method');
      currentCommentBox.value = text;
      currentCommentBox.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (currentCommentBox.getAttribute('contenteditable') === 'true') {
      console.log('[LinkedIn Comment Assistant] Using contenteditable method');
      currentCommentBox.innerHTML = text.replace(/\n/g, '<br>');
      currentCommentBox.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      console.warn('[LinkedIn Comment Assistant] Unknown comment box type, trying textContent');
      currentCommentBox.textContent = text;
    }

    // Focus the comment box
    currentCommentBox.focus();
    console.log('[LinkedIn Comment Assistant] Comment inserted successfully');

    // Close suggestion panel
    cleanupSuggestionPanel();
  }

  // Show error in panel
  function showErrorInPanel(message) {
    if (!suggestionPanel) return;

    suggestionPanel.innerHTML = `
      <div style="padding: 16px; color: #d32f2f; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
        <div style="font-weight: 600; margin-bottom: 8px;">Error</div>
        <div style="font-size: 14px; margin-bottom: 16px;">${message}</div>
         <button onclick="window.open(chrome.runtime.getURL('sidepanel/sidepanel.html'), '_blank')" 
                 style="background: #0a66c2; color: white; border: none; padding: 8px 16px; border-radius: 16px; cursor: pointer;">
           Open Sidepanel
         </button>
      </div>
    `;
  }

  // Show error message
  function showError(container, message) {
    const loading = container.querySelector('.comment-assistant-loading');
    if (loading) loading.remove();

    const error = document.createElement('div');
    error.textContent = message;
    error.style.cssText = `
      color: #d32f2f;
      padding: 12px;
      font-size: 14px;
    `;
    container.appendChild(error);

    setTimeout(() => error.remove(), CONFIG.TIMEOUTS.ERROR_DISPLAY);
  }

  // Start
  init();
})();
