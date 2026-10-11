// content.js - Se inyecta en las páginas de TikTok

// Escuchar mensajes desde el popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCAN_REPOSTS") {
    scanForReposts()
      .then((videos) => sendResponse({ success: true, videos: videos }))
      .catch((err) => sendResponse({ success: false, error: err }));
    return true;
  }

  if (request.action === "DELETE_REPOST") {
    deleteRepost(request.index)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err }));
    return true; // Indica respuesta asíncrona
  }
});

// Función para escanear la página y encontrar solo los videos del bloque activo de compartidos
async function scanForReposts() {
  const maxScrolls = 8;
  const uniqueVideos = new Map();

  for (let step = 0; step <= maxScrolls; step++) {
    const candidateLinks = getCandidateVideoLinks();

    candidateLinks.forEach(link => {
      if (!isVisibleElement(link)) return;

      const urlMatch = link.href.match(/tiktok\.com\/@[^/]+\/video\/\d+/);
      if (!urlMatch) return;

      const cleanUrl = urlMatch[0];
      if (!uniqueVideos.has(cleanUrl)) {
        uniqueVideos.set(cleanUrl, link);
      }
    });

    if (step < maxScrolls) {
      const scrollTarget = Math.min(document.body.scrollHeight, window.scrollY + window.innerHeight * 1.5);
      window.scrollTo({ top: scrollTarget, behavior: 'auto' });
      await sleep(900);
    }
  }

  const videos = [];
  let i = 0;

  uniqueVideos.forEach((linkElement) => {
    linkElement.setAttribute('data-repost-cleaner-id', i);
    videos.push({
      index: i,
      found: true
    });
    i++;
  });

  return videos;
}

function getCandidateVideoLinks() {
  const scopeRoot = findSharedSectionScope();
  if (scopeRoot) {
    return [...scopeRoot.querySelectorAll('a[href*="/video/"]')];
  }

  return [...document.querySelectorAll('a[href*="/video/"]')];
}

function findSharedSectionScope() {
  const tabTexts = ['compartidos', 'reposts', 'shared'];
  const possibleTabs = [...document.querySelectorAll('button, [role="tab"], a, div, span')].filter((el) => {
    const text = (el.innerText || el.textContent || '').trim().toLowerCase();
    return tabTexts.some((keyword) => text.includes(keyword));
  });

  for (const tab of possibleTabs) {
    const isActive =
      tab.getAttribute('aria-selected') === 'true' ||
      tab.getAttribute('data-selected') === 'true' ||
      tab.classList.contains('active') ||
      tab.classList.contains('is-active');

    if (!isActive) continue;

    const scope = tab.closest('[role="tablist"], section, main, div') || tab.parentElement || document.body;
    if (scope && scope.querySelector('a[href*="/video/"]')) {
      return scope;
    }
  }

  return null;
}

function isVisibleElement(element) {
  if (!element || !document.body.contains(element)) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }

  return element.offsetParent !== null || element.getClientRects().length > 0;
}

// Función para simular el click y eliminar el repost
async function deleteRepost(index) {
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const videoCard = document.querySelector(`[data-repost-cleaner-id="${index}"]`);
      if (!videoCard) {
        return false;
      }

      if (typeof videoCard.click === 'function') {
        videoCard.click();
      } else {
        videoCard.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
      }

      await sleep(2200 + attempt * 600);

      const shareButton = await retryUntilFound(findShareButton, 5, 500);
      if (!shareButton) {
        lastError = new Error('Share button not found');
        await tryCloseVideo();
        continue;
      }

      clickElement(shareButton);
      await sleep(1200 + attempt * 400);

      const removeButton = await retryUntilFound(findRemoveRepostButton, 6, 600);
      if (!removeButton) {
        lastError = new Error('Remove repost button not found');
        await tryCloseVideo();
        continue;
      }

      clickElement(removeButton);
      await sleep(1800 + attempt * 400);

      const didRemove = await verifyRemoveAction();
      if (didRemove) {
        await tryCloseVideo();
        return true;
      }

      await tryCloseVideo();
    } catch (e) {
      lastError = e;
      await tryCloseVideo();
    }
  }

  console.error('No se pudo eliminar el repost:', lastError);
  return false;
}

async function retryUntilFound(findFn, maxRetries, delayMs) {
  for (let i = 0; i < maxRetries; i++) {
    const result = findFn();
    if (result) return result;
    await sleep(delayMs);
  }
  return null;
}

async function verifyRemoveAction() {
  const currentUrl = window.location.href;
  if (currentUrl.includes('/video/')) {
    const closeButton = findCloseButton();
    if (closeButton) {
      return true;
    }
  }

  const currentSelection = document.querySelectorAll('a[href*="/video/"]');
  if (currentSelection.length > 0) {
    const ids = [...currentSelection].map(el => el.href).filter(href => /tiktok\.com\/.*\/video\/\d+/.test(href));
    return ids.length === 0 || ids.some(url => !url.includes('repost-cleaner-id'));
  }

  return true;
}

function findShareButton() {
  const selectors = [
    'button[data-e2e="share-icon"]',
    'button[aria-label*="Share"]',
    'button[aria-label*="Compartir"]',
    '[data-e2e="share-icon"]',
    'button[title*="Share"]',
    'button[title*="Compartir"]',
    '[class*="ShareGroup"] button',
    '[class*="ActionItemContainer"] button'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && isVisibleElement(el)) {
      return el;
    }
  }

  const allButtons = [...document.querySelectorAll('button, [role="button"], span, div')];
  for (const el of allButtons) {
    const label = normalizeText(el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('title'));
    if (label.includes('share') || label.includes('compartir')) {
      return el.closest('button, [role="button"]') || el;
    }
  }

  return null;
}

function findRemoveRepostButton() {
  const selectorList = [
    'button', 'a', 'li', 'div[role="button"]', 'span'
  ];

  const allCandidates = [...document.querySelectorAll(selectorList.join(', '))];

  for (const el of allCandidates) {
    const text = normalizeText(
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.innerText ||
      el.textContent || ''
    );

    if (!text) continue;

    const matched = [
      'eliminar republicación',
      'deshacer republicación',
      'quitar republicación',
      'eliminar repost',
      'quitar repost',
      'remove repost',
      'undo repost',
      'delete repost',
      'remove share',
      'delete share'
    ].some(keyword => text.includes(keyword));

    if (matched) {
      return el.closest('button, a, li, [role="button"]') || el;
    }
  }

  return null;
}

function findCloseButton() {
  const selectors = [
    'button[data-e2e="browse-close"]',
    'button[aria-label*="Close"]',
    'button[aria-label*="Cerrar"]',
    '[class*="CloseIcon"]',
    '[class*="close"] button'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && isVisibleElement(el)) {
      return el.closest('button') || el;
    }
  }

  return null;
}

async function tryCloseVideo() {
  const closeButton = findCloseButton();
  if (closeButton) {
    clickElement(closeButton);
    await sleep(1500);
    return true;
  }

  if (window.location.href.includes('/video/')) {
    window.history.back();
    await sleep(1800);
    return true;
  }

  return false;
}

function clickElement(element) {
  if (!element) return;

  if (typeof element.click === 'function') {
    element.click();
    return;
  }

  element.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
}

function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase();
}

// Utilidad para esperar (pausas humanas)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
