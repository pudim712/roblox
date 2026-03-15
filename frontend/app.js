/**
 * ROBLOX FRIEND MANAGER - Frontend Logic
 * Atualizado: Sistema de Persistência Blindado e Estabilidade de Carregamento.
 */

const API_BASE = "http://localhost:3000/api";
let userCookie = "";
let userData = null;
let allFriends = [];
let selectedIds = new Set();

// Elementos da Interface
const loginScreen = document.getElementById('login-screen');
const mainInterface = document.getElementById('main-interface');
const btnLogin = document.getElementById('btn-login');
const btnRemove = document.getElementById('btn-remove');
const searchInput = document.getElementById('search-input');
const countDisplay = document.getElementById('count');
const grid = document.getElementById('friends-grid');

/**
 * INICIALIZAÇÃO: Verifica sessão salva assim que o DOM está pronto.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const savedCookie = localStorage.getItem('rbx_manager_session');
    
    if (savedCookie) {
        console.log("[AUTO-LOGIN] Cookie encontrado, validando...");
        // Passamos 'true' para indicar que é um auto-login (evita alertas de erro invasivos)
        await performLogin(savedCookie, true);
    } else {
        console.log("[AUTO-LOGIN] Nenhuma sessão anterior encontrada.");
    }
});

/**
 * Utilitário para gerar URLs de imagem do Roblox via Proxy.
 */
const getThumb = (id) => {
    if (!id) return 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-Png-Chid-0-W150-H150-Crop/150/150/AvatarHeadshot/Png/transparent';
    return `${API_BASE}/proxy-image/${id}`;
};

// --- Lógica de Autenticação ---

/**
 * Função centralizada de login.
 * @param {string} cookie - O cookie .ROBLOSECURITY
 * @param {boolean} isAuto - Se é uma tentativa automática ou manual
 */
async function performLogin(cookie, isAuto = false) {
    const originalContent = btnLogin.innerHTML;
    toggleLoading(btnLogin, true, "Validando...");

    try {
        const res = await fetch(`${API_BASE}/auth/validate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cookie: cookie })
        });

        if (!res.ok) {
            // Só remove do localStorage se o servidor confirmar que o cookie não presta
            if (res.status === 401) {
                localStorage.removeItem('rbx_manager_session');
            }
            throw new Error("Sessão expirada.");
        }

        userData = await res.json();
        userCookie = cookie;

        // Salva com sucesso
        localStorage.setItem('rbx_manager_session', cookie);

        // Atualiza UI
        document.getElementById('user-name').innerText = userData.displayName || userData.name;
        document.getElementById('user-avatar').src = getThumb(userData.id);

        loginScreen.classList.add('hidden');
        mainInterface.classList.remove('hidden');

        await loadFriends();
    } catch (err) {
        console.error("[LOGIN ERROR]", err.message);
        
        // Se for login manual (clicando no botão), avisa o usuário
        if (!isAuto) {
            alert(err.message || "Erro ao conectar com o servidor.");
        }
        
        toggleLoading(btnLogin, false, originalContent);
    }
}

btnLogin.onclick = () => {
    const rawCookie = document.getElementById('cookie-input').value.trim();
    if (!rawCookie) return alert("Por favor, insira seu .ROBLOSECURITY");
    performLogin(rawCookie, false);
};

// --- Gestão de Amigos ---

async function loadFriends() {
    grid.innerHTML = `
        <div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 50px; color: white;">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top: 15px; font-weight: 500;">Carregando amigos...</p>
        </div>`;

    try {
        const res = await fetch(`${API_BASE}/friends`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cookie: userCookie, userId: userData.id })
        });
        
        if (!res.ok) throw new Error();
        
        allFriends = await res.json();
        render();
    } catch (err) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #ff4d4d; padding: 40px;">
                <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
                <p style="margin-top:10px;">Erro ao carregar lista. Verifique o servidor.</p>
            </div>`;
    }
}

function render() {
    const search = (searchInput.value || "").toLowerCase().trim();
    grid.innerHTML = "";

    const filtered = allFriends.filter(f => {
        const displayName = (f.displayName || "").toLowerCase();
        const username = (f.name || "").toLowerCase();
        return displayName.includes(search) || username.includes(search);
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 40px;">Nenhum amigo encontrado.</p>`;
        return;
    }

    filtered.forEach(friend => {
        const fId = friend.id;
        const isSelected = selectedIds.has(fId);
        
        const card = document.createElement('div');
        card.className = `friend-card ${isSelected ? 'selected' : ''}`;
        
        card.innerHTML = `
            <img src="${getThumb(fId)}" 
                 onerror="this.onerror=null; this.src='https://tr.rbxcdn.com/30DAY-AvatarHeadshot-Png-Chid-0-W150-H150-Crop/150/150/AvatarHeadshot/Png/transparent'"
                 loading="lazy">
            <span class="display-name" title="${friend.displayName}">${friend.displayName}</span>
            <small class="username">@${friend.name}</small>
        `;

        card.onclick = () => {
            if (selectedIds.has(fId)) {
                selectedIds.delete(fId);
                card.classList.remove('selected');
            } else {
                selectedIds.add(fId);
                card.classList.add('selected');
            }
            updateCounter();
        };

        grid.appendChild(card);
    });
}

function updateCounter() {
    if (countDisplay) {
        countDisplay.innerText = selectedIds.size;
        countDisplay.style.transform = "scale(1.2)";
        setTimeout(() => countDisplay.style.transform = "scale(1)", 100);
    }
}

// --- Ações de Controle ---

document.getElementById('btn-select-all').onclick = () => {
    const search = (searchInput.value || "").toLowerCase().trim();
    allFriends.forEach(f => {
        const fDisplay = (f.displayName || "").toLowerCase();
        const fUser = (f.name || "").toLowerCase();

        if (fDisplay.includes(search) || fUser.includes(search)) {
            selectedIds.add(f.id);
        }
    });
    render();
    updateCounter();
};

btnRemove.onclick = async () => {
    if (selectedIds.size === 0) return alert("Selecione pelo menos um amigo.");
    
    if (!confirm(`Confirmar remoção de ${selectedIds.size} amigos?`)) return;

    const originalContent = btnRemove.innerHTML;
    toggleLoading(btnRemove, true, "Removendo...");

    try {
        const res = await fetch(`${API_BASE}/unfriend`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                cookie: userCookie, 
                userIds: Array.from(selectedIds) 
            })
        });

        const data = await res.json();
        
        allFriends = allFriends.filter(f => !data.success.includes(f.id));
        selectedIds.clear();
        
        alert(`Sucesso! ${data.success.length} amigos removidos.`);
        
    } catch (err) {
        alert("Erro ao processar a remoção.");
    } finally {
        toggleLoading(btnRemove, false, originalContent);
        render();
        updateCounter();
    }
};

// Logout
document.getElementById('btn-logout').onclick = () => {
    if (confirm("Deseja sair do sistema? Isso removerá sua conta deste navegador.")) {
        localStorage.removeItem('rbx_manager_session');
        location.reload(); 
    }
};

/**
 * Gerencia estados de carregamento nos botões
 */
function toggleLoading(btn, isLoading, content) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<i class="fa-solid fa-circle-notch fa-spin"></i> ${content}` : content;
}

// Filtro em tempo real
searchInput.oninput = () => render();