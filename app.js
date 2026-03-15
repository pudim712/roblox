/**
 * ROBLOX FRIEND MANAGER - Frontend Logic
 * Versão: No-Photos (Removido completamente o sistema de imagens)
 */

const API_BASE = "https://305b-2804-30c-3248-a000-2d74-ac7a-a410-973a.ngrok-free.app";

let userCookie = "";
let userData = null;
let allFriends = [];
let selectedIds = new Set();

const loginScreen = document.getElementById('login-screen');
const mainInterface = document.getElementById('main-interface');
const btnLogin = document.getElementById('btn-login');
const btnRemove = document.getElementById('btn-remove');
const searchInput = document.getElementById('search-input');
const countDisplay = document.getElementById('count');
const grid = document.getElementById('friends-grid');

document.addEventListener('DOMContentLoaded', async () => {
    const savedCookie = localStorage.getItem('rbx_manager_session');
    if (savedCookie) {
        await performLogin(savedCookie, true);
    }
});

// --- Lógica de Autenticação ---

async function performLogin(cookie, isAuto = false) {
    const originalContent = btnLogin.innerHTML;
    toggleLoading(btnLogin, true, isAuto ? "Entrando..." : "Validando...");

    try {
        const res = await fetch(`${API_BASE}/api/auth/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true' 
            },
            body: JSON.stringify({ cookie: cookie })
        });

        if (!res.ok) {
            if (res.status === 401) localStorage.removeItem('rbx_manager_session');
            throw new Error("Sessão inválida.");
        }

        userData = await res.json();
        userCookie = cookie;
        localStorage.setItem('rbx_manager_session', cookie);

        document.getElementById('user-name').innerText = userData.displayName || userData.name;
        
        loginScreen.classList.add('hidden');
        mainInterface.classList.remove('hidden');

        await loadFriends();
    } catch (err) {
        console.error("[ERROR]", err.message);
        if (!isAuto) alert("Falha ao entrar.");
        toggleLoading(btnLogin, false, originalContent);
    }
}

btnLogin.onclick = () => {
    const rawCookie = document.getElementById('cookie-input').value.trim();
    if (!rawCookie) return alert("Insira o cookie.");
    performLogin(rawCookie, false);
};

// --- Gestão de Amigos ---

async function loadFriends() {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i></div>`;

    try {
        const res = await fetch(`${API_BASE}/api/friends`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ cookie: userCookie, userId: userData.id })
        });
        
        if (!res.ok) throw new Error();
        allFriends = await res.json();
        render();
    } catch (err) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ff4757;">Erro ao carregar lista.</p>`;
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
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 50px;">Nenhum amigo encontrado.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(friend => {
        const isSelected = selectedIds.has(friend.id);
        const card = document.createElement('div');
        card.className = `friend-card ${isSelected ? 'selected' : ''}`;
        
        // Renderização simples: Apenas Nome e UserID (sem tags de imagem ou ícones)
        card.innerHTML = `
            <span class="display-name">${friend.displayName}</span>
            <small class="username">@${friend.name}</small>
            <div class="user-id" style="font-size: 10px; opacity: 0.5; margin-top: 5px;">ID: ${friend.id}</div>
        `;

        card.onclick = () => {
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
    if (countDisplay) countDisplay.innerText = selectedIds.size;
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
    if (!confirm(`Remover ${selectedIds.size} amigos?`)) return;

    const originalContent = btnRemove.innerHTML;
    toggleLoading(btnRemove, true, "Removendo...");

    try {
        const res = await fetch(`${API_BASE}/api/unfriend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ 
                cookie: userCookie, 
                userIds: Array.from(selectedIds) 
            })
        });

        const data = await res.json();
        allFriends = allFriends.filter(f => !data.success.includes(f.id));
        selectedIds.clear();
        alert(`Sucesso: ${data.success.length} | Erros: ${data.errors.length}`);
    } catch (err) {
        alert("Erro ao remover.");
    } finally {
        toggleLoading(btnRemove, false, originalContent);
        render();
        updateCounter();
    }
};

document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('rbx_manager_session');
    window.location.reload();
};

function toggleLoading(btn, isLoading, content) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<i class="fa-solid fa-spinner fa-spin"></i> ${content}` : content;
}

let searchTimeout;
searchInput.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(render, 150);
};
