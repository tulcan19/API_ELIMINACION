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

  // Utils
  const updateStatus = (msg) => { statusMessage.innerText = msg; };

  // 1. Escanear
  btnScan.addEventListener('click', async () => {
    updateStatus("Buscando compartidos en la página actual...");
    videoList.innerHTML = '';
    scannedVideos = [];
    selectionActions.classList.add('hidden');

    try {
      // Obtener la pestaña activa
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes("tiktok.com")) {
        updateStatus("⚠️ Por favor, abre esta extensión estando en TikTok.");
        return;
      }

      // Enviar mensaje al content script para que busque videos compartidos
      chrome.tabs.sendMessage(tab.id, { action: "SCAN_REPOSTS" }, (response) => {
        if (chrome.runtime.lastError) {
          updateStatus("Error: Asegúrate de recargar la página de TikTok primero.");
          return;
        }

        if (response && response.success) {
          scannedVideos = response.videos;
          if (scannedVideos.length === 0) {
            updateStatus("No se encontraron compartidos. ¿Estás en la pestaña correcta de tu perfil?");
          } else {
            updateStatus(`¡Se encontraron ${scannedVideos.length} compartidos!`);
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

  // Renderizar la lista
  function renderVideoList() {
    videoList.innerHTML = '';
    scannedVideos.forEach((video, index) => {
      const li = document.createElement('li');
      li.className = 'video-item';
      li.innerHTML = `
        <input type="checkbox" data-index="${index}" id="video-${index}">
        <label for="video-${index}" class="video-info">Video ${index + 1} - Haz clic para ver</label>
      `;
      videoList.appendChild(li);
    });
  }

  // 2. Seleccionar todos
  btnSelectAll.addEventListener('click', () => {
    allSelected = !allSelected;
    const checkboxes = document.querySelectorAll('.video-item input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = allSelected);
    btnSelectAll.innerText = allSelected ? "Deseleccionar Todos" : "Seleccionar Todos";
  });

  // 3. Eliminar seleccionados
  btnDeleteSelected.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.video-item input[type="checkbox"]:checked');
    const indexesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-index')));

    if (indexesToDelete.length === 0) {
      alert("Por favor, selecciona al menos un video para eliminar.");
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar ${indexesToDelete.length} compartidos?`)) return;

    // UI de progreso
    btnScan.disabled = true;
    selectionActions.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    let deletedCount = 0;
    const totalToDelete = indexesToDelete.length;

    for (const index of indexesToDelete) {
      const videoElement = videoList.querySelector(`input[data-index="${index}"]`).parentElement;
      videoElement.classList.add('deleting');
      updateStatus(`Eliminando video ${index + 1}...`);

      // Enviar instrucción de borrar 1 video específico
      await new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, { action: "DELETE_REPOST", index: index }, (res) => {
          if (res && res.success) {
            deletedCount++;
            const percent = (deletedCount / totalToDelete) * 100;
            progressFill.style.width = `${percent}%`;
            progressText.innerText = `Eliminado: ${deletedCount} / ${totalToDelete}`;
            videoElement.style.display = 'none'; // ocultar tras borrar
          }
          // Esperar un poco entre borrados para parecer humano y no bloquearse
          setTimeout(resolve, 1500 + Math.random() * 1000); 
        });
      });
    }

    updateStatus(`¡Proceso terminado! Se eliminaron ${deletedCount} compartidos.`);
    btnScan.disabled = false;
    setTimeout(() => { progressContainer.classList.add('hidden'); }, 3000);
  });
});
