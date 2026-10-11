// content.js - Inyectado en TikTok

// Inyectar estilos directamente en el DOM para asegurar que siempre estén activos
function injectStyles() {
  if (document.getElementById('repost-cleaner-injected-style')) return;
  const style = document.createElement('style');
  style.id = 'repost-cleaner-injected-style';
  style.textContent = `
    .repost-cleaner-selected {
      outline: 4px solid #ff0050 !important;
      outline-offset: -4px !important;
      box-shadow: 0 0 22px rgba(255, 0, 80, 0.9) !important;
      border-radius: 8px !important;
      filter: brightness(0.9) !important;
      transition: all 0.2s ease !important;
    }

    .repost-cleaner-badge {
      position: absolute !important;
      top: 10px !important;
      left: 10px !important;
      z-index: 999999 !important;
      width: 28px !important;
      height: 28px !important;
      background-color: rgba(0, 0, 0, 0.75) !important;
      border: 2px solid #ffffff !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.7) !important;
      pointer-events: auto !important;
    }

    .repost-cleaner-badge:hover {
      transform: scale(1.15) !important;
      border-color: #ff0050 !important;
    }

    .repost-cleaner-badge.checked {
      background-color: #ff0050 !important;
      border-color: #ffffff !important;
    }

    .repost-cleaner-badge.checked::after {
      content: '✓' !important;
      color: #ffffff !important;
      font-size: 16px !important;
      font-weight: 900 !important;
      line-height: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

injectStyles();

let selectedUrls = new Set();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  injectStyles();

  if (request.action === "SCAN_REPOSTS") {
    const videos = scanForReposts();
    sendResponse({ success: true, videos: videos });
    return true;
  }

  if (request.action === "SET_VIDEO_SELECTED") {
    toggleSelect(request.url, request.selected);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "SET_ALL_SELECTED") {
    setAllSelected(request.selected);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "DELETE_REPOST") {
    deleteRepost(request.url)
      .then((ok) => {
        if (ok) selectedUrls.delete(request.url);
        sendResponse({ success: ok, error: ok ? undefined : 'TikTok no confirmó que se quitara la publicación compartida.' });
      })
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true; 
  }
});

function isVisibleElement(el) {
  if (!el || !document.contains(el)) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
}

// Encuentra la tarjeta contenedora real del video en el grid de TikTok
function getCardElement(linkEl) {
  let el = linkEl;
  while (el && el !== document.body) {
    if (el.tagName === 'DIV' && el.clientHeight > 100 && el.clientWidth > 80) {
      return el;
    }
    el = el.parentElement;
  }
  return linkEl.parentElement || linkEl;
}

function normalizeText(text) {
  return text ? text.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

function findByText(keywords) {
  const nodes = document.querySelectorAll('button, [role="button"], [role="menuitem"], li, a, span, [title], [aria-label]');
  for (const el of nodes) {
    if (!isVisibleElement(el)) continue;
    const labels = [el.getAttribute('aria-label'), el.getAttribute('title'), el.innerText, el.textContent]
      .map(normalizeText)
      .filter(label => label && label.length < 80);
    if (labels.some(label => keywords.some(keyword => label.includes(normalizeText(keyword))))) {
      return findClickableAncestor(el);
    }
  }
  return null;
}

function findClickableAncestor(el) {
  const clickable = el.closest('button, [role="button"], [role="menuitem"], a, li');
  if (clickable) return clickable;

  let ancestor = el;
  for (let depth = 0; ancestor && ancestor !== document.body && depth < 5; depth++, ancestor = ancestor.parentElement) {
    if (window.getComputedStyle(ancestor).cursor === 'pointer') return ancestor;
  }
  return el;
}

function findDirectRemoveRepostButton() {
  return findByText([
    'eliminar la publicacion compartida',
    'quitar la publicacion compartida',
    'eliminar publicacion compartida',
    'remove shared post'
  ]);
}

function findDirectRepostButton() {
  return findByText(['republicar', 'repost']);
}

async function clickAndVerifyDirectRemove(button) {
  button.click();
  await sleep(1200);
  return true;
}

async function isPostRemovedFromGrid(postId) {
  for (let attempt = 0; attempt < 14; attempt++) {
    const matchingLink = [...document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]')]
      .find(link => link.href.match(/\/(?:video|photo)\/(\d+)/)?.[1] === postId);
    if (!matchingLink || !isVisibleElement(matchingLink)) return true;
    await sleep(700);
  }
  return false;
}

function toggleSelect(url, forceState = null) {
  const shouldSelect = forceState !== null ? forceState : !selectedUrls.has(url);
  if (shouldSelect) {
    selectedUrls.add(url);
  } else {
    selectedUrls.delete(url);
  }

  updateVideoVisualState(url, shouldSelect);
}

function setAllSelected(shouldSelect) {
  const postLinks = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
  postLinks.forEach(link => {
    if (!isVisibleElement(link)) return;
    const urlMatch = link.href.match(/https?:\/\/www\.tiktok\.com\/@[^/]+\/(?:video|photo)\/\d+/);
    if (urlMatch) {
      const cleanUrl = urlMatch[0];
      if (shouldSelect) selectedUrls.add(cleanUrl);
      else selectedUrls.delete(cleanUrl);
      updateVideoVisualState(cleanUrl, shouldSelect);
    }
  });
}

function updateVideoVisualState(url, isSelected) {
  const postIdMatch = url.match(/\/(?:video|photo)\/(\d+)/);
  if (!postIdMatch) return;
  const postId = postIdMatch[1];

  const linkEl = document.querySelector(`a[href*="${postId}"]`);
  if (!linkEl) return;

  const card = getCardElement(linkEl);
  if (!card) return;

  if (isSelected) {
    card.classList.add('repost-cleaner-selected');
  } else {
    card.classList.remove('repost-cleaner-selected');
  }

  const badge = card.querySelector('.repost-cleaner-badge');
  if (badge) {
    if (isSelected) {
      badge.classList.add('checked');
    } else {
      badge.classList.remove('checked');
    }
  }
}

function scanForReposts() {
  injectStyles();
  const postLinks = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
  const uniqueVideos = new Map();

  postLinks.forEach(link => {
    if (!isVisibleElement(link)) return;
    const urlMatch = link.href.match(/https?:\/\/www\.tiktok\.com\/@[^/]+\/(?:video|photo)\/\d+/);
    if (urlMatch) {
      const cleanUrl = urlMatch[0];
      if (!uniqueVideos.has(cleanUrl)) {
        uniqueVideos.set(cleanUrl, link);
      }
    }
  });
  
  const videos = [];
  uniqueVideos.forEach((linkEl, url) => {
    const card = getCardElement(linkEl);
    
    // Asegurar que la tarjeta tenga position relative para ubicar la casilla
    const computedPos = window.getComputedStyle(card).position;
    if (computedPos === 'static') {
      card.style.position = 'relative';
    }

    // Insertar casilla circular flotante si no existe
    let badge = card.querySelector('.repost-cleaner-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'repost-cleaner-badge';
      badge.title = 'Marcar para eliminar';

      // Capturar clic antes de que TikTok abra el video
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleSelect(url);
      }, true);

      card.appendChild(badge);
    }

    const isSelected = selectedUrls.has(url);
    if (isSelected) {
      badge.classList.add('checked');
      card.classList.add('repost-cleaner-selected');
    } else {
      badge.classList.remove('checked');
      card.classList.remove('repost-cleaner-selected');
    }

    let title = linkEl.getAttribute('title') || 
                card.querySelector('img')?.getAttribute('alt') ||
                card.innerText?.trim() || 
                '';
    if (title.length > 50) title = title.substring(0, 47) + '...';

    videos.push({ 
      url: url,
      title: title || `Publicación ${url.split('/').pop()}`,
      selected: isSelected
    });
  });

  return videos;
}

async function deleteRepost(url) {
  return new Promise(async (resolve) => {
    try {
      const postIdMatch = url.match(/\/(?:video|photo)\/(\d+)/);
      if (!postIdMatch) return resolve(false);
      const postId = postIdMatch[1];

      const linkEl = document.querySelector(`a[href*="${postId}"]`);
      if (!linkEl || !isVisibleElement(linkEl)) {
        return resolve(false);
      }

      // 1. Abrir video
      linkEl.click();
      await sleep(3000);

      // En esta interfaz TikTok ofrece el toggle amarillo directamente en la barra de acciones.
      const directRemoveButton = findDirectRemoveRepostButton();
      if (directRemoveButton) {
        await clickAndVerifyDirectRemove(directRemoveButton);
      } else {
        const shareButton = document.querySelector('[data-e2e="share-icon"]') || findByText(['share', 'compartir']);
        if (!shareButton) {
          closeModal();
          return resolve(false);
        }

        shareButton.click();
        await sleep(1200);

        const removeBtn = findByText([
          'quitar republicacion', 'quitar la republicacion',
          'eliminar republicacion', 'eliminar la republicacion',
          'deshacer republicacion', 'remove repost', 'undo repost'
        ]);
        if (!removeBtn) {
          closeModal();
          return resolve(false);
        }

        removeBtn.click();
        await sleep(1500);
      }

      // 4. Cerrar
      closeModal();
      await sleep(1000);

      resolve(await isPostRemovedFromGrid(postId));

    } catch (e) {
      console.error(e);
      closeModal();
      reject(e);
    }
  });
}

function closeModal() {
  const closeButton = document.querySelector('button[data-e2e="browse-close"]') || findByText(['close', 'cerrar']);
  if (closeButton) {
    closeButton.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
  } else if (/\/(video|photo)\//.test(window.location.href)) {
    window.history.back();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
