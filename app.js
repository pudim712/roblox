/**
 * ROBLOX FRIEND MANAGER - Frontend Logic
 * Atualizado: Versão Ultra-Responsiva para Mobile & Desktop.
 */

const API_BASE = "https://8bbf-2804-30c-3248-a000-2d74-ac7a-a410-973a.ngrok-free.app";
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
 * INICIALIZAÇÃO: Executa o auto-login se houver sessão salva.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const savedCookie = localStorage.getItem('rbx_manager_session');
    
    if (savedCookie) {
        console.log("[AUTO-LOGIN] Iniciando...");
        await performLogin(savedCookie, true);
    }
});

/**
 * Utilitário: Gerar URLs de imagem (Avatar).
 */
const getThumb = (id) => {
    if (!id) return 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-Png-Chid-0-W150-H150-Crop/150/150/AvatarHeadshot/Png/transparent';
    return `${API_BASE}/proxy-image/${id}`;
};

// --- Lógica de Autenticação ---

async function performLogin(cookie, isAuto = false) {
    const originalContent = btnLogin.innerHTML;
    toggleLoading(btnLogin, true, isAuto ? "Entrando..." : "Validando...");

    try {
        const res = await fetch(`${API_BASE}/auth/validate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cookie: cookie })
        });

        if (!res.ok) {
            if (res.status === 401) localStorage.removeItem('rbx_manager_session');
            throw new Error("Sessão inválida.");
        }

        userData = await res.json();
        userCookie = cookie;
        localStorage.setItem('rbx_manager_session', cookie);

        // UI Update
        document.getElementById('user-name').innerText = userData.displayName || userData.name;
        document.getElementById('user-avatar').src = getThumb(userData.id);

        loginScreen.classList.add('hidden');
        mainInterface.classList.remove('hidden');

        await loadFriends();
    } catch (err) {
        console.error("[ERROR]", err.message);
        if (!isAuto) alert("Falha ao entrar. Verifique o cookie ou sua conexão.");
        toggleLoading(btnLogin, false, originalContent);
    }
}

btnLogin.onclick = () => {
    const rawCookie = document.getElementById('cookie-input').value.trim();
    if (!rawCookie) return alert("Insira o cookie para continuar.");
    performLogin(rawCookie, false);
};

// --- Gestão de Amigos ---

async function loadFriends() {
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #8e9297;">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top: 15px; font-weight: 500;">Carregando sua lista...</p>
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
            <div style="grid-column: 1/-1; text-align: center; color: #ff4757; padding: 40px;">
                <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
                <p style="margin-top:10px;">Erro ao carregar lista. Tente novamente.</p>
            </div>`;
    }
}

function render() {
    const search = (searchInput.value || "").toLowerCase().trim();
    grid.innerHTML = "";

    const filtered = allFriends.filter(f => {
        const dName = (f.displayName || "").toLowerCase();
        const uName = (f.name || "").toLowerCase();
        return dName.includes(search) || uName.includes(search);
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #555; padding: 50px;">Nenhum resultado.</p>`;
        return;
    }

    // Usando DocumentFragment para melhor performance mobile
    const fragment = document.createDocumentFragment();

    filtered.forEach(friend => {
        const isSelected = selectedIds.has(friend.id);
        const card = document.createElement('div');
        card.className = `friend-card ${isSelected ? 'selected' : ''}`;
        
        card.innerHTML = `
            <img src="${getThumb(friend.id)}" loading="lazy">
            <span class="display-name">${friend.displayName}</span>
            <small class="username">@${friend.name}</small>
        `;

        card.onclick = () => {
            // Feedback tátil simples para celular
            if (window.navigator.vibrate) window.navigator.vibrate(5);

            if (selectedIds.has(friend.id)) {
                selectedIds.delete(friend.id);
                card.classList.remove('selected');
            } else {
                selectedIds.add(friend.id);
                card.classList.add('selected');
            }
            updateCounter();
        };

        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
}

function updateCounter() {
    if (countDisplay) {
        countDisplay.innerText = selectedIds.size;
        // Efeito de pulso no contador
        countDisplay.parentElement.style.transform = "scale(1.05)";
        setTimeout(() => countDisplay.parentElement.style.transform = "scale(1)", 100);
    }
}

// --- Ações de Controle ---

document.getElementById('btn-select-all').onclick = () => {
    const search = (searchInput.value || "").toLowerCase().trim();
    allFriends.forEach(f => {
        const dName = (f.displayName || "").toLowerCase();
        const uName = (f.name || "").toLowerCase();
        if (dName.includes(search) || uName.includes(search)) {
            selectedIds.add(f.id);
        }
    });
    render();
    updateCounter();
};

btnRemove.onclick = async () => {
    if (selectedIds.size === 0) return alert("Selecione alguém primeiro.");
    
    // Confirmação nativa (funciona bem em qualquer celular)
    const confirmar = confirm(`Remover ${selectedIds.size} amigos selecionados?`);
    if (!confirmar) return;

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
        
        // Remove da lista local os IDs que tiveram sucesso
        allFriends = allFriends.filter(f => !data.success.includes(f.id));
        selectedIds.clear();
        
        alert(`Sucesso! ${data.success.length} remoções concluídas.`);
    } catch (err) {
        alert("Ocorreu um erro ao processar a remoção.");
    } finally {
        toggleLoading(btnRemove, false, originalContent);
        render();
        updateCounter();
    }
};

// Logout
document.getElementById('btn-logout').onclick = () => {
    if (confirm("Deseja sair e desconectar sua conta?")) {
        localStorage.removeItem('rbx_manager_session');
        window.location.reload();
    }
};

/**
 * Utilitário: Toggle Loading State
 */
function toggleLoading(btn, isLoading, content) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.style.opacity = isLoading ? "0.7" : "1";
    btn.innerHTML = isLoading ? `<i class="fa-solid fa-spinner fa-spin"></i> ${content}` : content;
}

// Escuta de pesquisa com pequeno delay (debounce) para performance mobile
let searchTimeout;
searchInput.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(render, 150);
};
