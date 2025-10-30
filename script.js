/* ========================================================== */
/* Archivo: script.js (TODO EN UNO - Solución para Ejecución Local) */
/* ========================================================== */

// --- CONSTANTES GLOBALES Y VARIABLES DE ESTADO ---
const STEAM_REPORT_URL = 'https://steamcommunity.com/workshop/filedetails/discussion/3592954440/597415360364625741/';
const RADIO_PLAYER = document.getElementById('radio-player');
const PLAY_PAUSE_BUTTON = document.getElementById('play-pause-button');
const STOP_BUTTON = document.getElementById('stop-button');
const VOLUME_SLIDER = document.getElementById('volume-slider');
const VOLUME_DISPLAY = document.getElementById('volume-display');
const STATION_NAME_DISPLAY = document.getElementById('station-name-display');
const CURRENT_PLAYBACK_STATUS = document.getElementById('current-playback-status');

let STATIONS = []; 
let currentStation = null;
let isPlaying = false;
let hasError = false;
let currentLanguage = localStorage.getItem('playerLanguage') || 'es';


/**
 * Inicializa el reproductor con los datos precargados.
 */
function initializePlayer() {
    
    // 1. Configurar idioma y aplicar traducción
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.value = currentLanguage;
    }
    applyTranslations(currentLanguage);

    // ⭐️ ACTUALIZAR EL AÑO EN EL FOOTER
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear(); 
    }
    
    // 2. Aplanar y ordenar estaciones
    STATIONS = flattenAndSortStations(ALL_STATIONS_DATA);
    
    // ⭐️ Agrega una comprobación de consola para verificar si STATIONS está vacío
    console.log('Total de emisoras cargadas:', STATIONS.length); 

    // 3. Cargar lista y Local Storage
    loadStations(); 
    loadLocalStorage();
    
    // 4. Asignar eventos
	VOLUME_SLIDER.addEventListener('input', setVolume);
	PLAY_PAUSE_BUTTON.addEventListener('click', togglePlayPause);
	STOP_BUTTON.addEventListener('click', stopPlayback);
	// ⭐️ AÑADE ESTA LÍNEA para vincular el reporte directamente por ID
	document.getElementById('copy-report-button')
	.addEventListener('click', window.copyReportToClipboard);

    // 5. Detección de Errores y Estados de Reproducción
    RADIO_PLAYER.addEventListener('error', handleStreamError);
    RADIO_PLAYER.addEventListener('playing', () => { 
        updatePlaybackStatus('playing');
        hasError = false;
        if (currentStation) updateActiveState(currentStation.index); 
    });
    RADIO_PLAYER.addEventListener('waiting', () => { 
        updatePlaybackStatus('loading');
    });
    RADIO_PLAYER.addEventListener('pause', () => { 
        if(!hasError) updatePlaybackStatus('paused');
    });
    RADIO_PLAYER.addEventListener('abort', () => {
        if(!hasError) updatePlaybackStatus('stopped'); 
    });
}

window.copyReportManual = async function() {
    const t = translations[currentLanguage] || translations['es'];
    const reportButton = document.getElementById('copy-report-button');
    const stationName = document.getElementById('report-station-name').textContent;
    
    // OBTENEMOS la URL que fue guardada en openReportModal()
    const stationUrl = reportButton.dataset.fullUrl || 'URL no encontrada (FALLO DE DATASET)'; 
    const timestamp = new Date().toISOString();
    
    const reportText = 
        `🚨 REPORTE DE FALLO 🚨\n` + 
        `Emisora: ${stationName}\n` + 
        `URL: ${stationUrl}\n` + 
        `Reporte Automático al ${timestamp}\n\n` + 
        `[FALLO URGENTE] ${stationName} - URL: ${stationUrl} - Reporte Automático al ${timestamp}`;
    
    try {
        await navigator.clipboard.writeText(reportText);
        
        // Copia exitosa, ahora alertamos y redirigimos (como en Sugerencia)
        alert(t.copy_success_status.replace('¡', '').replace('!', '') + 
              t.copy_suggest_redirect); // Mensaje de éxito + Redirección
        
        // Redirigir a Steam
        window.open(STEAM_REPORT_URL, '_blank');
        closeModal('report-modal');

    } catch (err) {
        // Copia fallida, mostramos alerta para copia manual y redirigimos (como en Sugerencia)
        alert(t.copy_alert_error + reportText);
        console.error('Error al copiar al portapapeles. Se usó el fallback de alerta.', err);
        
        // Redirigir a Steam
        window.open(STEAM_REPORT_URL, '_blank');
        closeModal('report-modal');
    }
}


// -------------------------------------------------------------
// --- FUNCIONES DE TRADUCCIÓN Y ESTADO ---
// -------------------------------------------------------------

function applyTranslations(lang) {
    const t = translations[lang];

    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (t && t[key]) { 
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = t[key];
            } else {
                // Esto incluye todos los elementos ocultos como los del modal
                element.textContent = t[key]; 
            }
        }
    });
    
    if (t) {
        document.title = t.app_title;
        // Re-traducir el estado actual (importante para el reproductor)
        updatePlaybackStatus(CURRENT_PLAYBACK_STATUS.textContent); 
    }
}

function updatePlaybackStatus(statusKeyOrText) {
    const t = translations[currentLanguage] || translations['es'];
    // Definimos un respaldo para el prefijo por si la clave no existe
    const stationPrefix = t.current_station_prefix || "Emisora: "; 

    if (!t) return;
    
    let newStatus = statusKeyOrText;

    // Remover la clase de animación por defecto
    CURRENT_PLAYBACK_STATUS.classList.remove('loading-animation');
    // Restaurar color
    CURRENT_PLAYBACK_STATUS.style.color = 'inherit';

    // Mapeo robusto de estados (tu lógica de estado)
    if (statusKeyOrText === 'playing') {
        newStatus = t.status_playing;
    } else if (statusKeyOrText === 'loading') {
        newStatus = t.status_loading;
        CURRENT_PLAYBACK_STATUS.classList.add('loading-animation');
    } else if (statusKeyOrText === 'paused') {
        newStatus = t.status_paused;
    } else if (statusKeyOrText === 'error') {
        newStatus = t.status_error;
        CURRENT_PLAYBACK_STATUS.style.color = '#e74c3c'; 
    } else if (statusKeyOrText === 'stopped' || RADIO_PLAYER.src === "") {
        newStatus = t.status_stopped;
    } else if (statusKeyOrText === 'inactive') {
        newStatus = t.inactive;
    } else if (statusKeyOrText === 'click_to_play') {
        newStatus = t.status_click_to_play;
    } else {
        // Manejar el caso de que la clave de estado sea el texto actual traducido
        newStatus = CURRENT_PLAYBACK_STATUS.textContent;
    }
    
    // ⭐️ CAMBIO CLAVE: Aplicar el prefijo traducible ⭐️
    if (!currentStation || RADIO_PLAYER.src === "") {
        // Si no hay estación activa, mostrar "Ninguna" con su prefijo
        STATION_NAME_DISPLAY.textContent = stationPrefix + (t.current_none || "Ninguna");
    } else {
        // Si hay estación activa, aplicar el prefijo y el nombre
        STATION_NAME_DISPLAY.textContent = stationPrefix + currentStation.name;
    }
    
    CURRENT_PLAYBACK_STATUS.textContent = newStatus;
}


function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('playerLanguage', lang);
        
        // ⭐️ Esta función aplica todas las traducciones
        applyTranslations(lang); 
        
        // ⭐️ Esta función regenera la lista de emisoras y sus grupos
        loadStations(); 
    }
}


// -------------------------------------------------------------
// --- FUNCIONES DE LISTA Y ESTACIONES ---
// -------------------------------------------------------------

function flattenAndSortStations(groupedStations) {
    let flattened = [];
    for (const country in groupedStations) {
        groupedStations[country].forEach(station => {
            flattened.push({ ...station, country: country });
        });
    }

    flattened.sort((a, b) => a.name.localeCompare(b.name));
    
    flattened.forEach((station, index) => {
        station.index = index; 
    });
    
    return flattened;
}

function getFavorites() {
    const favoritesJSON = localStorage.getItem('radioFavorites');
    return favoritesJSON ? JSON.parse(favoritesJSON) : [];
}

function loadStations() {
    const listContainer = document.getElementById('radio-list');
    listContainer.innerHTML = '';
    
    const favorites = getFavorites();

    // ⭐️ 1. CATEGORÍA DE FAVORITOS
    const favoriteStations = STATIONS.filter(s => favorites.some(fav => fav.url === s.url))
                                     .sort((a, b) => a.name.localeCompare(b.name)); 
    
    if (favoriteStations.length > 0) {
        createStationGroup(listContainer, "Favoritos ⭐", "favoritos", favoriteStations);
    }
    
    // 2. CATEGORÍAS POR PAÍS
    for (const country in ALL_STATIONS_DATA) {
        const stationsInCountry = STATIONS.filter(s => s.country === country);
        stationsInCountry.sort((a, b) => a.name.localeCompare(b.name));
        
        createStationGroup(listContainer, country, country.replace(/\s/g, '-'), stationsInCountry);
    }
	assignIconEvents();
	
    // Re-aplicar estado activo después de recargar la lista
    if (currentStation) {
        updateActiveState(currentStation.index);
    } else {
        updateActiveState(-1);
    }
}

function createStationGroup(listContainer, title, idPrefix, stationList) {
	const t = translations[currentLanguage] || translations['es'];
	let displayTitle;
		const translationKey = "group_" + idPrefix.replace(/-/g, '_');
	if (t[translationKey]) {
        displayTitle = t[translationKey];
    } else if (idPrefix === "favoritos") {
        // 2. Si es favoritos, usamos la clave group_favorites
        displayTitle = t.group_favorites || title; 
    } else {
        // 3. Si no hay clave de traducción, usamos el título original (el nombre del país/grupo)
        displayTitle = title;
    }
            const header = document.createElement('div');
    header.className = 'accordion-group-header';
    header.id = `header-${idPrefix.toLowerCase()}`;
    // Usamos el título traducido o el original
    header.textContent = displayTitle; 
    header.dataset.target = `content-${idPrefix.toLowerCase()}`;
    header.onclick = function() { toggleAccordionGroup(this.dataset.target); };
    listContainer.appendChild(header);
	

            const content = document.createElement('div');
            content.id = header.dataset.target;
            content.className = 'accordion-group-content';
            listContainer.appendChild(content);

            const ul = document.createElement('ul');
            const favorites = getFavorites(); // Recargar favoritos para el estado del icono

            stationList.forEach(station => {
                const isFavorite = favorites.some(fav => fav.url === station.url);
                
                const li = document.createElement('li');
                li.className = 'station-item';
                li.dataset.index = station.index; 
                li.dataset.country = station.country; // Para búsqueda
                li.innerHTML = `
                    <span>${station.name}</span>
                    <span class="report-group">
                        <span class="station-icon station-favorite-indicator" 
                              title="${isFavorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}" 
                              data-station-url="${station.url}">
                              ${isFavorite ? '⭐' : '☆'}
                        </span>
                        <span class="station-icon station-error-indicator" 
                              title="Reportar emisora caída" 
                              data-station-name="${station.name}" 
                              data-station-url="${station.url}">
                              ❌
                        </span>
                    </span>
                `;
                li.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('station-icon')) {
                        selectStation(parseInt(e.currentTarget.dataset.index));
                    }
                });
                ul.appendChild(li);
            });
            content.appendChild(ul);
        }


function assignIconEvents() {
            // Lógica de Reporte Rápido
            document.querySelectorAll('.station-error-indicator').forEach(indicator => {
                indicator.onclick = (e) => {
                    e.stopPropagation(); 
                    openReportModal(e.target.dataset.stationName, e.target.dataset.stationUrl);
                };
            });
            
            // Lógica de Favoritos
            document.querySelectorAll('.station-favorite-indicator').forEach(indicator => {
                indicator.onclick = (e) => {
                    e.stopPropagation();
                    toggleFavorite(e.target.dataset.stationUrl, e.target);
                    // Recargar la lista para actualizar el grupo de Favoritos
                    loadStations(); 
                };
            });
        }

function toggleFavorite(url, element) {
    const t = translations[currentLanguage] || translations['es'];
    let favorites = getFavorites();
    const station = STATIONS.find(s => s.url === url);

    if (!station) return;

    const index = favorites.findIndex(fav => fav.url === url);

    if (index > -1) {
        favorites.splice(index, 1);
        element.textContent = '☆';
        element.title = t.favorite_add;
    } else {
        favorites.push({ name: station.name, url: station.url });
        element.textContent = '⭐';
        element.title = t.favorite_remove;
    }

    localStorage.setItem('radioFavorites', JSON.stringify(favorites));
}

function toggleAccordionGroup(id) {
    const content = document.getElementById(id);
    if (content.style.display === "block") {
        content.style.display = "none";
    } else {
        content.style.display = "block";
    }
}

function closeAllAccordionGroups() {
    document.querySelectorAll('.accordion-group-content').forEach(content => {
        content.style.display = 'none';
    });
}

window.filterStations = function() {
    const searchText = document.getElementById('search-bar').value.toLowerCase();
    const allItems = document.querySelectorAll('.station-item');

    allItems.forEach(item => {
        const name = item.querySelector('span:first-child').textContent.toLowerCase();
        const country = item.dataset.country.toLowerCase();
        
        const isMatch = name.includes(searchText) || country.includes(searchText);
        item.style.display = isMatch ? 'flex' : 'none';
        
        const groupContent = item.closest('.accordion-group-content');
        if (groupContent) {
            groupContent.style.display = searchText.length > 0 ? 'block' : 'none';
        }
    });
    
    if (searchText.length === 0) {
        closeAllAccordionGroups();
        const favContent = document.getElementById('content-favoritos');
        if (favContent) favContent.style.display = 'block';
    }
}

// -------------------------------------------------------------
// --- FUNCIONES DE REPRODUCCIÓN Y LOCAL STORAGE ---
// -------------------------------------------------------------

function loadLocalStorage() {
    const t = translations[currentLanguage] || translations['es'];
    const savedVolume = localStorage.getItem('radioVolume');
    const savedIndex = localStorage.getItem('lastStationIndex');

    if (savedVolume !== null) {
        VOLUME_SLIDER.value = savedVolume;
        RADIO_PLAYER.volume = savedVolume / 100;
        VOLUME_DISPLAY.textContent = `${savedVolume}%`;
    }

    if (savedIndex !== null && STATIONS[savedIndex]) {
        currentStation = STATIONS[savedIndex];
        STATION_NAME_DISPLAY.textContent = currentStation.name;
        updateActiveState(parseInt(savedIndex)); 
        RADIO_PLAYER.src = currentStation.url;
        // No reproducir automáticamente, solo cargar el estado y la URL
        updatePlaybackStatus('click_to_play'); 
    } else {
        STATION_NAME_DISPLAY.textContent = t.current_none;
        CURRENT_PLAYBACK_STATUS.textContent = t.inactive;
    }
    
    const favContent = document.getElementById('content-favoritos');
    if (favContent) favContent.style.display = 'block';
}

function setVolume() {
    const vol = VOLUME_SLIDER.value;
    RADIO_PLAYER.volume = vol / 100;
    VOLUME_DISPLAY.textContent = `${vol}%`;
    localStorage.setItem('radioVolume', vol);
}

function handleStreamError() {
    // ⭐️ CAMBIO CLAVE: Solo procesar el error si hay una estación cargada
    if (currentStation && RADIO_PLAYER.src !== '') { 
        hasError = true;
        updatePlaybackStatus('error');
        PLAY_PAUSE_BUTTON.textContent = (translations[currentLanguage] || translations['es']).button_play;
        isPlaying = false;
        updateActiveState(-1); 
        console.error(`Error al cargar o reproducir la emisora: ${currentStation.name}`);
    } else {
        // Si no hay estación cargada (ej: al iniciar o detener), lo ignoramos.
        console.log('Error de stream ignorado: No hay estación activa o el reproductor está siendo detenido.');
        hasError = false; // Aseguramos que el estado de error se resetee si es un error "limpio"
    }
}

function selectStation(index) {
    const t = translations[currentLanguage] || translations['es'];
    if (!STATIONS[index]) return; 

    // Si la estación es la misma, solo hacemos toggle play/pause
    if (currentStation && currentStation.index === index && isPlaying) {
        togglePlayPause(); 
        return;
    }

    currentStation = STATIONS[index];
    RADIO_PLAYER.src = currentStation.url;
    RADIO_PLAYER.load();
    STATION_NAME_DISPLAY.textContent = currentStation.name;
    localStorage.setItem('lastStationIndex', index);
    
    updateActiveState(index); 
    
    closeAllAccordionGroups();

    RADIO_PLAYER.play().then(() => {
        PLAY_PAUSE_BUTTON.textContent = t.button_pause;
        isPlaying = true;
        hasError = false;
    }).catch(error => {
        console.warn('Primer intento fallido (Autoplay bloqueado). Intentando recarga silenciosa...');

        RADIO_PLAYER.pause();
        RADIO_PLAYER.src = ''; 
        RADIO_PLAYER.src = currentStation.url;
        RADIO_PLAYER.load(); 

        RADIO_PLAYER.play().then(() => {
            PLAY_PAUSE_BUTTON.textContent = t.button_pause;
            isPlaying = true;
            hasError = false;
        }).catch(secondError => {
            PLAY_PAUSE_BUTTON.textContent = t.button_play;
            isPlaying = false;
            updatePlaybackStatus('click_to_play'); 
            console.error('Fallo definitivo de AutoPlay:', secondError);
        });
    });
}

function togglePlayPause() {
    const t = translations[currentLanguage] || translations['es'];
    if (currentStation === null) {
        selectStation(0);
        return;
    } 

    if (isPlaying) {
        RADIO_PLAYER.pause();
        PLAY_PAUSE_BUTTON.textContent = t.button_play;
        isPlaying = false;
        updateActiveState(-1); // Desmarcar al pausar
    } else {
        RADIO_PLAYER.play().then(() => {
            PLAY_PAUSE_BUTTON.textContent = t.button_pause;
            isPlaying = true;
            hasError = false;
            updateActiveState(currentStation.index); // Marcar al reanudar
        }).catch(error => {
            CURRENT_PLAYBACK_STATUS.textContent = t.status_click_to_play;
            updateActiveState(-1);
            console.error('Error al intentar reproducir:', error);
        });
    }
}

function stopPlayback() {
    const t = translations[currentLanguage] || translations['es'];
    
    // ⭐️ Eliminamos la lógica de add/removeEventListener que causaba problemas de tiempo
    // El control de errores se hace ahora en handleStreamError()
    
    RADIO_PLAYER.pause();
    RADIO_PLAYER.src = ''; 
    isPlaying = false;
    currentStation = null; // ⭐️ Limpiamos la estación activa para que handleStreamError lo ignore
    hasError = false;
    PLAY_PAUSE_BUTTON.textContent = t.button_play;
    updatePlaybackStatus('stopped');
    STATION_NAME_DISPLAY.textContent = t.current_none;
    
    updateActiveState(-1); 
    
    localStorage.removeItem('lastStationIndex'); 
    closeAllAccordionGroups();
    const favContent = document.getElementById('content-favoritos');
    if (favContent) favContent.style.display = 'block';
}

function updateActiveState(activeIndex) {
    document.querySelectorAll('.station-item').forEach((item) => {
        item.classList.toggle('active', parseInt(item.dataset.index) === activeIndex);
    });
}


// -------------------------------------------------------------
// --- FUNCIONES DE MODAL Y SUGERENCIA ---
// -------------------------------------------------------------

function truncateUrl(url, startChars = 20, endChars = 15) {
    // Aplicando el formato truncado: https://21223.../LOS40_SC
    if (url.length <= startChars + endChars + 3) {
        return url;
    }
    const start = url.slice(0, startChars);
    const end = url.slice(-endChars);
    return `${start}...${end}`;
}

function openReportModal(name, url) {
            const modal = document.getElementById('report-modal');
            document.getElementById('report-station-name').textContent = name;
            document.getElementById('report-url-display').textContent = truncateUrl(url); 
            document.getElementById('go-to-steam-button').href = STEAM_REPORT_URL;
            document.getElementById('copy-report-button').textContent = 'Copiar Mensaje al Portapapeles';
            document.getElementById('copy-status').style.display = 'none';
            modal.style.display = 'block';
        }

        // Función para cerrar el modal
        function closeModal(id) {
            document.getElementById(id).style.display = 'none';
        }

        // Lógica de Copia de Reporte
        async function copyReportToClipboard() {
            const stationName = document.getElementById('report-station-name').textContent;
            const stationUrl = STATIONS.find(s => s.name === stationName)?.url || 'URL no encontrada';
            const timestamp = new Date().toISOString();
            
            const reportText = 
                `[FALLO URGENTE] ${stationName} - URL: ${stationUrl} - Reporte Automático al ${timestamp}`;
            
            try {
                await navigator.clipboard.writeText(reportText);
                document.getElementById('copy-report-button').textContent = '✅ Mensaje Copiado';
                document.getElementById('copy-status').style.display = 'block';
            } catch (err) {
                alert('Error al copiar. Por favor, copia el texto manualmente: ' + reportText);
                console.error('Error al copiar al portapapeles:', err);
            }
        }
// ⭐️ NUEVA FUNCIÓN: Redirección con un prompt de confirmación
window.confirmReportAndGoToSteam = function() {
    const t = translations[currentLanguage] || translations['es'];
    const stationName = document.getElementById('report-station-name').textContent;
    const reportLink = document.getElementById('go-to-steam-button');
    const stationUrl = reportLink.dataset.fullUrl || 'URL no encontrada';
    const timestamp = new Date().toISOString();
    
    const reportText = 
        `[FALLO URGENTE] ${stationName} - URL: ${stationUrl} - Reporte Automático al ${timestamp}`;
        
    // 1. Usamos prompt para que el usuario pueda copiar el mensaje
    const confirmation = confirm(
        `✅ ${t.report_station_label} ${stationName}\n\n` + 
        `⚠️ Antes de continuar, por favor, copia el siguiente mensaje que usarás en Steam (Ctrl+C o Cmd+C):\n\n` + 
        `${reportText}\n\n` + 
        `Presiona Aceptar para ir al hilo de Steam.`
    );
    
    if (confirmation) {
        // 2. Abre la URL y cierra el modal
        window.open(STEAM_REPORT_URL, '_blank');
        closeModal('report-modal');
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}


window.copySuggestionToClipboard = async function() {
    const t = translations[currentLanguage] || translations['es'];
    const name = document.getElementById('new-station-name').value.trim();
    const url = document.getElementById('new-station-url').value.trim();
    const region = document.getElementById('new-station-region').value.trim(); 

    if (!name || !url || !region) { 
        alert(t.copy_suggest_button.replace('Copiar Sugerencia e ir a Steam', 'Por favor, rellena el Nombre, la URL y la Región/País.'));
        return;
    }

    const suggestionText = 
        `[NUEVA EMISORA] ${name} - URL: ${url} - REGION: ${region}`; 

    try {
        await navigator.clipboard.writeText(suggestionText);
        alert(t.copy_suggest_button.replace('Copiar Sugerencia e ir a Steam', '¡Sugerencia copiada! Ahora serás redirigido a Steam para pegar el texto.'));
        
        document.getElementById('new-station-name').value = '';
        document.getElementById('new-station-url').value = '';
        document.getElementById('new-station-region').value = ''; 

        window.open(STEAM_REPORT_URL, '_blank');
        
        toggleAccordion('suggestion-content');

    } catch (err) {
        alert(t.copy_alert_error + suggestionText);
        console.error('Error al copiar al portapapeles:', err);
    }
}

window.toggleAccordion = function(id) {
    const content = document.getElementById(id);
    if (content.style.display === "block") {
        content.style.display = "none";
    } else {
        content.style.display = "block";
    }
}

window.setLanguage = setLanguage;
window.filterStations = filterStations;
window.closeModal = closeModal;

window.onclick = function(event) {
    const modal = document.getElementById('report-modal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// Iniciar la inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', initializePlayer);