const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Configuração de segurança ajustada para permitir imagens externas
app.use(helmet({ 
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

const robloxApi = axios.create({ timeout: 10000 });

// --- Utilitários ---

async function getCsrfToken(cookie) {
    try {
        await axios.post('https://auth.roblox.com/v2/logout', {}, {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
        });
    } catch (error) {
        const token = error.response?.headers['x-csrf-token'];
        if (token) return token;
        throw new Error('Falha ao obter Token CSRF.');
    }
}

// --- Rotas ---

/**
 * NOVO: Proxy de Imagem para contornar bloqueios do Roblox
 */
app.get('/api/proxy-image/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Busca a URL real da imagem na API de Thumbnails do Roblox
        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
        
        const imageUrl = thumbRes.data?.data?.[0]?.imageUrl;

        if (imageUrl) {
            // Redireciona o navegador para a imagem final do CDN do Roblox
            return res.redirect(imageUrl);
        }
        throw new Error('Imagem não encontrada');
    } catch (e) {
        // Se falhar, manda uma imagem de avatar padrão (bacon)
        res.redirect('https://tr.rbxcdn.com/30DAY-AvatarHeadshot-Png-Chid-0-W150-H150-Crop/150/150/AvatarHeadshot/Png/transparent');
    }
});

app.post('/api/auth/validate', async (req, res) => {
    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ error: 'Cookie ausente' });

    try {
        const response = await robloxApi.get('https://users.roblox.com/v1/users/authenticated', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
        });
        
        const userData = {
            id: response.data.id || response.data.userId,
            name: response.data.name,
            displayName: response.data.displayName
        };

        console.log(`[AUTH] Usuário ${userData.name} autenticado.`);
        res.json(userData);
    } catch (error) {
        res.status(401).json({ error: 'Sessão inválida.' });
    }
});

app.post('/api/friends', async (req, res) => {
    const { cookie, userId } = req.body;
    if (!cookie || !userId) return res.status(400).json({ error: 'Dados insuficientes.' });

    try {
        const friendsRes = await robloxApi.get(`https://friends.roblox.com/v1/users/${userId}/friends`, {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
        });

        const friendIds = (friendsRes.data?.data || []).map(f => f.id || f.userId);

        if (friendIds.length === 0) return res.json([]);

        // Multiget de usuários para pegar nomes atualizados
        const detailsRes = await robloxApi.post(`https://users.roblox.com/v1/users`, {
            userIds: friendIds,
            excludeBannedUsers: false
        });

        const usersDetails = detailsRes.data?.data || [];

        const formattedFriends = usersDetails.map(u => ({
            id: u.id,
            name: u.name,
            displayName: u.displayName || u.name
        }));

        console.log(`[FRIENDS] ${formattedFriends.length} amigos sincronizados.`);
        res.json(formattedFriends);

    } catch (error) {
        console.error(`[FRIENDS ERROR]`, error.message);
        res.status(500).json({ error: 'Erro ao processar lista de amigos.' });
    }
});

app.post('/api/unfriend', async (req, res) => {
    const { cookie, userIds } = req.body;
    if (!cookie || !Array.isArray(userIds)) return res.status(400).json({ error: 'Dados inválidos.' });

    const results = { success: [], errors: [] };
    
    try {
        const token = await getCsrfToken(cookie);
        
        for (const targetId of userIds) {
            try {
                await robloxApi.post(`https://friends.roblox.com/v1/users/${targetId}/unfriend`, {}, {
                    headers: {
                        'Cookie': `.ROBLOSECURITY=${cookie}`,
                        'X-CSRF-TOKEN': token,
                        'Content-Type': 'application/json'
                    }
                });
                results.success.push(targetId);
                await new Promise(r => setTimeout(r, 300)); 
            } catch (e) {
                results.errors.push(targetId);
            }
        }
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n==========================================`);
    console.log(`  SERVIDOR RODANDO NA PORTA ${PORT}`);
    console.log(`  SISTEMA DE PROXY DE FOTOS ATIVADO`);
    console.log(`==========================================\n`);
});