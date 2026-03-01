# LinkedIn Post DOM Selectors Reference

This file contains CSS selectors and patterns for extracting data from LinkedIn feed posts.

## Post Container

```javascript
// Main post wrapper
const postContainer = document.querySelector('.feed-shared-update-v2');

// Post ID (from data attribute)
const postId = postContainer?.getAttribute('data-urn');
// Format: urn:li:activity:XXXXXXXXXXXXXXXXXXX

// Alternative: Find all posts on page
const allPosts = document.querySelectorAll('.feed-shared-update-v2');
```

## Author Information

```javascript
// Author Name
const authorName = post.querySelector('.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]')?.textContent;

// Author Headline/Title
const authorTitle = post.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.textContent;

// Author Profile Link
const authorLink = post.querySelector('.update-components-actor__image')?.getAttribute('href');

// Author Profile Image
const authorImage = post.querySelector('.update-components-actor__avatar-image')?.getAttribute('src');

// Connection Degree (1st, 2nd, 3rd)
const connectionDegree = post.querySelector('.update-components-actor__supplementary-actor-info span[aria-hidden="true"]')?.textContent;
// Output: " • 2nd" or " • 1st"

// Premium Badge (check if exists)
const hasPremium = post.querySelector('.text-view-model__linkedin-bug-premium-v2') !== null;

// Verified Badge (check if exists)
const isVerified = post.querySelector('.text-view-model__verified-icon') !== null;

// Follow Button (for posts from non-connections)
const followButton = post.querySelector('.update-components-actor__follow-button');
const isFollowing = followButton?.getAttribute('aria-pressed') === 'true';

// Connect Button (for posts from 2nd/3rd connections)
const connectButton = post.querySelector('.update-components-actor__connect-button');
```

## Social Proof Header

Posts often show who interacted with them:

```javascript
// Header container (shows who liked/commented/reacted)
const socialProofHeader = post.querySelector('.update-components-header');

// Text indicating social action (e.g., "Vishal Makwana likes this")
const socialProofText = post.querySelector('.update-components-header__text-view')?.textContent;

// Check for specific social proof types
const isLikedBySomeone = socialProofText?.includes('likes this');
const isCommentedOnBySomeone = socialProofText?.includes('commented on this');
const isReactedToBySomeone = socialProofText?.includes('reacted to this');

// Single avatar in header (who interacted)
const socialProofAvatar = post.querySelector('.update-components-header__image img');

// Multiple avatars (stack) when multiple people reacted
const multipleAvatars = post.querySelectorAll('.ivm-image-view-model__img-list--size-4 .ivm-image-view-model__circle-img');
// These are small circular avatars (24x24) stacked together

// Social proof profile link
const socialProofProfileLink = post.querySelector('.update-components-header a[data-test-app-aware-link]')?.getAttribute('href');
```

## Post Content

```javascript
// Post Text Content
const postText = post.querySelector('.update-components-text .break-words')?.textContent;

// Alternative: Get full text including HTML
const postTextElement = post.querySelector('.update-components-text .break-words');
const postTextHTML = postTextElement?.innerHTML;

// Check if text is truncated (has "...more" button)
const hasMoreButton = post.querySelector('.feed-shared-inline-show-more-text__see-more-less-toggle') !== null;
const isTruncated = hasMoreButton && post.querySelector('.see-more') !== null;

// Click "See more" to expand text
const seeMoreButton = post.querySelector('.feed-shared-inline-show-more-text__see-more-less-toggle');
if (seeMoreButton) seeMoreButton.click();

// Extract hashtags (if needed)
const hashtags = postText?.match(/#[\w]+/g) || [];
```

## Post Metadata

```javascript
// Post Timestamp
const timestamp = post.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.textContent;
// Output: "4d •" or "1w •" or "7h • Edited •"

// Check if post was edited
const isEdited = timestamp?.includes('Edited');

// Visibility (globe icon indicates public)
const isPublic = post.querySelector('li-icon[type="globe-americas"]') !== null;

// Suggested Post Indicator
const isSuggested = post.querySelector('.update-components-header__text-view')?.textContent?.includes('Suggested');

// Post type indicators
const hasSocialProof = post.querySelector('.update-components-header') !== null;
const isJobPost = post.querySelector('.update-components-entity') !== null;
const hasArticle = post.querySelector('.update-components-article') !== null;
```

## Engagement Metrics

```javascript
// Reactions Count
const reactionsText = post.querySelector('.social-details-social-counts__reactions-count')?.textContent?.trim();
const reactionsCount = parseInt(reactionsText) || 0;

// Reaction Types (visible reaction icons)
const reactionIcons = post.querySelectorAll('.reactions-icon');
const reactionTypes = Array.from(reactionIcons).map(icon => icon.getAttribute('data-test-reactions-icon-type'));
// Types: LIKE, EMPATHY (love), INTEREST (insightful), PRAISE (celebrate), etc.

// Comments Count
const commentsText = post.querySelector('.social-details-social-counts__comments button span[aria-hidden="true"]')?.textContent;
const commentsMatch = commentsText?.match(/(\d+)\s*comment/);
const commentsCount = commentsMatch ? parseInt(commentsMatch[1]) : 0;

// Alternative: Get comments from aria-label
const commentsAriaLabel = post.querySelector('.social-details-social-counts__comments button')?.getAttribute('aria-label');
// Output: "4 comments on Silky Bansal's post"

// Reposts Count
const repostsText = post.querySelector('[aria-label*="reposts"]')?.textContent;
const repostsMatch = repostsText?.match(/(\d+)\s*repost/);
const repostsCount = repostsMatch ? parseInt(repostsMatch[1]) : 0;

// Social Proof Text for Reactions (e.g., "Vishal Makwana and 87 others")
const socialProofReactionText = post.querySelector('.social-details-social-counts__social-proof-text')?.textContent;

// Alternative: Get reaction count from fallback number
const reactionCountFallback = post.querySelector('[data-social-proof-fallback]')?.textContent;
```

## Action Buttons

```javascript
// Like Button
const likeButton = post.querySelector('.react-button__trigger');
const isLiked = likeButton?.getAttribute('aria-pressed') === 'true';

// Comment Button
const commentButton = post.querySelector('.comment-button');

// Repost Button
const repostButton = post.querySelector('.social-reshare-button');

// Send Message Button
const sendButton = post.querySelector('.send-privately-button');

// Control Menu (three dots)
const controlMenu = post.querySelector('.feed-shared-control-menu__trigger');

// Hide/Dismiss Post Button
const hideButton = post.querySelector('.feed-shared-control-menu__hide-post-button');
```

## Comment Box Structure (ref3.md Analysis)

When the comment button is clicked, a comment box appears within the post:

```javascript
// Comment container wrapper
const commentsContainer = post.querySelector('.feed-shared-update-v2__comments-container');

// Comment input box (main wrapper)
const commentBox = post.querySelector('.comments-comment-box--cr');

// Check if comment box is visible
const isCommentBoxOpen = post.querySelector('.comments-comment-box--cr') !== null;
```

### Comment Text Editor

```javascript
// Quill-based rich text editor container
const editorContainer = post.querySelector('.editor-container');

// Actual text input area (contenteditable div)
const textEditor = post.querySelector('.ql-editor[contenteditable="true"]');

// Get current text content
const currentText = textEditor?.textContent;

// Check if editor is empty
const isEmpty = textEditor?.classList.contains('ql-blank');

// Editor placeholder text
const placeholder = textEditor?.getAttribute('data-placeholder');
// Output: "Add a comment…"

// Set text in editor
function setCommentText(postElement, text) {
  const editor = postElement.querySelector('.ql-editor[contenteditable="true"]');
  if (editor) {
    editor.innerHTML = `<p>${text}</p>`;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  return false;
}

// Get text from editor
function getCommentText(postElement) {
  const editor = postElement.querySelector('.ql-editor[contenteditable="true"]');
  return editor?.textContent?.trim();
}

// Clear editor
function clearCommentText(postElement) {
  const editor = postElement.querySelector('.ql-editor[contenteditable="true"]');
  if (editor) {
    editor.innerHTML = '<p><br></p>';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
```

### Comment Author Avatar

```javascript
// Current user's avatar in comment box
const commentAvatar = post.querySelector('.comments-comment-box__avatar-image--cr img');
const avatarSrc = commentAvatar?.getAttribute('src');
const avatarAlt = commentAvatar?.getAttribute('alt');
```

### Comment Actions

```javascript
// Emoji picker button
const emojiButton = post.querySelector('.comments-comment-box__emoji-picker-trigger');

// Add photo button
const photoButton = post.querySelector('.comments-comment-box__detour-icons[aria-label="Add a photo"]');

// Comment form element
const commentForm = post.querySelector('.comments-comment-box__form');

// Submit comment (look for submit button or press Enter)
// Note: Submit button may not exist until text is entered
function submitComment(postElement) {
  const editor = postElement.querySelector('.ql-editor[contenteditable="true"]');
  if (editor) {
    // Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    editor.dispatchEvent(enterEvent);
    return true;
  }
  return false;
}
```

### Comments List

```javascript
// Comments list container
const commentsList = post.querySelector('.comments-comments-list');

// Individual comment items
const commentItems = post.querySelectorAll('.comments-comment-list__container > div');

// Check if comments are loaded
const areCommentsLoaded = post.querySelector('.comments-comments-list') !== null;
```

### Complete Comment Function

```javascript
// Full function to add a comment to a post
async function addCommentToPost(postElement, commentText) {
  // Step 1: Click comment button to open comment box
  const commentBtn = postElement.querySelector('.comment-button');
  if (!commentBtn) return { success: false, error: 'Comment button not found' };
  
  commentBtn.click();
  
  // Step 2: Wait for comment editor to appear
  const editor = await new Promise(resolve => {
    let attempts = 0;
    const interval = setInterval(() => {
      const ed = postElement.querySelector('.ql-editor[contenteditable="true"]');
      if (ed) {
        clearInterval(interval);
        resolve(ed);
      }
      attempts++;
      if (attempts > 30) { // 3 second timeout
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
  
  if (!editor) return { success: false, error: 'Comment editor did not appear' };
  
  // Step 3: Enter text
  editor.focus();
  editor.innerHTML = `<p>${commentText}</p>`;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Step 4: Submit comment (simulating Enter key)
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const submitEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    ctrlKey: false,
    bubbles: true,
    cancelable: true
  });
  editor.dispatchEvent(submitEvent);
  
  return { success: true };
}
```

## Media Content

```javascript
// Check for images
const hasImages = post.querySelector('.update-components-image') !== null;

// Image Grid (multiple images)
const imageGrid = post.querySelector('.update-components-image--smart-grid');

// All Images in Post
const images = post.querySelectorAll('.update-components-image__image');
const imageUrls = Array.from(images).map(img => ({
  src: img.getAttribute('src'),
  alt: img.getAttribute('alt'),
  width: img.getAttribute('width'),
  height: img.getAttribute('height')
}));

// Excess Image Count (e.g., "+6")
const excessCount = post.querySelector('.update-components-image__excess-image-count-text')?.textContent;

// Check for video
const hasVideo = post.querySelector('.update-components-video') !== null;

// Check for shared link/article
const hasSharedLink = post.querySelector('.feed-shared-article') !== null ||
                      post.querySelector('.feed-shared-link') !== null;

// Check for single image (vs image grid)
const isSingleImage = post.querySelector('.update-components-image--single-image') !== null;
const isImageGrid = post.querySelector('.update-components-image--smart-grid') !== null;
```

## Shared Articles/Links

```javascript
// Article container
const articleContainer = post.querySelector('.update-components-article');

// Article image
const articleImage = post.querySelector('.update-components-article__image')?.getAttribute('src');

// Article title
const articleTitle = post.querySelector('.update-components-article__title')?.textContent;

// Article subtitle/source (e.g., "bundestag.de")
const articleSource = post.querySelector('.update-components-article__subtitle')?.textContent;

// Article link URL
const articleLink = post.querySelector('.update-components-article__link-container a')?.getAttribute('href');

// Check if article has rounded corners style
const hasRoundedCorners = post.querySelector('.update-components-article__image--rounded-corners') !== null;
```

## Job Postings

```javascript
// Job entity container
const jobContainer = post.querySelector('.update-components-entity');

// Job title
const jobTitle = post.querySelector('.update-components-entity__title')?.textContent;

// Job has verified badge
const jobHasVerifiedBadge = post.querySelector('.update-components-entity__title .text-view-model__verified-icon') !== null;

// Company name
const companyName = post.querySelector('.update-components-entity__subtitle')?.textContent;
// Output: "Job by DP World"

// Job location
const jobLocation = post.querySelector('.update-components-entity__description')?.textContent;
// Output: "Bengaluru, Karnataka, India (On-site)"

// Company logo
const companyLogo = post.querySelector('.update-components-entity__image-container img')?.getAttribute('src');

// Job link URL
const jobLink = post.querySelector('.update-components-entity__content')?.getAttribute('href');

// "View job" button
const viewJobButton = post.querySelector('.update-components-entity__cta-button');
```

## Utility Functions

```javascript
// Extract post data object
function extractPostData(postElement) {
  return {
    id: postElement.getAttribute('data-urn'),
    author: {
      name: postElement.querySelector('.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]')?.textContent?.trim(),
      title: postElement.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.textContent?.trim(),
      profileUrl: postElement.querySelector('.update-components-actor__image')?.getAttribute('href'),
      imageUrl: postElement.querySelector('.update-components-actor__avatar-image')?.getAttribute('src'),
      isPremium: postElement.querySelector('.text-view-model__linkedin-bug-premium-v2') !== null,
      isVerified: postElement.querySelector('.text-view-model__verified-icon') !== null,
      connectionDegree: postElement.querySelector('.update-components-actor__supplementary-actor-info span[aria-hidden="true"]')?.textContent?.match(/•\s*(\w+)/)?.[1]
    },
    content: {
      text: postElement.querySelector('.update-components-text .break-words')?.textContent?.trim(),
      isTruncated: postElement.querySelector('.feed-shared-inline-show-more-text__see-more-less-toggle') !== null,
      hashtags: postElement.querySelector('.update-components-text .break-words')?.textContent?.match(/#[\w]+/g) || []
    },
    engagement: {
      reactions: parseInt(postElement.querySelector('.social-details-social-counts__reactions-count')?.textContent?.trim()) ||
                 parseInt(postElement.querySelector('[data-social-proof-fallback]')?.textContent) || 0,
      comments: parseInt(postElement.querySelector('.social-details-social-counts__comments button span[aria-hidden="true"]')?.textContent?.match(/(\d+)/)?.[0]) || 0,
      reposts: parseInt(postElement.querySelector('[aria-label*="reposts"] span[aria-hidden="true"]')?.textContent) || 0,
      reactionTypes: Array.from(postElement.querySelectorAll('.reactions-icon')).map(icon => icon.getAttribute('data-test-reactions-icon-type')),
      socialProof: postElement.querySelector('.social-details-social-counts__social-proof-text')?.textContent
    },
    metadata: {
      timestamp: postElement.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.textContent?.split('•')[0]?.trim(),
      isPublic: postElement.querySelector('li-icon[type="globe-americas"]') !== null,
      isEdited: postElement.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.textContent?.includes('Edited'),
      isSuggested: postElement.querySelector('.update-components-header__text-view')?.textContent?.includes('Suggested'),
      hasSocialProof: postElement.querySelector('.update-components-header') !== null,
      socialProofText: postElement.querySelector('.update-components-header__text-view')?.textContent,
      postType: postElement.querySelector('.update-components-entity') ? 'job' :
                postElement.querySelector('.update-components-article') ? 'article' :
                postElement.querySelector('.update-components-image') ? 'image' : 'text'
    },
    media: {
      hasImages: postElement.querySelector('.update-components-image') !== null,
      imageCount: postElement.querySelectorAll('.update-components-image__image').length,
      imageUrls: Array.from(postElement.querySelectorAll('.update-components-image__image')).map(img => img.getAttribute('src')),
      isSingleImage: postElement.querySelector('.update-components-image--single-image') !== null,
      isImageGrid: postElement.querySelector('.update-components-image--smart-grid') !== null
    },
    article: postElement.querySelector('.update-components-article') ? {
      title: postElement.querySelector('.update-components-article__title')?.textContent,
      source: postElement.querySelector('.update-components-article__subtitle')?.textContent,
      imageUrl: postElement.querySelector('.update-components-article__image')?.getAttribute('src'),
      link: postElement.querySelector('.update-components-article__link-container a')?.getAttribute('href')
    } : null,
    job: postElement.querySelector('.update-components-entity') ? {
      title: postElement.querySelector('.update-components-entity__title')?.textContent,
      company: postElement.querySelector('.update-components-entity__subtitle')?.textContent?.replace('Job by ', ''),
      location: postElement.querySelector('.update-components-entity__description')?.textContent,
      companyLogo: postElement.querySelector('.update-components-entity__image-container img')?.getAttribute('src'),
      link: postElement.querySelector('.update-components-entity__content')?.getAttribute('href'),
      hasVerifiedBadge: postElement.querySelector('.update-components-entity__title .text-view-model__verified-icon') !== null
    } : null
  };
}

// Get all posts on current feed
function getAllPosts() {
  return Array.from(document.querySelectorAll('.feed-shared-update-v2')).map(extractPostData);
}

// Find post by author name
function findPostsByAuthor(authorName) {
  const posts = document.querySelectorAll('.feed-shared-update-v2');
  return Array.from(posts).filter(post => {
    const name = post.querySelector('.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]')?.textContent?.toLowerCase();
    return name?.includes(authorName.toLowerCase());
  });
}

// Click comment button to open comment box
function openCommentBox(postElement) {
  const commentBtn = postElement.querySelector('.comment-button');
  if (commentBtn) {
    commentBtn.click();
    // Wait for Quill editor to appear (not standard input)
    return new Promise(resolve => {
      const checkForInput = setInterval(() => {
        const editor = postElement.querySelector('.ql-editor[contenteditable="true"]');
        if (editor) {
          clearInterval(checkForInput);
          resolve(editor);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkForInput);
        resolve(null);
      }, 3000);
    });
  }
  return null;
}

// Like a post
function likePost(postElement) {
  const likeBtn = postElement.querySelector('.react-button__trigger');
  if (likeBtn && likeBtn.getAttribute('aria-pressed') !== 'true') {
    likeBtn.click();
    return true;
  }
  return false; // Already liked or button not found
}

// Unlike a post
function unlikePost(postElement) {
  const likeBtn = postElement.querySelector('.react-button__trigger');
  if (likeBtn && likeBtn.getAttribute('aria-pressed') === 'true') {
    likeBtn.click();
    return true;
  }
  return false; // Not liked or button not found
}
```

## Important Notes

1. **Dynamic IDs**: All `emberXXXX` IDs are dynamically generated and change on page reload. Always use stable class names instead.

2. **Lazy Loading**: Images load lazily. To ensure all images are loaded, scroll through the feed first.

3. **Truncated Text**: Use the "See more" button to expand full text before extracting content.

4. **Comment Editor**: LinkedIn uses a Quill-based rich text editor (`.ql-editor`). The editor is a `contenteditable` div, not a standard input field. Use `.innerHTML` to set content and trigger the 'input' event.

5. **Connection Types**:
   - 1st = Direct connection
   - 2nd = Friend of friend
   - 3rd = Extended network

5. **Badges**:
   - Premium = Gold LinkedIn logo
   - Verified = Blue checkmark

6. **Visibility Icons**:
   - Globe = Public (anyone on/off LinkedIn)
   - Building = Company
   - Lock = Connections only
   - User = Custom

7. **Reactions** (in order of priority):
   - LIKE (thumbs up)
   - EMPATHY (heart/love)
   - INTEREST (lightbulb/insightful)
   - PRAISE (hands/celebrate)
   - APPRECIATION (handshake/support)
   - FUNNY (laughing)

8. **Post Types**:
   - **Text**: Standard post with just text
   - **Image**: Post with single or multiple images
   - **Article**: Shared link/article preview card
   - **Job**: Job posting with company info and location

9. **Social Proof Headers**: Posts may show who interacted with them:
    - "X likes this"
    - "X commented on this"
    - "X and Y reacted to this"
    - Multiple avatars may appear when multiple people reacted

10. **Follow vs Connect Buttons**:
    - **Follow Button**: Appears on posts from users you don't follow yet (non-connections)
    - **Connect Button**: Appears on posts from 2nd/3rd degree connections to send a connection request

11. **Edited Posts**: Posts that have been edited show "Edited •" in the timestamp

12. **Reaction Count Display**: Sometimes reactions show as "X and Y others" instead of just numbers. Check `.social-details-social-counts__social-proof-text` for this format

## Example Usage

```javascript
// Wait for feed to load
setTimeout(() => {
  const posts = getAllPosts();
  console.log(`Found ${posts.length} posts`);
  
  posts.forEach((post, index) => {
    console.log(`\n--- Post ${index + 1} [${post.metadata.postType}] ---`);
    console.log(`Author: ${post.author.name} ${post.author.isVerified ? '✓' : ''} ${post.author.isPremium ? '⭐' : ''}`);
    console.log(`Title: ${post.author.title}`);
    console.log(`Text: ${post.content.text?.substring(0, 100)}...`);
    console.log(`Reactions: ${post.engagement.reactions} ${post.engagement.socialProof || ''}`);
    console.log(`Comments: ${post.engagement.comments} | Reposts: ${post.engagement.reposts}`);
    console.log(`Type: ${post.metadata.isSingleImage ? 'Single Image' : post.media.isImageGrid ? 'Image Grid' : 'No Images'}`);
    
    if (post.job) {
      console.log(`Job: ${post.job.title} at ${post.job.company} (${post.job.location})`);
    }
    
    if (post.article) {
      console.log(`Article: ${post.article.title} (${post.article.source})`);
    }
    
    if (post.metadata.socialProofText) {
      console.log(`Social Proof: ${post.metadata.socialProofText}`);
    }
  });
}, 2000);
```

## Chrome Extension Integration

```javascript
// content.js - Inject this into LinkedIn pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPosts') {
    const posts = getAllPosts();
    sendResponse({ posts });
  }
  
  if (request.action === 'likePost') {
    const posts = document.querySelectorAll('.feed-shared-update-v2');
    if (posts[request.index]) {
      const result = likePost(posts[request.index]);
      sendResponse({ success: result });
    }
  }
  
  if (request.action === 'comment') {
    const posts = document.querySelectorAll('.feed-shared-update-v2');
    if (posts[request.index]) {
      const post = posts[request.index];
      openCommentBox(post).then(editor => {
        if (editor) {
          // Use Quill editor (contenteditable div)
          editor.innerHTML = `<p>${request.text}</p>`;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Submit via Enter key (no submit button exists)
          setTimeout(() => {
            const submitEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true,
              cancelable: true
            });
            editor.dispatchEvent(submitEvent);
            sendResponse({ success: true });
          }, 200);
        } else {
          sendResponse({ success: false, error: 'Comment editor not found' });
        }
      });
      return true; // Keep channel open for async
    }
  }
});
```

---

**Last Updated**: Based on LinkedIn DOM structure as of the reference files date.
