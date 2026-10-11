document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeleteSelected = document.getElementById('btn-delete-selected');
  const selectionActions = document.getElementById('selection-actions');
  const videoList = document.getElementById('video-list');
  const statusMessage = document.getElementById('status-message');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  let scannedVideos = [];
  let allSelected = false;

  const updateStatus = (msg) => { statusMessage.innerText = msg; };

  // 1. Escanear
  btnScan.addEventListener('click', async () => {
    updateStatus("Buscando compartidos en pantalla...");
    videoList.innerHTML = '';
    scannedVideos = [];
    selectionActions.classList.add('hidden');

    try {
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url.includes("tiktok.com")) {
        updateStatus("⚠️ Por favor, abre esta extensión estando en TikTok.");
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "SCAN_REPOSTS" }, (response) => {
        if (chrome.runtime.lastError) {
          updateStatus("Error: Por favor recarga la página de TikTok (F5) primero.");
          return;
        }

        if (response && response.success) {
          scannedVideos = response.videos;
          if (scannedVideos.length === 0) {
            updateStatus("No se encontraron compartidos visibles.");
          } else {
            updateStatus(`¡Se encontraron ${scannedVideos.length} compartidos! También puedes marcarlos directamente en la página.`);
            renderVideoList();
            selectionActions.classList.remove('hidden');
          }
        } else {
          updateStatus("Ocurrió un error al escanear.");
        }
      });
    } catch (e) {
      updateStatus("Error al conectar con la pestaña.");
    }
  });

  // Renderizar la lista sincronizada
  function renderVideoList() {
    videoList.innerHTML = '';
    scannedVideos.forEach((video, index) => {
      const li = document.createElement('li');
      li.className = 'video-item';
      
      const isChecked = video.selected ? 'checked' : '';
      li.innerHTML = `
        <input type="checkbox" data-url="${video.url}" id="video-${index}" ${isChecked}>
        <label for="video-${index}" class="video-info" title="${video.url}">
          ${video.title || `Video ${index + 1}`}
        </label>
      `;

      // Al marcar/desmarcar en el popup, actualizamos el video en tiempo real en TikTok
      const checkbox = li.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { 
            action: "SET_VIDEO_SELECTED", 
            url: video.url, 
            selected: checkbox.checked 
          });
        }
      });

      videoList.appendChild(li);
    });
  }

  // 2. Seleccionar todos
  btnSelectAll.addEventListener('click', async () => {
    allSelected = !allSelected;
    const checkboxes = document.querySelectorAll('.video-item input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = allSelected);
    btnSelectAll.innerText = allSelected ? "Deseleccionar Todos" : "Seleccionar Todos";

    // Notificar a TikTok para iluminar o apagar todos los videos
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: "SET_ALL_SELECTED", 
        selected: allSelected 
      });
    }
  });

  // 3. Eliminar seleccionados
  btnDeleteSelected.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.video-item input[type="checkbox"]:checked');
    const urlsToDelete = Array.from(checkboxes).map(cb => cb.getAttribute('data-url'));

    if (urlsToDelete.length === 0) {
      alert("Por favor, selecciona al menos un video para eliminar.");
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar ${urlsToDelete.length} compartidos seleccionados?`)) return;

    btnScan.disabled = true;
    selectionActions.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    let deletedCount = 0;
    let failedCount = 0;
    let lastFailure = '';
    const totalToDelete = urlsToDelete.length;

    for (const url of urlsToDelete) {
      const checkbox = videoList.querySelector(`input[data-url="${url}"]`);
      const videoElement = checkbox ? checkbox.parentElement : null;
      if (videoElement) videoElement.style.opacity = '0.5';

      updateStatus(`Eliminando compartido...`);

      await new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, { action: "DELETE_REPOST", url: url }, (res) => {
          const runtimeError = chrome.runtime.lastError;
          if (!runtimeError && res && res.success) {
            deletedCount++;
            if (videoElement) videoElement.style.display = 'none';
          } else {
            failedCount++;
            lastFailure = runtimeError?.message || res?.error || 'El content script no confirmó el borrado.';
            if (videoElement) {
              videoElement.style.opacity = '1';
              videoElement.style.border = '1px solid #ff0050';
            }
            updateStatus(`Falló ${url.split('/').pop()}: ${lastFailure}`);
          }
          const percent = ((deletedCount + failedCount) / totalToDelete) * 100;
          progressFill.style.width = `${percent}%`;
          progressText.innerText = `Procesados: ${deletedCount + failedCount} / ${totalToDelete}`;
          
          setTimeout(resolve, 2000); 
        });
      });
    }

    updateStatus(`Eliminados ${deletedCount}, fallidos ${failedCount}.${lastFailure ? ` Último error: ${lastFailure}` : ''}`);
    btnScan.disabled = false;
    setTimeout(() => { progressContainer.classList.add('hidden'); }, 4000);
  });
});
