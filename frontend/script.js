// API Base URL - Forçar uso direto para debug
const DEFAULT_API = 'http://localhost:8001/api';
const API_BASE_URL = (window.location && window.location.port === '8005')
  ? DEFAULT_API
  : (window.location ? `${window.location.origin}/api` : DEFAULT_API);

// Backup para teste de múltiplos hosts (desabilitado temporariamente)
const BACKEND_HOSTS = [
    'http://localhost:8001/api',
    'http://127.0.0.1:8001/api'
];

let workingHost = 'http://localhost:8001/api'; // Forçar host funcionando

// Configuration constants
const CONFIG = {
    TOAST_DURATION: 3000,
    MAX_AGENT_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    DEFAULT_TIMEOUT: 10000, // 10 segundos
    CHAT_TIMEOUT: 30000,    // 30 segundos para chat
    HEALTH_CHECK_INTERVAL: 30000 // 30 segundos
};

// Utility function for fetch with timeout
async function fetchWithTimeout(url, options = {}) {
    const { timeout = CONFIG.DEFAULT_TIMEOUT, ...fetchOptions } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
                ...fetchOptions.headers
            }
        });
        
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Timeout: Operação demorou mais de ${timeout/1000} segundos`);
        }
        throw error;
    }
}

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const agentForm = document.getElementById('agent-form');
const loadingOverlay = document.getElementById('loading-overlay');
const toast = document.getElementById('toast');
const generatedCodeContainer = document.getElementById('generated-code');
const agentCodeElement = document.getElementById('agent-code');
const copyCodeBtn = document.getElementById('copy-code');
const downloadCodeBtn = document.getElementById('download-code');
const agentsGrid = document.getElementById('agents-grid');

// Global variables
let currentAgentCode = '';
let currentAgentName = '';
let agents = [];
let currentChat = { agentId: null, agentName: '', sessionId: null };
let logsAutoRefreshTimer = null;

// Função para testar conectividade simples
async function testBackendConnection() {
    try {
        console.log('🔍 Testando conexão com backend...');
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('📊 Response status:', response.status);
        console.log('📊 Response ok:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend conectado:', data);
            return true;
        } else {
            console.log('❌ Backend retornou erro:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ Erro de conexão:', error.name, error.message);
        return false;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando aplicação...');
    
    try {
        initializeTabs();
        initializeEventListeners();
        
        // Initialize integrations with debug logging
        console.log('📱 Inicializando sistema de integrações...');
        initializeIntegrations();
        initializePaymentIntegrations();
        
        // Initialize WhatsApp with delay to ensure DOM is ready
        setTimeout(() => {
            console.log('📱 Inicializando integração WhatsApp (delayed)...');
            initializeWhatsAppIntegration();
        }, 100);
        
        // Debug: Check if all integration toggles are found
        const toggles = document.querySelectorAll('.integration-toggle input[type="checkbox"]');
        console.log(`🔍 Encontrados ${toggles.length} toggles de integração:`, Array.from(toggles).map(t => t.id));
        
        // Debug: Check if all config panels exist
        const configPanels = document.querySelectorAll('[id$="-config"]');
        console.log(`🔍 Encontrados ${configPanels.length} painéis de configuração:`, Array.from(configPanels).map(p => p.id));
        
        // Verificações iniciais - testar backend
        console.log('🔧 Testando conectividade...');
        const backendConnected = await testBackendConnection();
        if (backendConnected) {
            console.log('✅ Procedendo com inicialização...');
            checkSystemHealth();
            loadAgents();
        } else {
            console.log('❌ Backend não disponível, tentando novamente...');
            setTimeout(async () => {
                const retry = await testBackendConnection();
                if (retry) {
                    checkSystemHealth();
                    loadAgents();
                }
            }, 5000);
        }
        
        
        
        // Verificação periódica de saúde do sistema
        setInterval(checkSystemHealth, CONFIG.HEALTH_CHECK_INTERVAL);
        
        console.log('✅ Aplicação inicializada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante a inicialização:', error);
        showToast('Erro durante a inicialização da aplicação', 'error');
    }
});

// System health check
async function checkSystemHealth() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (!statusIndicator || !statusText) {
        return;
    }
    
    try {
        statusIndicator.textContent = '🔄';
        statusText.textContent = 'Verificando sistema...';
        
        console.log('🔍 Verificando saúde do sistema...');
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            statusIndicator.textContent = '✓';
            statusText.textContent = `Sistema online (v${data.version || 'N/A'})`;
            statusIndicator.style.color = '#4CAF50';
            
            console.log('Sistema saudável:', data);
            
            // Verificar se há problemas reportados na resposta
            if (data.database !== 'connected') {
                showToast('Atenção: Problemas com o banco de dados detectados', 'warning');
            }
            
        } else {
            throw new Error(`Sistema indisponível (HTTP ${response.status})`);
        }
    } catch (error) {
        statusIndicator.textContent = '⚠';
        statusIndicator.style.color = '#f44336';
        
        
        if (error.name === 'AbortError') {
            statusText.textContent = 'Sistema offline (timeout)';
            console.warn('System health check timeout:', error);
            showToast('Sistema backend não responde. Verificando conectividade...', 'warning');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            statusText.textContent = 'Sistema offline (conexão)';
            console.warn('Network error during health check:', error);
            showToast('Não foi possível conectar ao backend. Verifique se está rodando na porta 8001.', 'error');
        } else {
            statusText.textContent = 'Sistema offline';
            console.warn('System health check failed:', error);
            showToast(`Sistema backend offline: ${error.message}`, 'warning');
        }
        
        // Tentar novamente em 10 segundos
        setTimeout(checkSystemHealth, 10000);
    }
}

// Tab functionality
function initializeTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Update tab content
    tabContents.forEach(content => content.classList.remove('active'));
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Load data for specific tabs
    if (tabName === 'list') {
        loadAgents();
    }
    if (tabName === 'logs') {
        startLogsAutoRefresh();
    } else {
        stopLogsAutoRefresh();
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Form submission
    if (agentForm) {
        agentForm.addEventListener('submit', generateAgentWithWhatsApp);
    }
    
    // Character counter for description
    const descriptionTextarea = document.getElementById('agent-description');
    if (descriptionTextarea) {
        descriptionTextarea.addEventListener('input', updateCharacterCounter);
    }
    
    // Code actions
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', copyAgentCode);
    }
    
    if (downloadCodeBtn) {
        downloadCodeBtn.addEventListener('click', downloadAgentCode);
    }
    
    // Toast close button
    const toastClose = document.querySelector('.toast-close');
    if (toastClose) {
        toastClose.addEventListener('click', hideToast);
    }
    
    // Search functionality
    const searchInput = document.getElementById('search-agents');
    if (searchInput) {
        searchInput.addEventListener('input', filterAgents);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-agents');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAgents);
    }

    // Chat listeners
    const chatSendBtn = document.getElementById('chat-send');
    if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);

    const chatText = document.getElementById('chat-text');
    if (chatText) {
        chatText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    const chatBackBtn = document.getElementById('chat-back-btn');
    if (chatBackBtn) chatBackBtn.addEventListener('click', () => switchTab('list'));

    const chatNewSessionBtn = document.getElementById('chat-new-session');
    if (chatNewSessionBtn) chatNewSessionBtn.addEventListener('click', resetChatSession);

    // Logs listeners
    const logsRefreshBtn = document.getElementById('logs-refresh');
    if (logsRefreshBtn) logsRefreshBtn.addEventListener('click', loadLogs);
    const logsAuto = document.getElementById('logs-autorefresh');
    if (logsAuto) logsAuto.addEventListener('change', () => {
        if (logsAuto.checked) startLogsAutoRefresh(); else stopLogsAutoRefresh();
    });
}

// Update character counter
function updateCharacterCounter() {
    const textarea = document.getElementById('agent-description');
    const counter = document.getElementById('desc-counter');
    
    if (textarea && counter) {
        const length = textarea.value.length;
        counter.textContent = length;
        
        if (length > CONFIG.MAX_DESCRIPTION_LENGTH) {
            counter.style.color = '#f44336';
        } else {
            counter.style.color = '#666';
        }
    }
}

async function generateAgentWithWhatsApp(event) {
    if (event) event.preventDefault();
    console.log('Iniciando processo de geração de agente...');

    // 1. Validar campos obrigatórios do formulário
    const agentName = document.getElementById('agent-name').value.trim();
    const specialization = document.getElementById('agent-specialization').value;
    const description = document.getElementById('agent-description').value.trim();
    const instructions = document.getElementById('agent-instructions').value.trim();

    const missingFields = [];
    if (!agentName) missingFields.push('Nome');
    if (!specialization) missingFields.push('Especialização');
    if (!description) missingFields.push('Descrição');
    if (!instructions) missingFields.push('Instruções');

    if (missingFields.length > 0) {
        showToast(`Por favor, preencha os campos obrigatórios: ${missingFields.join(', ')}`, 'error');
        // Adiciona um destaque visual aos campos vazios
        missingFields.forEach(field => {
            let element;
            if (field === 'Nome') element = document.getElementById('agent-name');
            if (field === 'Especialização') element = document.getElementById('agent-specialization');
            if (field === 'Descrição') element = document.getElementById('agent-description');
            if (field === 'Instruções') element = document.getElementById('agent-instructions');
            
            if (element) {
                element.classList.add('input-error');
                setTimeout(() => element.classList.remove('input-error'), 3000);
            }
        });
        return;
    }

    // 2. Coletar dados do formulário
    const formData = new FormData(document.getElementById('agent-form'));
    const agentData = {
        name: agentName,
        specialization: specialization,
        description: description,
        model: formData.get('model'),
        instructions: instructions,
        whatsapp_config: {},
        integrations: {}
    };

    // 3. Verificar se a integração WhatsApp está habilitada
    const enableWhatsApp = document.getElementById('enable-whatsapp').checked;

    if (enableWhatsApp) {
        const instanceName = document.getElementById('whatsapp-instance-name').value;

        // Adicionar configuração ao payload
        agentData.whatsapp_config = {
            enabled: true,
            instance_name: instanceName,
            auto_connect: true
        };

        try {
            const statusResponse = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/status`);
            const statusData = await statusResponse.json();

            if (!statusResponse.ok || (statusData.status !== 'connected' && statusData.status !== 'open')) {
                const userConfirmed = await showWhatsAppConfirmationModal();
                if (!userConfirmed) {
                    showToast('Criação do agente cancelada.', 'info');
                    return;
                }
            }
        } catch (error) {
            const userConfirmed = await showWhatsAppConfirmationModal();
            if (!userConfirmed) {
                showToast('Criação do agente cancelada.', 'info');
                return;
            }
        }
    } else {
        agentData.whatsapp_config = { enabled: false };
    }

    // 4. Chamar a função de criação de agente
    await createAgent(agentData);
}

// Load agents from API
async function loadAgents() {
    const refreshBtn = document.getElementById('refresh-agents');
    const originalBtnText = refreshBtn ? refreshBtn.textContent : '';
    
    try {
        // Visual feedback
        if (refreshBtn) {
            refreshBtn.textContent = 'Carregando...';
            refreshBtn.disabled = true;
        }
        
        console.log('Carregando agentes...');
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents`, {
            method: 'GET'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                // Nenhum agente encontrado - não é erro
                agents = [];
                displayAgents(agents);
                return;
            } else if (response.status === 500) {
                throw new Error('Erro interno do servidor');
            } else {
                throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        
        // Validar se a resposta tem o formato esperado
        if (Array.isArray(data)) {
            agents = data;
        } else if (data && Array.isArray(data.agents)) {
            agents = data.agents;
        } else {
            console.warn('Formato de resposta inesperado:', data);
            agents = [];
        }
        
        console.log(`${agents.length} agentes carregados:`, agents);
        displayAgents(agents);
        
    } catch (error) {
        console.error('Error loading agents:', error);
        
        let errorMessage = 'Erro ao carregar agentes';
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Não foi possível conectar ao servidor para carregar os agentes';
        } else if (error.message.includes('HTTP')) {
            errorMessage = `Erro do servidor: ${error.message}`;
        }
        
        showToast(errorMessage, 'error');
        
        // Em caso de erro, manter os agentes que já estavam carregados (se houver)
        if (!agents || agents.length === 0) {
            displayAgents([]); // Mostrar estado vazio
        }
        
    } finally {
        // Restaurar botão
        if (refreshBtn) {
            refreshBtn.textContent = originalBtnText;
            refreshBtn.disabled = false;
        }
    }
}

// Display agents in the grid
function displayAgents(agentsToShow) {
    if (!agentsGrid) return;
    
    if (!agentsToShow || agentsToShow.length === 0) {
        agentsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-robot" style="font-size: 64px; color: #ccc; margin-bottom: 16px;"></i>
                <h3>Nenhum agente SDK encontrado</h3>
                <p>Crie seu primeiro agente SDK na aba "Criar Agente"</p>
            </div>
        `;
        return;
    }
    
    agentsGrid.innerHTML = agentsToShow.map(agent => `
        <div class="agent-card" data-agent-id="${agent.id}">
            <div class="agent-header">
                <h3>${agent.name}</h3>
                <span class="specialization-badge ${agent.specialization}">
                    ${getSpecializationIcon(agent.specialization)} ${getSpecializationName(agent.specialization)}
                </span>
            </div>
            <div class="agent-body">
                <p class="agent-description">${agent.description}</p>
                <div class="agent-meta">
                    <span><i class="fas fa-brain"></i> ${agent.model}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(agent.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
            <div class="agent-actions">
                <button onclick="viewAgent('${agent.id}')" class="btn-secondary">
                    <i class="fas fa-eye"></i> Visualizar
                </button>
                <button onclick="openChat('${agent.id}')" class="btn-primary">
                    <i class="fas fa-comments"></i> Conversar
                </button>
                <button onclick="editAgent('${agent.id}')" class="btn-secondary">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="deleteAgent('${agent.id}')" class="btn-danger">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `).join('');
}

// Open chat for an agent
async function openChat(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
        showToast('Agente não encontrado', 'error');
        return;
    }
    currentChat.agentId = agentId;
    currentChat.agentName = agent.name;
    // Reuse existing session if any, otherwise create new
    currentChat.sessionId = currentChat.sessionId || generateSessionId();
    updateChatHeader();
    switchTab('chat');
    await loadChatHistory(agentId, currentChat.sessionId);
}

function updateChatHeader() {
    const title = document.getElementById('chat-agent-title');
    const label = document.getElementById('chat-session-id-label');
    if (title) title.innerHTML = `<i class="fas fa-comments"></i> Conversa com ${escapeHtml(currentChat.agentName)}`;
    if (label) label.textContent = `Sessão: ${currentChat.sessionId}`;
}

function generateSessionId() {
    // Simple unique ID
    return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Reset chat session in case of persistent errors
function resetChatSession() {
    if (!currentChat.agentId) return;
    
    const oldSessionId = currentChat.sessionId;
    currentChat.sessionId = generateSessionId();
    
    console.log(`Sessão resetada: ${oldSessionId} -> ${currentChat.sessionId}`);
    
    updateChatHeader();
    
    // Limpar mensagens da tela
    const container = document.getElementById('chat-messages');
    if (container) {
        container.innerHTML = '<div class="system-message">Nova sessão iniciada</div>';
    }
    
    showToast('Nova sessão de chat iniciada', 'info');
}

async function loadChatHistory(agentId, sessionId) {
    try {
        // Verificar se o agentId é válido
        if (!agentId) {
            throw new Error('ID do agente não fornecido');
        }

        const url = new URL(`${API_BASE_URL}/agents/${agentId}/history`);
        if (sessionId) url.searchParams.set('session_id', sessionId);
        url.searchParams.set('limit', '200');
        
        console.log('Carregando histórico do chat...', { agentId, sessionId, url: url.toString() });
        
        const resp = await fetchWithTimeout(url.toString(), {
            method: 'GET',
            timeout: 10000
        });
        
        if (!resp.ok) {
            if (resp.status === 404) {
                console.log('Nenhum histórico encontrado, criando nova conversa...');
                renderChatMessages([]); // Renderizar conversa vazia
                return;
            } else if (resp.status === 500) {
                throw new Error('Erro interno do servidor');
            } else {
                throw new Error(`Erro HTTP ${resp.status}: ${resp.statusText}`);
            }
        }
        
        const data = await resp.json();
        console.log('Histórico carregado:', data);
        renderChatMessages(data.messages || []);
        
    } catch (e) {
        console.error('Erro ao carregar histórico:', e);
        
        // Diferentes mensagens de erro baseadas no tipo de erro
        let errorMessage = 'Erro ao carregar histórico do chat';
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
            errorMessage = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
        } else if (e.message.includes('timeout')) {
            errorMessage = 'Timeout ao carregar histórico. Tente novamente.';
        } else if (e.message.includes('ID do agente')) {
            errorMessage = 'Agente não selecionado. Por favor, selecione um agente primeiro.';
        }
        
        showToast(errorMessage, 'error');
        
        // Renderizar conversa vazia em caso de erro
        renderChatMessages([]);
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = messages.map(m => renderMessageBubble(m)).join('');
    container.scrollTop = container.scrollHeight;
}

function renderMessageBubble(m) {
    const role = m.role || m.sender || 'assistant';
    const text = (m.content || m.text || '').toString();
    const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('pt-BR') : '';
    const cls = role === 'user' ? 'user' : (role === 'system' ? 'system' : 'assistant');
    return `
        <div class="message ${cls}">
            <div class="bubble">
                <div class="meta">${role.toUpperCase()} ${time ? '• ' + time : ''}</div>
                <div class="text">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
}

async function sendChatMessage() {
    if (!currentChat.agentId) {
        showToast('Selecione um agente para conversar', 'warning');
        return;
    }
    
    const input = document.getElementById('chat-text');
    const container = document.getElementById('chat-messages');
    const text = (input?.value || '').trim();
    if (!text) {
        showToast('Digite uma mensagem antes de enviar', 'warning');
        return;
    }
    
    // Desabilitar input durante o envio
    const sendButton = document.getElementById('chat-send');
    const originalButtonText = sendButton ? sendButton.textContent : '';
    
    try {
        // Feedback visual de que a mensagem está sendo enviada
        if (sendButton) {
            sendButton.textContent = 'Enviando...';
            sendButton.disabled = true;
        }
        if (input) {
            input.disabled = true;
        }
        
        console.log('Enviando mensagem...', { 
            agentId: currentChat.agentId, 
            sessionId: currentChat.sessionId, 
            message: text 
        });
        
        // Adicionar mensagem do usuário imediatamente (UI otimista)
        if (container) {
            container.insertAdjacentHTML('beforeend', renderMessageBubble({ 
                role: 'user', 
                content: text, 
                created_at: new Date().toISOString() 
            }));
            container.scrollTop = container.scrollHeight;
        }
        
        // Limpar input imediatamente
        input.value = '';

        // Verificar se todos os dados necessários estão presentes
        if (!currentChat.agentId || !currentChat.sessionId) {
            throw new Error('Dados da sessão incompletos');
        }

        const requestBody = { 
            message: text, 
            session_id: currentChat.sessionId 
        };
        
        console.log('Enviando requisição:', requestBody);
        
        const resp = await fetchWithTimeout(`${API_BASE_URL}/agents/${currentChat.agentId}/chat`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            timeout: CONFIG.CHAT_TIMEOUT
        });
        
        if (!resp.ok) {
            let errorMessage = 'Falha ao enviar mensagem';
            
            if (resp.status === 404) {
                errorMessage = 'Agente não encontrado';
            } else if (resp.status === 400) {
                const errorData = await resp.json().catch(() => ({}));
                errorMessage = errorData.detail || 'Dados da mensagem inválidos';
            } else if (resp.status === 500) {
                errorMessage = 'Erro interno do servidor';
            } else if (resp.status === 503) {
                errorMessage = 'Serviço temporariamente indisponível';
            }
            
            throw new Error(`${errorMessage} (HTTP ${resp.status})`);
        }
        
        const data = await resp.json();
        console.log('Resposta recebida:', data);
        
        // Renderizar todas as mensagens (incluindo a resposta do agente)
        if (data.messages && Array.isArray(data.messages)) {
            renderChatMessages(data.messages);
        } else {
            console.warn('Formato de resposta inesperado:', data);
            showToast('Mensagem enviada, mas houve um problema ao carregar a resposta', 'warning');
        }
        
    } catch (e) {
        console.error('Erro ao enviar mensagem:', e);
        
        // Diferentes mensagens de erro baseadas no tipo de erro
        let errorMessage = 'Erro ao enviar mensagem';
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
            errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
        } else if (e.message.includes('timeout')) {
            errorMessage = 'Timeout ao enviar mensagem. O agente pode estar sobrecarregado.';
        } else if (e.message.includes('Dados da sessão')) {
            errorMessage = 'Erro na sessão. Tente iniciar uma nova conversa.';
        } else if (e.message.includes('HTTP')) {
            errorMessage = e.message; // Usar mensagem detalhada do servidor
        }
        
        showToast(errorMessage, 'error');
        
        // Remover a mensagem do usuário que foi adicionada otimisticamente
        const lastMessage = container?.querySelector('.message.user:last-child');
        if (lastMessage) {
            lastMessage.remove();
        }
        
        // Restaurar o texto no input
        if (input) {
            input.value = text;
        }
        
    } finally {
        // Reabilitar controles
        if (sendButton) {
            sendButton.textContent = originalButtonText;
            sendButton.disabled = false;
        }
        if (input) {
            input.disabled = false;
            input.focus(); // Focar novamente no input
        }
    }
}

function escapeHtml(str) {
    return str.replace(/[&<>"]+/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

// Logs
function buildLogsQuery() {
    const level = document.getElementById('logs-level')?.value || '';
    const agentId = document.getElementById('logs-agent-id')?.value || '';
    const sessionId = document.getElementById('logs-session-id')?.value || '';
    const since = document.getElementById('logs-since')?.value || '';
    const limit = document.getElementById('logs-limit')?.value || '200';
    const url = new URL(`${API_BASE_URL}/logs`);
    if (level) url.searchParams.set('level', level);
    if (agentId) url.searchParams.set('agent_id', agentId);
    if (sessionId) url.searchParams.set('session_id', sessionId);
    if (since) url.searchParams.set('since', new Date(since).toISOString());
    if (limit) url.searchParams.set('limit', limit);
    return url.toString();
}

async function loadLogs() {
    try {
        const resp = await fetch(buildLogsQuery());
        if (!resp.ok) {
            if (resp.status === 404) {
                renderLogs(['Nenhum log encontrado. O arquivo de log ainda não foi criado.']);
                return;
            }
            throw new Error(`Falha ao carregar logs: ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json();
        const logs = data.logs || data || [];
        if (logs.length === 0) {
            renderLogs(['Nenhum log disponível no momento.']);
        } else {
            renderLogs(logs);
        }
    } catch (e) {
        console.error('Erro ao carregar logs:', e);
        renderLogs([`Erro ao conectar com o servidor: ${e.message}`]);
        showToast('Erro ao carregar logs', 'error');
    }
}

function renderLogs(lines) {
    const out = document.getElementById('logs-output');
    if (!out) return;
    if (!Array.isArray(lines)) lines = [];
    out.innerHTML = lines.map(l => `<pre class="log-line">${escapeHtml(String(l))}</pre>`).join('');
    out.scrollTop = out.scrollHeight;
}

function startLogsAutoRefresh() {
    const auto = document.getElementById('logs-autorefresh');
    if (!auto || !auto.checked) return loadLogs();
    stopLogsAutoRefresh();
    loadLogs();
    logsAutoRefreshTimer = setInterval(loadLogs, 3000);
}

function stopLogsAutoRefresh() {
    if (logsAutoRefreshTimer) {
        clearInterval(logsAutoRefreshTimer);
        logsAutoRefreshTimer = null;
    }
}

// Get specialization icon
function getSpecializationIcon(specialization) {
    const icons = {
        'customer_service': '🎧',
        'scheduling': '📅',
        'sales': '💰'
    };
    return icons[specialization] || '🤖';
}

// Get specialization name
function getSpecializationName(specialization) {
    const names = {
        'customer_service': 'Atendimento',
        'scheduling': 'Agendamento',
        'sales': 'Vendas'
    };
    return names[specialization] || 'Geral';
}

// Filter agents based on search
function filterAgents() {
    const searchInput = document.getElementById('search-agents');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase();
    
    if (!query) {
        displayAgents(agents);
        return;
    }
    
    const filteredAgents = agents.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.specialization.toLowerCase().includes(query)
    );
    
    displayAgents(filteredAgents);
}

// Agent actions
async function viewAgent(agentId) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes do agente');
        }
        
        const agent = await response.json();
        showAgentDetailsModal(agent);
        
    } catch (error) {
        console.error('Erro ao visualizar agente:', error);
        showToast('Erro ao carregar detalhes do agente', 'error');
    }
}

function showAgentDetailsModal(agent) {
    const modal = createAgentDetailsModal(agent);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function createAgentDetailsModal(agent) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content agent-details-modal">
            <div class="modal-header">
                <h3><i class="fas fa-robot"></i> Detalhes do Agente</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="agent-info-grid">
                    <div class="info-section">
                        <h4>Informações Básicas</h4>
                        <div class="info-item">
                            <label>Nome:</label>
                            <span>${agent.name}</span>
                        </div>
                        <div class="info-item">
                            <label>Especialização:</label>
                            <span class="specialization-badge ${agent.specialization}">
                                ${getSpecializationIcon(agent.specialization)} ${getSpecializationName(agent.specialization)}
                            </span>
                        </div>
                        <div class="info-item">
                            <label>Modelo:</label>
                            <span>${agent.model}</span>
                        </div>
                        <div class="info-item">
                            <label>Status:</label>
                            <span class="status-badge ${agent.status}">${agent.status}</span>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h4>Descrição</h4>
                        <p class="agent-description-text">${agent.description}</p>
                    </div>
                    
                    <div class="info-section">
                        <h4>Instruções</h4>
                        <pre class="agent-instructions">${agent.instructions}</pre>
                    </div>
                    
                    <div class="info-section">
                        <h4>Integrações</h4>
                        <div class="integrations-status">
                            <div class="integration-item">
                                <span class="integration-label">WhatsApp:</span>
                                <span class="integration-status ${agent.whatsapp_config?.enabled ? 'enabled' : 'disabled'}">
                                    ${agent.whatsapp_config?.enabled ? '✅ Ativado' : '❌ Desativado'}
                                </span>
                            </div>
                            <div class="integration-item">
                                <span class="integration-label">Agendamento:</span>
                                <span class="integration-status ${agent.scheduling_config?.platform ? 'enabled' : 'disabled'}">
                                    ${agent.scheduling_config?.platform ? '✅ ' + agent.scheduling_config.platform : '❌ Desativado'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="editAgent('${agent.id}')" class="btn-primary">
                    <i class="fas fa-edit"></i> Editar Agente
                </button>
                <button onclick="openChat('${agent.id}')" class="btn-secondary">
                    <i class="fas fa-comments"></i> Conversar
                </button>
                <button onclick="manageIntegrations('${agent.id}')" class="btn-secondary">
                    <i class="fas fa-cogs"></i> Gerenciar Integrações
                </button>
                <button onclick="closeModal()" class="btn-cancel">Fechar</button>
            </div>
        </div>
    `;
    return modal;
}

function closeModal() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.remove();
    });
}

async function editAgent(agentId) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar dados do agente');
        }
        
        const agent = await response.json();
        showEditAgentModal(agent);
        
    } catch (error) {
        console.error('Erro ao abrir edição:', error);
        showToast('Erro ao carregar dados para edição', 'error');
    }
}

function showEditAgentModal(agent) {
    const modal = createEditAgentModal(agent);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function createEditAgentModal(agent) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content edit-agent-modal">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Editar Agente</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="edit-agent-form" onsubmit="handleEditAgentSubmit(event, '${agent.id}')">
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="edit-agent-name">Nome do Agente *</label>
                            <input type="text" id="edit-agent-name" name="name" value="${agent.name}" required maxlength="100">
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-agent-specialization">Especialização *</label>
                            <select id="edit-agent-specialization" name="specialization" required>
                                <option value="customer_service" ${agent.specialization === 'customer_service' ? 'selected' : ''}>🎧 Atendimento ao Cliente</option>
                                <option value="scheduling" ${agent.specialization === 'scheduling' ? 'selected' : ''}>📅 Agendamento de Serviços</option>
                                <option value="sales" ${agent.specialization === 'sales' ? 'selected' : ''}>💰 Processo de Vendas</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-agent-model">Modelo de IA *</label>
                            <select id="edit-agent-model" name="model" required>
                                <option value="anthropic/claude-3-haiku" ${agent.model === 'anthropic/claude-3-haiku' ? 'selected' : ''}>Claude 3 Haiku (Rápido)</option>
                                <option value="anthropic/claude-3-sonnet" ${agent.model === 'anthropic/claude-3-sonnet' ? 'selected' : ''}>Claude 3 Sonnet (Balanceado)</option>
                                <option value="openai/gpt-3.5-turbo" ${agent.model === 'openai/gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
                                <option value="openai/gpt-4" ${agent.model === 'openai/gpt-4' ? 'selected' : ''}>GPT-4</option>
                                <option value="groq/mixtral-8x7b" ${agent.model === 'groq/mixtral-8x7b' ? 'selected' : ''}>Mixtral 8x7B (Groq)</option>
                            </select>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="edit-agent-description">Descrição *</label>
                            <textarea id="edit-agent-description" name="description" rows="3" required maxlength="500">${agent.description}</textarea>
                            <div class="char-counter">
                                <span id="edit-desc-counter">${agent.description.length}</span>/500
                            </div>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="edit-agent-instructions">Instruções Detalhadas *</label>
                            <textarea id="edit-agent-instructions" name="instructions" rows="6" required placeholder="Descreva como o agente deve se comportar...">${agent.instructions}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="edit-enable-whatsapp" ${agent.whatsapp_config?.enabled ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                Integração WhatsApp
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-whatsapp-instance-name">Nome da Instância WhatsApp</label>
                            <input type="text" id="edit-whatsapp-instance-name" value="${agent.whatsapp_config?.instance_name || agent.name}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn-primary" id="save-agent-btn">
                        <i class="fas fa-save"></i> Salvar Alterações
                    </button>
                    <button type="button" onclick="closeModal()" class="btn-cancel">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    // Add character counter for description
    setTimeout(() => {
        const descTextarea = modal.querySelector('#edit-agent-description');
        const counter = modal.querySelector('#edit-desc-counter');
        if (descTextarea && counter) {
            descTextarea.addEventListener('input', () => {
                const length = descTextarea.value.length;
                counter.textContent = length;
                counter.style.color = length > 500 ? '#f44336' : '#666';
            });
        }
    }, 100);
    
    return modal;
}

async function handleEditAgentSubmit(event, agentId) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const agentData = {
        name: formData.get('name'),
        specialization: formData.get('specialization'),
        description: formData.get('description'),
        model: formData.get('model'),
        instructions: formData.get('instructions'),
        whatsapp_config: {},
        scheduling_config: {}
    };
    
    // Collect WhatsApp configuration
    const enableWhatsApp = document.getElementById('edit-enable-whatsapp');
    const whatsappInstanceEl = document.getElementById('edit-whatsapp-instance-name');
    
    if (enableWhatsApp && enableWhatsApp.checked) {
        agentData.whatsapp_config = {
            enabled: true,
            instance_name: whatsappInstanceEl?.value || agentData.name,
            auto_connect: true
        };
    } else {
        agentData.whatsapp_config = {
            enabled: false
        };
    }
    
    const saveBtn = document.getElementById('save-agent-btn');
    const originalText = saveBtn.textContent;
    
    try {
        saveBtn.textContent = 'Salvando...';
        saveBtn.disabled = true;
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}`, {
            method: 'PUT',
            body: JSON.stringify(agentData),
            timeout: 30000
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao atualizar agente');
        }
        
        const result = await response.json();
        showToast('Agente atualizado com sucesso!', 'success');
        closeModal();
        loadAgents(); // Reload the agents list
        
    } catch (error) {
        console.error('Erro ao atualizar agente:', error);
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function manageIntegrations(agentId) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}/integrations`);
        if (!response.ok) {
            throw new Error('Erro ao carregar integrações do agente');
        }
        
        const integrationData = await response.json();
        showIntegrationsModal(agentId, integrationData);
        
    } catch (error) {
        console.error('Erro ao carregar integrações:', error);
        showToast('Erro ao carregar integrações', 'error');
    }
}

function showIntegrationsModal(agentId, integrationData) {
    const modal = createIntegrationsModal(agentId, integrationData);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function createIntegrationsModal(agentId, integrationData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content integrations-modal">
            <div class="modal-header">
                <h3><i class="fas fa-cogs"></i> Gerenciar Integrações</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="integrations-form" onsubmit="handleIntegrationsSubmit(event, '${agentId}')">
                <div class="modal-body">
                    <div class="integrations-grid">
                        <div class="integration-section">
                            <h4><i class="fab fa-whatsapp"></i> WhatsApp Business</h4>
                            <div class="integration-controls">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="int-enable-whatsapp" ${integrationData.whatsapp_config?.enabled ? 'checked' : ''}>
                                    <span class="checkmark"></span>
                                    Ativar integração WhatsApp
                                </label>
                                
                                <div class="form-group">
                                    <label for="int-whatsapp-instance">Nome da Instância:</label>
                                    <input type="text" id="int-whatsapp-instance" value="${integrationData.whatsapp_config?.instance_name || ''}" placeholder="Nome da instância WhatsApp">
                                </div>
                                
                                <div class="integration-status">
                                    <span class="status-label">Status:</span>
                                    <span class="status-indicator ${integrationData.integration_status?.whatsapp?.status || 'inactive'}">
                                        ${integrationData.integration_status?.whatsapp?.enabled ? '✅ Ativo' : '❌ Inativo'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="integration-section">
                            <h4><i class="fas fa-calendar-alt"></i> Sistema de Agendamento</h4>
                            <div class="integration-controls">
                                <div class="form-group">
                                    <label for="int-scheduling-platform">Plataforma:</label>
                                    <select id="int-scheduling-platform">
                                        <option value="">Selecione uma plataforma</option>
                                        <option value="calendly" ${integrationData.scheduling_config?.platform === 'calendly' ? 'selected' : ''}>Calendly</option>
                                        <option value="acuity" ${integrationData.scheduling_config?.platform === 'acuity' ? 'selected' : ''}>Acuity Scheduling</option>
                                        <option value="simplybook" ${integrationData.scheduling_config?.platform === 'simplybook' ? 'selected' : ''}>SimplyBook.me</option>
                                        <option value="google" ${integrationData.scheduling_config?.platform === 'google' ? 'selected' : ''}>Google Calendar</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="int-scheduling-api-key">API Key:</label>
                                    <input type="password" id="int-scheduling-api-key" value="${integrationData.scheduling_config?.api_key || ''}" placeholder="Chave de API da plataforma">
                                </div>
                                
                                <div class="integration-status">
                                    <span class="status-label">Status:</span>
                                    <span class="status-indicator ${integrationData.integration_status?.scheduling?.status || 'inactive'}">
                                        ${integrationData.integration_status?.scheduling?.enabled ? '✅ Ativo' : '❌ Inativo'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn-primary" id="save-integrations-btn">
                        <i class="fas fa-save"></i> Salvar Integrações
                    </button>
                    <button type="button" onclick="testAgentIntegrations('${agentId}')" class="btn-secondary">
                        <i class="fas fa-flask"></i> Testar Integrações
                    </button>
                    <button type="button" onclick="closeModal()" class="btn-cancel">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    return modal;
}

async function handleIntegrationsSubmit(event, agentId) {
    event.preventDefault();
    
    const integrationData = {
        whatsapp_config: {},
        scheduling_config: {},
        integration_status: {}
    };
    
    // Collect WhatsApp configuration
    const enableWhatsApp = document.getElementById('int-enable-whatsapp');
    const whatsappInstance = document.getElementById('int-whatsapp-instance');
    
    integrationData.whatsapp_config = {
        enabled: enableWhatsApp?.checked || false,
        instance_name: whatsappInstance?.value || '',
        auto_connect: enableWhatsApp?.checked || false
    };
    
    // Collect scheduling configuration
    const schedulingPlatform = document.getElementById('int-scheduling-platform');
    const schedulingApiKey = document.getElementById('int-scheduling-api-key');
    
    integrationData.scheduling_config = {
        platform: schedulingPlatform?.value || '',
        api_key: schedulingApiKey?.value || ''
    };
    
    const saveBtn = document.getElementById('save-integrations-btn');
    const originalText = saveBtn.textContent;
    
    try {
        saveBtn.textContent = 'Salvando...';
        saveBtn.disabled = true;
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}/integrations`, {
            method: 'PUT',
            body: JSON.stringify(integrationData),
            timeout: 30000
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao atualizar integrações');
        }
        
        const result = await response.json();
        showToast('Integrações atualizadas com sucesso!', 'success');
        closeModal();
        
    } catch (error) {
        console.error('Erro ao atualizar integrações:', error);
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function testAgentIntegrations(agentId) {
    showToast('Testando integrações...', 'info');
    
    try {
        // Test WhatsApp integration
        const whatsappEnabled = document.getElementById('int-enable-whatsapp')?.checked;
        if (whatsappEnabled) {
            const instanceName = document.getElementById('int-whatsapp-instance')?.value;
            if (instanceName) {
                await testWhatsAppIntegration(instanceName);
            }
        }
        
        // Test scheduling integration
        const schedulingPlatform = document.getElementById('int-scheduling-platform')?.value;
        if (schedulingPlatform) {
            await testSchedulingIntegration(schedulingPlatform);
        }
        
        showToast('Testes de integração concluídos!', 'success');
        
    } catch (error) {
        console.error('Erro nos testes:', error);
        showToast('Erro durante os testes de integração', 'error');
    }
}

async function testWhatsAppIntegration(instanceName) {
    try {
        // Primeiro forçar sincronização
        try {
            await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/sync-status`, {
                method: 'POST'
            });
        } catch (syncError) {
            console.log('Erro na sincronização durante teste:', syncError);
        }
        
        // Aguardar um pouco e verificar status
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Aumentar o timeout para 60 segundos, pois a criação da instância pode ser demorada
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/status/local`, {
            timeout: 60000 // 60 segundos
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.connected || result.status === 'open') {
                showToast('WhatsApp: Conectado ✅', 'success');
            } else if (result.status === 'not_found') {
                showToast('WhatsApp: Instância não encontrada ❌', 'warning');
            } else {
                showToast(`WhatsApp: ${result.status || 'Desconectado'} ❌`, 'warning');
            }
        }
    } catch (error) {
        showToast('WhatsApp: Erro no teste ❌', 'error');
    }
}

async function testSchedulingIntegration(platform) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/integrations/${platform}/test`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        
        if (response.ok) {
            showToast(`${platform}: Teste realizado ✅`, 'success');
        } else {
            showToast(`${platform}: Falha no teste ❌`, 'warning');
        }
    } catch (error) {
        showToast(`${platform}: Erro no teste ❌`, 'error');
    }
}

async function deleteAgent(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
        showToast('Agente não encontrado', 'error');
        return;
    }
    
    showDeleteConfirmationModal(agentId, agent.name);
}

function showDeleteConfirmationModal(agentId, agentName) {
    const modal = createDeleteConfirmationModal(agentId, agentName);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function createDeleteConfirmationModal(agentId, agentName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content delete-confirmation-modal">
            <div class="modal-header">
                <h3><i class="fas fa-exclamation-triangle" style="color: #ff453a;"></i> Confirmar Exclusão</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="delete-warning">
                    <p><strong>Tem certeza que deseja excluir o agente "${agentName}"?</strong></p>
                    
                    <div class="warning-details">
                        <p>Esta ação irá:</p>
                        <ul>
                            <li><i class="fas fa-trash"></i> Remover o agente permanentemente</li>
                            <li><i class="fas fa-comments"></i> Deletar todo o histórico de conversas</li>
                            <li><i class="fab fa-whatsapp"></i> Desconectar integrações WhatsApp</li>
                            <li><i class="fas fa-database"></i> Remover todas as instâncias relacionadas</li>
                        </ul>
                    </div>
                    
                    <div class="danger-notice">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>Esta ação não pode ser desfeita!</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-danger delete-confirm-btn" data-agent-id="${agentId}" data-agent-name="${agentName}">
                    <i class="fas fa-trash"></i> Confirmar Exclusão
                </button>
                <button onclick="closeModal()" class="btn-cancel">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    `;
    
    // Adicionar event listener para o botão de confirmação
    const confirmBtn = modal.querySelector('.delete-confirm-btn');
    confirmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`[MODAL] Botão de confirmação clicado para agente: ${agentId}`);
        confirmDeleteAgent(agentId, agentName);
    });
    
    return modal;
}

async function confirmDeleteAgent(agentId, agentName) {
    console.log(`[DELETE] Iniciando exclusão do agente: ${agentId} (${agentName})`);
    
    const deleteBtn = document.querySelector('.delete-confirm-btn');
    const originalText = deleteBtn.textContent;
    
    try {
        // Mostrar estado de carregamento
        deleteBtn.textContent = 'Excluindo...';
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        
        console.log(`[DELETE] Fazendo requisição DELETE para: ${API_BASE_URL}/agents/${agentId}`);
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}`, {
            method: 'DELETE',
            timeout: 30000
        });
        
        console.log(`[DELETE] Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao excluir agente');
        }
        
        const result = await response.json();
        console.log(`[DELETE] Response data:`, result);
        
        // Mostrar detalhes da exclusão
        const details = result.details || {};
        let successMessage = `Agente "${agentName}" excluído com sucesso!`;
        
        if (details.chat_messages_deleted > 0) {
            successMessage += `\n• ${details.chat_messages_deleted} mensagem(s) removida(s)`;
        }
        if (details.whatsapp_instances_deleted > 0) {
            successMessage += `\n• ${details.whatsapp_instances_deleted} instância(s) WhatsApp removida(s)`;
        }
        if (result.evolution_api_deleted) {
            successMessage += `\n• Instância removida da Evolution API`;
        }
        
        showToast(successMessage, 'success');
        
        // Fechar modal e recarregar lista
        closeModal();
        loadAgents();
        
        // Se estiver em uma conversa com este agente, limpar o chat
        if (currentChat.agentId === agentId) {
            currentChat.agentId = null;
            currentChat.messages = [];
            displayChatMessages();
        }
        
    } catch (error) {
        console.error(`[DELETE] Erro ao excluir agente ${agentId}:`, error);
        console.error(`[DELETE] Error stack:`, error.stack);
        showToast('Erro ao excluir agente: ' + error.message, 'error');
    } finally {
        deleteBtn.textContent = originalText;
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Confirmar Exclusão';
    }
}

// Show generated code
function showGeneratedCode() {
    if (generatedCodeContainer && agentCodeElement && currentAgentCode) {
        agentCodeElement.textContent = currentAgentCode;
        generatedCodeContainer.style.display = 'block';
        generatedCodeContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

// Copy agent code to clipboard
function copyAgentCode() {
    if (currentAgentCode) {
        navigator.clipboard.writeText(currentAgentCode).then(() => {
            showToast('Código copiado para a área de transferência!', 'success');
        }).catch(() => {
            showToast('Erro ao copiar código', 'error');
        });
    }
}

// Download agent code
function downloadAgentCode() {
    if (currentAgentCode && currentAgentName) {
        const blob = new Blob([currentAgentCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentAgentName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_agent_sdk.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Download iniciado!', 'success');
    }
}

// Loading overlay
function showLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    if (!toast) return;
    
    const toastMessage = toast.querySelector('.toast-message');
    if (toastMessage) {
        toastMessage.textContent = message;
    }
    
    // Set toast type
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    // Auto-hide after duration
    setTimeout(() => {
        hideToast();
    }, CONFIG.TOAST_DURATION);
}

function hideToast() {
    if (toast) {
        toast.style.display = 'none';
    }
}

// Integration Management System
function initializeIntegrations() {
    initializeIntegrationToggles();
    initializeIntegrationForms();
    loadIntegrationSettings();
}

// Initialize integration toggle switches - TODOS OS TOGGLES
function initializeIntegrationToggles() {
    console.log('🔧 Inicializando toggles de integração...');
    
    // Use setTimeout to ensure DOM is fully loaded
    setTimeout(() => {
        const integrationToggles = document.querySelectorAll('.integration-toggle input[type="checkbox"]');
        console.log(`📋 Encontrados ${integrationToggles.length} toggles:`, Array.from(integrationToggles).map(t => t.id));
        
        integrationToggles.forEach((toggle, index) => {
            console.log(`🔄 Configurando toggle ${index + 1}: ${toggle.id}`);
            
            // Clear any existing event listeners
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);
            
            newToggle.addEventListener('change', function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                const integrationName = this.id.replace('enable-', '');
                const configSection = document.getElementById(`${integrationName}-config`);
                
                console.log(`🎯 Toggle ${this.id} acionado:`, this.checked);
                console.log(`🔍 Buscando painel: ${integrationName}-config`);
                
                if (configSection) {
                    console.log(`✅ Painel encontrado: ${configSection.id}`);
                    
                    if (this.checked) {
                        // Show panel
                        configSection.style.display = 'block';
                        configSection.style.visibility = 'visible';
                        configSection.style.opacity = '1';
                        configSection.style.maxHeight = '1000px';
                        configSection.style.overflow = 'visible';
                        configSection.style.transition = 'all 0.3s ease-out';
                        
                        console.log(`🟢 Painel ${integrationName} ABERTO`);
                        
                        // Específico para WhatsApp: preencher nome da instância automaticamente
                        if (integrationName === 'whatsapp') {
                            updateWhatsAppInstanceName();
                        }
                        
                        showToast(`Integração ${getIntegrationDisplayName(integrationName)} ativada`, 'success');
                    } else {
                        // Hide panel
                        configSection.style.display = 'none';
                        configSection.style.visibility = 'hidden';
                        configSection.style.opacity = '0';
                        configSection.style.maxHeight = '0px';
                        configSection.style.overflow = 'hidden';
                        
                        console.log(`🔴 Painel ${integrationName} FECHADO`);
                        showToast(`Integração ${getIntegrationDisplayName(integrationName)} desativada`, 'info');
                    }
                    
                    saveIntegrationState(integrationName, this.checked);
                } else {
                    console.error(`❌ ERRO: Painel ${integrationName}-config NÃO ENCONTRADO!`);
                    
                    // List all available config panels for debugging
                    const allConfigs = Array.from(document.querySelectorAll('[id$="-config"]'));
                    console.error('📋 Painéis disponíveis:', allConfigs.map(el => el.id));
                    
                    showToast(`Erro: Painel ${integrationName} não encontrado`, 'error');
                }
            });
            
            console.log(`✅ Toggle ${toggle.id} configurado com sucesso`);
        });
        
        console.log('🎉 Todos os toggles configurados!');
    }, 100);
}

// Initialize integration configuration forms
function initializeIntegrationForms() {
    // Test integration buttons
    const testButtons = document.querySelectorAll('.test-integration');
    testButtons.forEach(button => {
        button.addEventListener('click', function() {
            const integration = this.dataset.integration;
            testIntegration(integration);
        });
    });
    
    // Save configuration buttons
    const saveButtons = document.querySelectorAll('.save-integration');
    saveButtons.forEach(button => {
        button.addEventListener('click', function() {
            const integration = this.dataset.integration;
            saveIntegrationConfig(integration);
        });
    });
    
    // Auto-save on input change with debounce
    const configInputs = document.querySelectorAll('.integration-config input, .integration-config select');
    configInputs.forEach(input => {
        let timeout;
        input.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const integration = this.closest('.integration-config').id.replace('-config', '');
                autoSaveIntegrationConfig(integration);
            }, 1000);
        });
    });
}

// Get display name for integrations - COMPLETO
function getIntegrationDisplayName(integrationName) {
    const names = {
        'whatsapp': 'WhatsApp Business',
        'payments': 'APIs de Pagamento',
        'scheduling': 'Plataformas de Agendamento', 
        'sales': 'CRM e Sistemas de Vendas',
        'support': 'Sistemas de Atendimento',
        'calendly': 'Calendly',
        'hubspot': 'HubSpot',
        'zendesk': 'Zendesk',
        'acuity': 'Acuity Scheduling',
        'salesforce': 'Salesforce',
        'intercom': 'Intercom',
        'pipedrive': 'Pipedrive',
        'freshdesk': 'Freshdesk',
        'simplybook': 'SimplyBook.me'
    };
    return names[integrationName] || integrationName;
}

// Test integration functionality
async function testIntegration(integration) {
    const testButton = document.querySelector(`[data-integration="${integration}"].test-integration`);
    const originalText = testButton.textContent;
    
    try {
        testButton.textContent = 'Testando...';
        testButton.disabled = true;
        
        // Collect configuration data
        const config = getIntegrationConfig(integration);
        
        // Validate required fields
        if (!validateIntegrationConfig(integration, config)) {
            showToast('Preencha todos os campos obrigatórios antes de testar', 'error');
            return;
        }
        
        // Call actual backend API test endpoint
        const response = await fetch(`${API_BASE_URL}/integrations/${integration}/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro na conexão');
        }
        
        const result = await response.json();
        
        showToast(`Teste da integração ${getIntegrationDisplayName(integration)} realizado com sucesso!`, 'success');
        
        // Update integration status
        updateIntegrationStatus(integration, 'connected');
        
        // Log test result for debugging
        console.log('Integration test result:', result);
        
    } catch (error) {
        console.error('Integration test failed:', error);
        showToast(`Erro no teste: ${error.message}`, 'error');
        updateIntegrationStatus(integration, 'error');
    } finally {
        testButton.textContent = originalText;
        testButton.disabled = false;
    }
}


// Get integration configuration data
function getIntegrationConfig(integration) {
    const configSection = document.getElementById(`${integration}-config`);
    if (!configSection) return {};
    
    const config = {};
    const inputs = configSection.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            config[input.name || input.id] = input.checked;
        } else {
            config[input.name || input.id] = input.value;
        }
    });
    
    return config;
}

// Validate integration configuration
function validateIntegrationConfig(integration, config) {
    const requiredFields = {
        'whatsapp': ['whatsapp-token', 'whatsapp-phone'],
        'calendly': ['calendly-token'],
        'hubspot': ['hubspot-token'],
        'zendesk': ['zendesk-subdomain', 'zendesk-token'],
        'acuity': ['acuity-user-id', 'acuity-api-key'],
        'salesforce': ['salesforce-client-id', 'salesforce-client-secret'],
        'intercom': ['intercom-token'],
        'pipedrive': ['pipedrive-token'],
        'freshdesk': ['freshdesk-subdomain', 'freshdesk-token'],
        'simplybook': ['simplybook-company', 'simplybook-token']
    };
    
    const required = requiredFields[integration] || [];
    
    for (const field of required) {
        if (!config[field] || config[field].trim() === '') {
            return false;
        }
    }
    
    return true;
}

// Save integration configuration
async function saveIntegrationConfig(integration) {
    try {
        const config = getIntegrationConfig(integration);
        
        if (!validateIntegrationConfig(integration, config)) {
            showToast('Preencha todos os campos obrigatórios', 'error');
            return;
        }
        
        // Save to localStorage for now (replace with API call when backend is ready)
        localStorage.setItem(`integration_${integration}`, JSON.stringify(config));
        
        showToast(`Configuração da integração ${getIntegrationDisplayName(integration)} salva com sucesso!`, 'success');
        
        updateIntegrationStatus(integration, 'configured');
        
    } catch (error) {
        console.error('Error saving integration config:', error);
        showToast('Erro ao salvar configuração', 'error');
    }
}

// Auto-save integration configuration
function autoSaveIntegrationConfig(integration) {
    const config = getIntegrationConfig(integration);
    localStorage.setItem(`integration_${integration}_draft`, JSON.stringify(config));
}

// Load integration settings from storage
function loadIntegrationSettings() {
    const integrations = ['whatsapp', 'calendly', 'hubspot', 'zendesk', 'acuity', 'salesforce', 'intercom', 'pipedrive', 'freshdesk', 'simplybook'];
    
    integrations.forEach(integration => {
        // Load saved configuration
        const savedConfig = localStorage.getItem(`integration_${integration}`);
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                loadIntegrationConfig(integration, config);
                
                // Enable the integration toggle
                const toggle = document.getElementById(`enable-${integration}`);
                if (toggle) {
                    toggle.checked = true;
                    toggle.dispatchEvent(new Event('change'));
                }
                
                updateIntegrationStatus(integration, 'configured');
            } catch (error) {
                console.error(`Error loading config for ${integration}:`, error);
            }
        }
        
        // Load draft configuration
        const draftConfig = localStorage.getItem(`integration_${integration}_draft`);
        if (draftConfig && !savedConfig) {
            try {
                const config = JSON.parse(draftConfig);
                loadIntegrationConfig(integration, config);
            } catch (error) {
                console.error(`Error loading draft config for ${integration}:`, error);
            }
        }
    });
}

// Load configuration into form fields
function loadIntegrationConfig(integration, config) {
    const configSection = document.getElementById(`${integration}-config`);
    if (!configSection) return;
    
    Object.keys(config).forEach(key => {
        const input = configSection.querySelector(`#${key}, [name="${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = config[key];
            } else {
                input.value = config[key];
            }
        }
    });
}

// Save integration enabled/disabled state
function saveIntegrationState(integration, enabled) {
    localStorage.setItem(`integration_${integration}_enabled`, enabled.toString());
}

// Update integration status indicator
function updateIntegrationStatus(integration, status) {
    const statusElement = document.querySelector(`[data-integration="${integration}"] .integration-status`);
    if (!statusElement) return;
    
    const statusConfig = {
        'disconnected': { text: 'Desconectado', class: 'status-disconnected', icon: '⚪' },
        'configured': { text: 'Configurado', class: 'status-configured', icon: '🟡' },
        'connected': { text: 'Conectado', class: 'status-connected', icon: '🟢' },
        'error': { text: 'Erro', class: 'status-error', icon: '🔴' }
    };
    
    const config = statusConfig[status] || statusConfig['disconnected'];
    
    statusElement.textContent = `${config.icon} ${config.text}`;
    statusElement.className = `integration-status ${config.class}`;
}

// Integration dashboard functionality
function updateIntegrationDashboard() {
    const dashboardStats = document.getElementById('integration-stats');
    if (!dashboardStats) return;
    
    const integrations = ['whatsapp', 'calendly', 'hubspot', 'zendesk', 'acuity', 'salesforce', 'intercom', 'pipedrive', 'freshdesk', 'simplybook'];
    
    let activeCount = 0;
    let configuredCount = 0;
    
    integrations.forEach(integration => {
        const toggle = document.getElementById(`enable-${integration}`);
        const savedConfig = localStorage.getItem(`integration_${integration}`);
        
        if (toggle && toggle.checked) activeCount++;
        if (savedConfig) configuredCount++;
    });
    
    dashboardStats.innerHTML = `
        <div class="stat-card">
            <h4>${activeCount}</h4>
            <p>Integrações Ativas</p>
        </div>
        <div class="stat-card">
            <h4>${configuredCount}</h4>
            <p>Configuradas</p>
        </div>
        <div class="stat-card">
            <h4>${integrations.length}</h4>
            <p>Total Disponível</p>
        </div>
    `;
}

// Refresh integration dashboard
setInterval(updateIntegrationDashboard, 5000);

// WhatsApp Evolution API Integration Functions

// Validate instance name for WhatsApp
function validateInstanceName(agentName) {
    const cleanName = agentName.trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace invalid chars with underscore
        .substring(0, 50);  // Limit length
    
    return {
        original: agentName,
        clean: cleanName,
        isValid: cleanName.length > 0 && cleanName.length <= 50
    };
}

// Check existing WhatsApp connections for an agent name
// Função removida - duplicada mais abaixo no código

// Check current WhatsApp status without polling
async function checkCurrentWhatsAppStatus(instanceName) {
    const statusIndicator = document.getElementById('whatsapp-status-indicator');
    const statusText = document.getElementById('whatsapp-status-text');
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const testBtn = document.getElementById('test-whatsapp-btn');
    
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/status/local`);
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                const isConnected = result.connected;
                const connectionState = result.status || 'unknown';
                
                if (isConnected) {
                    statusIndicator.className = 'status-indicator connected';
                    statusText.textContent = 'Conectado ✅';
                    connectBtn.style.display = 'none';
                    disconnectBtn.style.display = 'inline-block';
                    testBtn.style.display = 'inline-block';
                } else {
                    statusIndicator.className = 'status-indicator disconnected';
                    statusText.textContent = 'Desconectado ❌';
                    connectBtn.style.display = 'inline-block';
                    disconnectBtn.style.display = 'none';
                    testBtn.style.display = 'none';
                }
                
                return;
            }
        }
        
        // Se não encontrou no banco local, assumir desconectado
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Não configurado';
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
        testBtn.style.display = 'none';
        
    } catch (error) {
        console.error('Erro ao verificar status atual:', error);
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Erro ao verificar';
    }
}

// Connect WhatsApp with automatic instance creation
async function connectWhatsApp() {
    console.log('[WhatsApp] Iniciando processo de conexão...');
    
    const agentName = document.getElementById('agent-name').value.trim();
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const qrSection = document.getElementById('whatsapp-qr-section');
    const qrImage = document.getElementById('whatsapp-qr-image');
    const statusIndicator = document.getElementById('whatsapp-status-indicator');
    const statusText = document.getElementById('whatsapp-status-text');
    
    // Validação de nome do agente
    if (!agentName) {
        showToast('Por favor, defina um nome para o agente primeiro', 'error');
        return;
    }
    
    // Validar nome da instância
    const instanceName = validateInstanceName(agentName);
    if (!instanceName.isValid) {
        showToast('Nome do agente contém caracteres inválidos', 'error');
        return;
    }
    
    console.log(`[WhatsApp] Nome da instância: ${instanceName.clean}`);
    const originalText = connectBtn ? connectBtn.textContent : 'Conectar WhatsApp';
    
    try {
        connectBtn.textContent = 'Conectando...';
        connectBtn.disabled = true;
        statusText.textContent = 'Criando instância...';
        
        // Create WhatsApp instance with agent name
        const createResponse = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/create-instance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instance_name: instanceName.clean
            })
        }, 60000); // 60-second timeout for instance creation
        
        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.detail || 'Erro ao criar instância WhatsApp');
        }
        
        const createResult = await createResponse.json();
        
        if (createResult.success) {
            statusText.textContent = 'Gerando QR Code...';
            
            // Get QR Code
            const qrResponse = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName.clean}/qr-code`, {}, 60000); // 60-second timeout for QR code
            
            if (!qrResponse.ok) {
                const errorData = await qrResponse.json();
                throw new Error(errorData.detail || 'Erro ao obter QR Code');
            }
            
            const qrResult = await qrResponse.json();
            
            if (qrResult.success && qrResult.qr_code_image) {
                // Use utility function to safely set QR Code image
                const qrSetSuccess = setQRCodeImageSrc(qrImage, qrResult.qr_code_image, 'connectWhatsApp');
                
                if (!qrSetSuccess) {
                    throw new Error('Erro ao processar imagem QR Code - URL inválida');
                }
                qrImage.style.display = 'block';
                qrSection.style.display = 'block';
                
                statusIndicator.className = 'status-indicator connecting';
                statusText.textContent = 'Aguardando escaneamento...';
                
                showToast('QR Code gerado! Escaneie com seu WhatsApp.', 'success');
                
                // Check connection status periodically
                checkWhatsAppConnectionStatus(instanceName.clean);
            } else {
                throw new Error('QR Code não disponível');
            }
        } else {
            throw new Error(createResult.error || 'Falha ao criar instância');
        }
        
    } catch (error) {
        console.error('Erro ao conectar WhatsApp:', error);
        showToast(`Erro: ${error.message}`, 'error');
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Erro na conexão';
    } finally {
        connectBtn.textContent = originalText;
        connectBtn.disabled = false;
    }
}

// Check WhatsApp connection status periodically
async function checkWhatsAppConnectionStatus(instanceName) {
    console.log(`[WhatsApp] Iniciando monitoramento de status para: ${instanceName}`);
    
    const statusIndicator = document.getElementById('whatsapp-status-indicator');
    const statusText = document.getElementById('whatsapp-status-text');
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const testBtn = document.getElementById('test-whatsapp-btn');
    const qrSection = document.getElementById('whatsapp-qr-section');
    
    let checkCount = 0;
    const maxChecks = 36; // Check for 3 minutes max (36 * 5s = 180s)
    const checkInterval = 5000; // Check every 5 seconds
    
    const checkStatus = async () => {
        try {
            console.log(`[WhatsApp] Verificando status (tentativa ${checkCount + 1}/${maxChecks}): ${instanceName}`);
            
            // Primeiro tentar endpoint local (mais rápido)
            let response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/status/local`);
            
            if (!response.ok) {
                console.log(`[WhatsApp] Endpoint local falhou, tentando Evolution API...`);
                // Se falhar, usar endpoint da Evolution API
                response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/status`);
            }
            
            // A cada 5 tentativas (25 segundos), forçar sincronização
            if (checkCount > 0 && checkCount % 5 === 0) {
                console.log(`[WhatsApp] 🔄 Forçando sincronização na tentativa ${checkCount + 1}`);
                try {
                    await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/sync-status`, {
                        method: 'POST'
                    });
                } catch (syncError) {
                    console.log(`[WhatsApp] ⚠️ Erro na sincronização forçada:`, syncError);
                }
            }
            
            if (response.ok) {
                const result = await response.json();
                console.log(`[WhatsApp] Status recebido:`, result);
                
                if (result.success) {
                    const isConnected = result.connected || result.status === 'open';
                    const connectionState = result.status || result.connection_state || 'unknown';
                    
                    console.log(`[WhatsApp] 📊 Status detalhado:`, {
                        isConnected,
                        connectionState,
                        result_connected: result.connected,
                        result_status: result.status,
                        result_connection_state: result.connection_state,
                        full_result: result
                    });
                    
                    // Atualizar UI baseado no status
                    if (isConnected || connectionState === 'open') {
                        console.log(`[WhatsApp] ✅ CONEXÃO ESTABELECIDA! Parando monitoramento.`);
                        statusIndicator.className = 'status-indicator connected';
                        statusText.textContent = 'Conectado ✅';
                        
                        connectBtn.style.display = 'none';
                        disconnectBtn.style.display = 'inline-block';
                        testBtn.style.display = 'inline-block';
                        qrSection.style.display = 'none';
                        
                        showToast('WhatsApp conectado com sucesso!', 'success');
                        console.log(`[WhatsApp] 🎯 UI atualizada para estado conectado`);
                        return; // Stop checking only when truly connected
                    } else if (connectionState === 'connecting') {
                        console.log(`[WhatsApp] 🔄 Estado: Conectando...`);
                        statusIndicator.className = 'status-indicator connecting';
                        statusText.textContent = 'Conectando... 🔄';
                    } else if (connectionState === 'close' || connectionState === 'disconnected') {
                        console.log(`[WhatsApp] ❌ Estado: Desconectado`);
                        statusIndicator.className = 'status-indicator disconnected';
                        statusText.textContent = 'Desconectado ❌';
                    } else if (connectionState === 'not_found') {
                        console.log(`[WhatsApp] 🔍 Instância não encontrada no banco local`);
                        statusIndicator.className = 'status-indicator connecting';
                        statusText.textContent = 'Aguardando registro... 🔍';
                    } else {
                        console.log(`[WhatsApp] ⏳ Estado desconhecido: ${connectionState}`);
                        statusIndicator.className = 'status-indicator connecting';
                        statusText.textContent = `Aguardando... (${connectionState})`;
                    }
                } else {
                    console.log(`[WhatsApp] ❌ Resposta sem sucesso:`, result);
                    // Continue polling even on failed responses
                    statusIndicator.className = 'status-indicator connecting';
                    statusText.textContent = 'Verificando... 🔄';
                }
            }
            
            checkCount++;
            if (checkCount < maxChecks) {
                setTimeout(checkStatus, checkInterval); // Use consistent interval
            } else {
                statusIndicator.className = 'status-indicator disconnected';
                statusText.textContent = 'Timeout na conexão ⏰';
                showToast('Timeout na conexão. Tente novamente.', 'warning');
            }
            
        } catch (error) {
            console.error('Erro ao verificar status:', error);
            checkCount++;
            if (checkCount < maxChecks) {
                setTimeout(checkStatus, checkInterval);
            }
        }
    };
    
    // Mostrar feedback imediato
    statusIndicator.className = 'status-indicator connecting';
    statusText.textContent = 'Verificando conexão... 🔍';
    
    // Start checking immediately, then every 5 seconds
    checkStatus();
}

// Check if WhatsApp instance is already connected when page loads
async function checkExistingWhatsAppConnection(instanceName) {
    console.log(`[WhatsApp] 🔍 Verificando conexão existente para: ${instanceName}`);
    
    const statusIndicator = document.getElementById('whatsapp-status-indicator');
    const statusText = document.getElementById('whatsapp-status-text');
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const testBtn = document.getElementById('test-whatsapp-btn');
    const qrSection = document.getElementById('whatsapp-qr-section');
    
    try {
        console.log(`[WhatsApp] 📡 Fazendo requisição para: ${API_BASE_URL}/whatsapp/${instanceName}/status/local`);
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/status/local`);
        
        if (response.ok) {
            const result = await response.json();
            console.log(`[WhatsApp] 📊 Status existente recebido:`, {
                success: result.success,
                connected: result.connected,
                status: result.status,
                connection_state: result.connection_state,
                instance_name: result.instance_name,
                last_update: result.last_update,
                full_result: result
            });
            
            // Verificar múltiplas condições para determinar se está conectado
            const isConnected = result.success && (
                result.connected === true || 
                result.status === 'open' || 
                result.connection_state === 'open'
            );
            
            console.log(`[WhatsApp] 🎯 Análise de conexão:`, {
                'result.success': result.success,
                'result.connected': result.connected,
                'result.status': result.status,
                'result.connection_state': result.connection_state,
                'isConnected': isConnected
            });
            
            if (isConnected) {
                console.log(`[WhatsApp] ✅ INSTÂNCIA JÁ CONECTADA!`);
                // Update UI to show connected state
                statusIndicator.className = 'status-indicator connected';
                statusText.textContent = 'Conectado ✅';
                
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-block';
                testBtn.style.display = 'inline-block';
                qrSection.style.display = 'none';
                
                showToast('WhatsApp já está conectado!', 'info');
                console.log(`[WhatsApp] 🎯 UI configurada para estado conectado`);
            } else {
                console.log(`[WhatsApp] ❌ Instância não conectada ou não existe`);
                // Update UI to show disconnected state
                statusIndicator.className = 'status-indicator disconnected';
                statusText.textContent = 'Não conectado';
                
                connectBtn.style.display = 'inline-block';
                disconnectBtn.style.display = 'none';
                testBtn.style.display = 'none';
                qrSection.style.display = 'none';
                
                console.log(`[WhatsApp] 🎯 UI configurada para estado desconectado`);
            }
        } else {
            console.log(`[WhatsApp] ❌ Erro na resposta HTTP: ${response.status}`);
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error(`[WhatsApp] ❌ Erro ao verificar conexão existente:`, error);
        // Default to disconnected state
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Não conectado';
        
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
        testBtn.style.display = 'none';
        qrSection.style.display = 'none';
        
        console.log(`[WhatsApp] 🎯 UI configurada para estado de erro (desconectado)`);
    }
}

// Disconnect WhatsApp
async function disconnectWhatsApp() {
    const agentName = document.getElementById('agent-name').value.trim();
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const testBtn = document.getElementById('test-whatsapp-btn');
    const statusIndicator = document.getElementById('whatsapp-status-indicator');
    const statusText = document.getElementById('whatsapp-status-text');
    const qrSection = document.getElementById('whatsapp-qr-section');
    
    const originalText = disconnectBtn.textContent;
    
    try {
        disconnectBtn.textContent = 'Desconectando...';
        disconnectBtn.disabled = true;
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/delete-instance/${agentName}`, {
            method: 'DELETE'
        }, 60000); // 60-second timeout for instance deletion
        
        if (response.ok) {
            statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Desconectado';
            
            disconnectBtn.style.display = 'none';
            testBtn.style.display = 'none';
            connectBtn.style.display = 'inline-block';
            qrSection.style.display = 'none';
            
            showToast('WhatsApp desconectado', 'success');
        } else {
            throw new Error('Erro ao desconectar');
        }
        
    } catch (error) {
        console.error('Erro ao desconectar:', error);
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        disconnectBtn.textContent = originalText;
        disconnectBtn.disabled = false;
    }
}

// Test WhatsApp connection
async function testWhatsApp() {
    const agentName = document.getElementById('agent-name').value.trim();
    const testBtn = document.getElementById('test-whatsapp-btn');
    
    // Get test phone number from user
    const testPhone = prompt('Digite o número para teste (com código do país):');
    if (!testPhone) return;
    
    const originalText = testBtn.textContent;
    
    try {
        testBtn.textContent = 'Enviando...';
        testBtn.disabled = true;
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/send-message`, {
            method: 'POST',
            body: JSON.stringify({
                instance_name: agentName,
                number: testPhone,
                message: `🤖 Teste de integração - Agente "${agentName}" funcionando!`
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showToast('Mensagem de teste enviada!', 'success');
            } else {
                throw new Error(result.error || 'Erro ao enviar mensagem');
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao enviar mensagem');
        }
        
    } catch (error) {
        console.error('Erro no teste:', error);
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

// Payment Integration Functions
function initializePaymentIntegrations() {
    // Payments toggle is handled by the generic initializeIntegrationToggles() function
    // Only initialize specific payment buttons here
    
    // Initialize Stripe payment link creation
    const createStripeBtn = document.getElementById('create-stripe-link');
    if (createStripeBtn) {
        createStripeBtn.addEventListener('click', createStripePaymentLink);
    }
    
    // Initialize Asaas payment link creation
    const createAsaasBtn = document.getElementById('create-asaas-link');
    if (createAsaasBtn) {
        createAsaasBtn.addEventListener('click', createAsaasPaymentLink);
    }
    
    // Initialize test payment buttons
    const testStripeBtn = document.getElementById('test-stripe');
    if (testStripeBtn) {
        testStripeBtn.addEventListener('click', () => testPaymentIntegration('stripe'));
    }
    
    const testAsaasBtn = document.getElementById('test-asaas');
    if (testAsaasBtn) {
        testAsaasBtn.addEventListener('click', () => testPaymentIntegration('asaas'));
    }
}

// Handle Payments Toggle - DEPRECATED: Now handled by generic initializeIntegrationToggles()
function handlePaymentsToggle(event) {
    // This function is no longer used - all toggles are handled by initializeIntegrationToggles()
    console.warn('handlePaymentsToggle is deprecated - using generic toggle handler instead');
}

// Create Stripe payment link
async function createStripePaymentLink() {
    const createBtn = document.getElementById('create-stripe-link');
    const amount = document.getElementById('stripe-test-amount').value;
    const description = document.getElementById('stripe-test-description').value || 'Produto de teste';
    
    if (!amount || amount <= 0) {
        showToast('Insira um valor válido para o pagamento', 'error');
        return;
    }
    
    const originalText = createBtn.textContent;
    
    try {
        createBtn.textContent = 'Criando link...';
        createBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/payments/create-link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider: 'stripe',
                amount: parseFloat(amount),
                currency: 'BRL',
                description: description,
                customer_email: 'teste@exemplo.com'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao criar link de pagamento');
        }
        
        const result = await response.json();
        
        if (result.payment_url) {
            // Display payment link
            displayPaymentLink('Stripe', result.payment_url, result.payment_id);
            showToast('Link de pagamento Stripe criado com sucesso!', 'success');
        } else {
            throw new Error('URL de pagamento não foi gerada');
        }
        
    } catch (error) {
        console.error('Stripe payment link creation failed:', error);
        showToast(`Erro ao criar link Stripe: ${error.message}`, 'error');
    } finally {
        createBtn.textContent = originalText;
        createBtn.disabled = false;
    }
}

// Create Asaas payment link
async function createAsaasPaymentLink() {
    const createBtn = document.getElementById('create-asaas-link');
    const amount = document.getElementById('asaas-test-amount').value;
    const description = document.getElementById('asaas-test-description').value || 'Produto de teste';
    
    if (!amount || amount <= 0) {
        showToast('Insira um valor válido para o pagamento', 'error');
        return;
    }
    
    const originalText = createBtn.textContent;
    
    try {
        createBtn.textContent = 'Criando link...';
        createBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/payments/create-link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider: 'asaas',
                amount: parseFloat(amount),
                currency: 'BRL',
                description: description,
                customer_email: 'teste@exemplo.com'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao criar link de pagamento');
        }
        
        const result = await response.json();
        
        if (result.payment_url) {
            // Display payment link
            displayPaymentLink('Asaas', result.payment_url, result.payment_id);
            showToast('Link de pagamento Asaas criado com sucesso!', 'success');
        } else {
            throw new Error('URL de pagamento não foi gerada');
        }
        
    } catch (error) {
        console.error('Asaas payment link creation failed:', error);
        showToast(`Erro ao criar link Asaas: ${error.message}`, 'error');
    } finally {
        createBtn.textContent = originalText;
        createBtn.disabled = false;
    }
}

// Display created payment link
function displayPaymentLink(provider, url, paymentId) {
    const linkSection = document.getElementById('payment-links-section') || createPaymentLinksSection();
    
    const linkElement = document.createElement('div');
    linkElement.className = 'payment-link-item';
    linkElement.innerHTML = `
        <div class="payment-link-header">
            <h5>Link ${provider}</h5>
            <span class="payment-id">ID: ${paymentId || 'N/A'}</span>
        </div>
        <div class="payment-link-body">
            <input type="text" value="${url}" readonly class="payment-url-input">
            <button onclick="copyPaymentLink('${url}')" class="btn-secondary">
                <i class="fas fa-copy"></i> Copiar
            </button>
            <button onclick="openPaymentLink('${url}')" class="btn-primary">
                <i class="fas fa-external-link-alt"></i> Abrir
            </button>
        </div>
    `;
    
    linkSection.appendChild(linkElement);
    linkSection.style.display = 'block';
}

// Create payment links section if it doesn't exist
function createPaymentLinksSection() {
    const paymentsTab = document.getElementById('payments-tab');
    if (!paymentsTab) return null;
    
    const section = document.createElement('div');
    section.id = 'payment-links-section';
    section.className = 'payment-links-section';
    section.innerHTML = '<h4>Links de Pagamento Gerados</h4>';
    section.style.display = 'none';
    
    paymentsTab.appendChild(section);
    return section;
}

// Copy payment link to clipboard
function copyPaymentLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link copiado para a área de transferência!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar link', 'error');
    });
}

// Open payment link in new tab
function openPaymentLink(url) {
    window.open(url, '_blank');
}

// Test payment integration
async function testPaymentIntegration(provider) {
    const testBtn = document.getElementById(`test-${provider}`);
    const originalText = testBtn.textContent;
    
    try {
        testBtn.textContent = 'Testando...';
        testBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/payments/test/${provider}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro no teste de integração');
        }
        
        const result = await response.json();
        showToast(`Teste ${provider.toUpperCase()} realizado com sucesso!`, 'success');
        console.log('Payment test result:', result);
        
    } catch (error) {
        console.error(`${provider} test failed:`, error);
        showToast(`Erro no teste ${provider.toUpperCase()}: ${error.message}`, 'error');
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

// Calendar Integration Functions
async function createCalendarEvent() {
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    
    if (!title || !date || !time) {
        showToast('Preencha todos os campos do evento', 'error');
        return;
    }
    
    try {
        // calcular término +1h de forma segura
        const start = new Date(`${date}T${time}:00`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        const endStr = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;

        const response = await fetch(`${API_BASE_URL}/calendar/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                start_datetime: `${date}T${time}:00`,
                end_datetime: endStr,
                description: 'Evento criado via Agente SDK'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao criar evento');
        }
        
        const result = await response.json();
        showToast('Evento criado no Google Calendar!', 'success');
        
        // Clear form
        document.getElementById('event-title').value = '';
        document.getElementById('event-date').value = '';
        document.getElementById('event-time').value = '';
        
    } catch (error) {
        console.error('Calendar event creation failed:', error);
        showToast(`Erro ao criar evento: ${error.message}`, 'error');
    }
}

// Email Integration Functions
async function sendTestEmail() {
    const recipient = document.getElementById('test-email-recipient').value;
    const subject = document.getElementById('test-email-subject').value || 'Teste de Integração';
    const content = document.getElementById('test-email-content').value || 'Este é um email de teste enviado pelo Agente SDK.';
    
    if (!recipient) {
        showToast('Insira o email do destinatário', 'error');
        return;
    }
    
    const sendBtn = document.getElementById('send-test-email');
    const originalText = sendBtn.textContent;
    
    try {
        sendBtn.textContent = 'Enviando...';
        sendBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider: 'sendgrid',
                to_emails: [recipient],
                subject: subject,
                content: content,
                template_type: 'basic'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao enviar email');
        }
        
        showToast('Email de teste enviado com sucesso!', 'success');
        
        // Clear form
        document.getElementById('test-email-recipient').value = '';
        document.getElementById('test-email-content').value = '';
        
    } catch (error) {
        console.error('Email sending failed:', error);
        showToast(`Erro ao enviar email: ${error.message}`, 'error');
    } finally {
        sendBtn.textContent = originalText;
        sendBtn.disabled = false;
    }
}

// =====================================================
// WHATSAPP INTEGRATION - IMPLEMENTAÇÃO COMPLETA
// =====================================================

// WhatsApp Integration State
let whatsappState = {
    instances: new Map(),
    currentInstance: null,
    connected: false,
    connectionData: null,
    qrCodeCheckInterval: null,
    statusCheckInterval: null,
    connectionTimeout: null
};

// Initialize WhatsApp Integration
function initializeWhatsAppIntegration() {
    console.log('🚀 Inicializando integração WhatsApp...');
    
    // Wait a bit more to ensure DOM is fully ready
    setTimeout(() => {
        // WhatsApp Action Buttons - DEBUG DETALHADO
        const connectBtn = document.getElementById('connect-whatsapp-btn');
        const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
        const testBtn = document.getElementById('test-whatsapp-btn');
        const agentNameInput = document.getElementById('agent-name');
        const instanceNameInput = document.getElementById('whatsapp-instance-name');
        const whatsappToggle = document.getElementById('enable-whatsapp');
        
        console.log('🔍 [DEBUG] Verificando elementos WhatsApp do DOM:');
        console.log('  - connectBtn:', connectBtn ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        console.log('  - disconnectBtn:', disconnectBtn ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        console.log('  - testBtn:', testBtn ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        console.log('  - agentNameInput:', agentNameInput ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        console.log('  - instanceNameInput:', instanceNameInput ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        console.log('  - whatsappToggle:', whatsappToggle ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        
        if (connectBtn) {
            // Remove existing listeners to avoid duplicates
            const newConnectBtn = connectBtn.cloneNode(true);
            connectBtn.parentNode.replaceChild(newConnectBtn, connectBtn);
            
            console.log('🔗 [DEBUG] Anexando event listener ao botão conectar...');
            newConnectBtn.addEventListener('click', function(event) {
                console.log('🎯 [DEBUG] Botão conectar clicado!', event);
                event.preventDefault();
                event.stopPropagation();
                handleWhatsAppConnect();
            });
            console.log('✅ [DEBUG] Event listener do botão conectar anexado com sucesso');
        } else {
            console.error('❌ [DEBUG] ERRO: Botão conectar não encontrado no DOM!');
        }
        
        if (disconnectBtn) {
            const newDisconnectBtn = disconnectBtn.cloneNode(true);
            disconnectBtn.parentNode.replaceChild(newDisconnectBtn, disconnectBtn);
            
            newDisconnectBtn.addEventListener('click', function(event) {
                console.log('🎯 [DEBUG] Botão desconectar clicado!', event);
                event.preventDefault();
                event.stopPropagation();
                handleWhatsAppDisconnect();
            });
            console.log('✅ [DEBUG] Event listener do botão desconectar anexado');
        }
        
        // Add refresh button event listener
        const refreshBtn = document.getElementById('refresh-whatsapp-btn');
        console.log('  - refreshBtn:', refreshBtn ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        
        if (refreshBtn) {
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            
            newRefreshBtn.addEventListener('click', function(event) {
                console.log('🎯 [DEBUG] Botão refresh clicado!', event);
                event.preventDefault();
                event.stopPropagation();
                refreshWhatsAppStatus();
            });
            console.log('✅ [DEBUG] Event listener do botão refresh anexado');
        }
        
        // Add proceed button event listener
        const proceedBtn = document.getElementById('proceed-whatsapp-btn');
        console.log('  - proceedBtn:', proceedBtn ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
        
        if (proceedBtn) {
            const newProceedBtn = proceedBtn.cloneNode(true);
            proceedBtn.parentNode.replaceChild(newProceedBtn, proceedBtn);
            
            newProceedBtn.addEventListener('click', function(event) {
                console.log('🎯 [DEBUG] Botão prosseguir clicado!', event);
                event.preventDefault();
                event.stopPropagation();
                handleWhatsAppProceed();
            });
            console.log('✅ [DEBUG] Event listener do botão prosseguir anexado');
        }
        
        if (testBtn) {
            const newTestBtn = testBtn.cloneNode(true);
            testBtn.parentNode.replaceChild(newTestBtn, testBtn);
            
            newTestBtn.addEventListener('click', function(event) {
                console.log('🎯 [DEBUG] Botão testar clicado!', event);
                event.preventDefault();
                event.stopPropagation();
                handleWhatsAppTest();
            });
            console.log('✅ [DEBUG] Event listener do botão testar anexado');
        }
        
        // Instance name update based on agent name
        if (agentNameInput) {
            // Remove existing listener to avoid duplicates
            const newAgentNameInput = agentNameInput.cloneNode(true);
            agentNameInput.parentNode.replaceChild(newAgentNameInput, agentNameInput);
            
            newAgentNameInput.addEventListener('input', function() {
                console.log('🔍 [DEBUG] Nome do agente alterado:', this.value);
                updateWhatsAppInstanceName();
            });
            
            // Update immediately if there's already a value
            if (newAgentNameInput.value.trim()) {
                console.log('🔍 [DEBUG] Atualizando nome da instância com valor existente');
                updateWhatsAppInstanceName();
            }
            console.log('✅ [DEBUG] Event listener do nome do agente anexado');
        } else {
            console.error('❌ [DEBUG] ERRO: Campo nome do agente não encontrado!');
        }
        
        console.log('✅ Integração WhatsApp inicializada com sucesso');
    }, 50);
}

// Handle WhatsApp Toggle - DEPRECATED: Now handled by generic initializeIntegrationToggles()
function handleWhatsAppToggle(event) {
    // This function is no longer used - all toggles are handled by initializeIntegrationToggles()
    console.warn('handleWhatsAppToggle is deprecated - using generic toggle handler instead');
}

// Update WhatsApp Instance Name
function updateWhatsAppInstanceName() {
    const agentNameInput = document.getElementById('agent-name');
    const instanceNameInput = document.getElementById('whatsapp-instance-name');
    const whatsappToggle = document.getElementById('enable-whatsapp');
    
    console.log('🔍 [DEBUG] updateWhatsAppInstanceName chamada');
    console.log('  - agentNameInput:', agentNameInput ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
    console.log('  - instanceNameInput:', instanceNameInput ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
    console.log('  - whatsappToggle:', whatsappToggle ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
    
    if (agentNameInput && instanceNameInput) {
        const agentName = agentNameInput.value.trim();
        console.log('  - agentName:', `"${agentName}"`);
        
        if (agentName) {
            const instanceName = generateInstanceName(agentName);
            console.log('  - instanceName gerado:', `"${instanceName}"`);
            
            instanceNameInput.value = instanceName;
            whatsappState.currentInstance = instanceName;
            
            console.log('✅ [DEBUG] Nome da instância atualizado com sucesso');
        } else {
            instanceNameInput.value = '';
            whatsappState.currentInstance = null;
            console.log('🔍 [DEBUG] Nome do agente vazio, limpando campo instância');
        }
    } else {
        console.error('❌ [DEBUG] Elementos necessários não encontrados para atualizar nome da instância');
    }
    
    // Also update when WhatsApp toggle is activated
    if (whatsappToggle && whatsappToggle.checked && agentNameInput && agentNameInput.value.trim()) {
        console.log('🔍 [DEBUG] WhatsApp está ativado, garantindo que instância está preenchida');
        if (instanceNameInput && !instanceNameInput.value.trim()) {
            const instanceName = generateInstanceName(agentNameInput.value.trim());
            instanceNameInput.value = instanceName;
            whatsappState.currentInstance = instanceName;
            console.log('✅ [DEBUG] Nome da instância preenchido via toggle check');
        }
    }
}

// Generate Instance Name from Agent Name
function generateInstanceName(agentName) {
    return agentName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_')        // Replace spaces with underscores
        .substring(0, 50);           // Limit length
}

// Refresh WhatsApp Status - Manual status verification with retry logic
async function refreshWhatsAppStatus() {
    const refreshBtn = document.getElementById('refresh-whatsapp-btn');
    const instanceNameInput = document.getElementById('whatsapp-instance-name');
    
    if (!instanceNameInput || !instanceNameInput.value.trim()) {
        console.error('❌ Nome da instância não definido');
        showToast('Nome da instância WhatsApp não definido', 'error');
        return;
    }
    
    const instanceName = instanceNameInput.value.trim();
    console.log(`🔄 Verificando status da instância: ${instanceName}`);
    
    // Disable button during request
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    }
    
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Tentativa ${attempt}/${maxRetries} - Verificando status`);
            
            if (refreshBtn && attempt > 1) {
                refreshBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Tentativa ${attempt}/${maxRetries}...`;
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
            
            const response = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/refresh-status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Instância '${instanceName}' não encontrada`);
                }
                throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Status atualizado (tentativa ${attempt}):`, data);
            
            // Check connection using robust detection based on Evolution API v2 response
            const isConnected = data.success && (
                data.connected === true || 
                data.status === 'open' || 
                data.connection_state === 'open' ||
                data.state === 'open' ||
                (data.instance && data.instance.state === 'open')
            );
            
            if (isConnected) {
                console.log('✅ WhatsApp detectado como conectado via atualização manual');
                showWhatsAppConnected(data);
                showToast('WhatsApp conectado com sucesso!', 'success');
                
                // Configure webhook automatically after successful connection detection
                await configureWebhookAfterConnection(instanceName, data);
                return; // Success, exit retry loop
            } else {
                console.log('⚠️ WhatsApp não está conectado');
                showWhatsAppDisconnected();
                
                if (attempt === maxRetries) {
                    showToast('WhatsApp não está conectado após múltiplas verificações.', 'warning');
                } else {
                    console.log(`⏳ Aguardando antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
                }
            }
            
        } catch (error) {
            lastError = error;
            console.error(`❌ Erro na tentativa ${attempt}:`, error.message);
            
            if (error.name === 'AbortError') {
                console.error('⏰ Timeout na requisição');
                lastError = new Error('Timeout na verificação de status');
            }
            
            if (attempt === maxRetries) {
                console.error('❌ Todas as tentativas falharam');
                showToast(`Erro ao verificar status: ${lastError.message}`, 'error');
                showWhatsAppDisconnected();
            } else {
                console.log(`⏳ Aguardando antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            }
        }
    }
    
    // Re-enable button
    if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Status';
    }
}

// Configure webhook automatically after successful connection
async function configureWebhookAfterConnection(instanceName, connectionData) {
    console.log(`🔗 Configurando webhook automático para instância: ${instanceName}`);
    
    try {
        const webhookResponse = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/configure-webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                connection_data: connectionData,
                auto_configure: true
            })
        });
        
        if (!webhookResponse.ok) {
            throw new Error(`Erro na configuração do webhook: ${webhookResponse.status}`);
        }
        
        const webhookData = await webhookResponse.json();
        console.log('✅ Webhook configurado automaticamente:', webhookData);
        showToast('Webhook configurado automaticamente', 'success');
        
        // Update UI to show webhook is ready
        const webhookStatus = document.querySelector('.webhook-status');
        if (webhookStatus) {
            webhookStatus.textContent = 'Webhook ativo';
            webhookStatus.className = 'webhook-status status-connected';
        }
        
        return webhookData;
    } catch (error) {
        console.error('❌ Erro na configuração automática do webhook:', error);
        showToast(`Aviso: Erro na configuração do webhook - ${error.message}`, 'warning');
        return null;
    }
}

// Utility function to safely set QR Code image src
function setQRCodeImageSrc(imageElement, qrCodeData, context = 'general') {
    if (!imageElement || !qrCodeData) {
        console.error('❌ setQRCodeImageSrc: Elementos inválidos');
        return false;
    }
    
    let qrImageSrc;
    if (qrCodeData.startsWith('data:image/')) {
        // Already has data URL prefix
        qrImageSrc = qrCodeData;
        console.log(`🔍 [DEBUG] QR Code (${context}) já possui prefixo data URL`);
    } else {
        // Add data URL prefix
        qrImageSrc = `data:image/png;base64,${qrCodeData}`;
        console.log(`🔍 [DEBUG] Adicionando prefixo data URL ao QR Code (${context})`);
    }
    
    // Validate the final URL to prevent duplicated prefixes
    if (qrImageSrc.indexOf('data:image/png;base64,data:image/') !== -1) {
        console.error('❌ ERRO: Prefixo data URL duplicado detectado!', qrImageSrc.substring(0, 60));
        return false;
    }
    
    console.log(`🔍 [DEBUG] QR Code (${context}) src length:`, qrImageSrc.length);
    console.log(`🔍 [DEBUG] QR Code (${context}) src preview:`, qrImageSrc.substring(0, 50) + '...');
    
    imageElement.src = qrImageSrc;
    return true;
}

// Check Existing WhatsApp Connections with improved error handling
async function checkExistingWhatsAppConnections() {
    const instanceName = whatsappState.currentInstance;
    if (!instanceName) return;
    
    try {
        console.log(`🔍 Verificando conexões WhatsApp existentes para: ${instanceName}`);
        
        // Check local database first with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const localStatus = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/status/local`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (localStatus.ok) {
            const data = await localStatus.json();
            console.log('📊 Status local encontrado:', data);
            
            // Robust connection detection
            const isConnected = data.success && (
                data.connected === true || 
                data.connection_state === 'open' ||
                data.state === 'open' ||
                (data.instance && data.instance.state === 'open')
            );
            
            updateWhatsAppConnectionStatus(data.connection_state || 'disconnected', isConnected);
            
            if (isConnected) {
                showWhatsAppConnected(data);
                console.log('✅ Conexão WhatsApp confirmada via status local');
            } else {
                console.log('⚠️ Status local indica desconectado, verificando Evolution API...');
                // Check if instance exists in Evolution API
                await checkEvolutionAPIStatus(instanceName);
            }
        } else {
            console.log('📭 Nenhum registro local encontrado, verificando Evolution API...');
            // No local record, try Evolution API
            await checkEvolutionAPIStatus(instanceName);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('⏰ Timeout ao verificar status local');
            updateWhatsAppConnectionStatus('timeout', false);
        } else {
            console.error('❌ Erro ao verificar conexões WhatsApp:', error);
            updateWhatsAppConnectionStatus('error', false);
        }
        
        // Fallback to Evolution API check
        try {
            await checkEvolutionAPIStatus(instanceName);
        } catch (fallbackError) {
            console.error('❌ Erro também no fallback Evolution API:', fallbackError);
        }
    }
}

// Check Evolution API Status with retry logic
async function checkEvolutionAPIStatus(instanceName) {
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Verificando Evolution API (tentativa ${attempt}/${maxRetries})`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
            
            const response = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`📊 Resposta Evolution API (tentativa ${attempt}):`, data);
                
                if (data.success) {
                    // Robust connection detection
                    const isConnected = data.connected === true || 
                                      data.status === 'open' || 
                                      data.connection_state === 'open' ||
                                      data.state === 'open' ||
                                      (data.instance && data.instance.state === 'open');
                    
                    updateWhatsAppConnectionStatus(data.status || 'disconnected', isConnected);
                    
                    if (data.status === 'qr' || data.status === 'connecting') {
                        console.log('📱 QR Code necessário, carregando...');
                        loadQRCode(instanceName);
                    } else if (isConnected) {
                        console.log('✅ Conexão WhatsApp confirmada via Evolution API');
                        showWhatsAppConnected(data);
                    } else {
                        console.log('⚠️ Instância encontrada mas não conectada');
                        updateWhatsAppConnectionStatus(data.status || 'disconnected', false);
                    }
                    return; // Success, exit retry loop
                } else {
                    console.log('❌ Evolution API retornou success=false');
                    updateWhatsAppConnectionStatus('not_found', false);
                    return; // No point retrying if instance doesn't exist
                }
            } else if (response.status === 404) {
                console.log('📭 Instância não encontrada na Evolution API');
                updateWhatsAppConnectionStatus('not_found', false);
                return; // No point retrying 404
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            lastError = error;
            console.error(`❌ Erro na tentativa ${attempt} Evolution API:`, error.message);
            
            if (error.name === 'AbortError') {
                console.error('⏰ Timeout na verificação Evolution API');
                lastError = new Error('Timeout na verificação Evolution API');
            }
            
            if (attempt < maxRetries) {
                console.log(`⏳ Aguardando antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // Exponential backoff
            }
        }
    }
    
    // All retries failed
    console.error('❌ Todas as tentativas de verificação Evolution API falharam');
    updateWhatsAppConnectionStatus('error', false);
}

// Ensure instance name is unique
async function ensureUniqueInstanceName(baseName) {
    console.log(`🔍 [DEBUG] Verificando se instância '${baseName}' já existe...`);
    
    // Verificar se a instância já existe
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${baseName}/status/local`, {
            timeout: 10000
        });
        
        if (response.ok) {
            const data = await response.json();
            // Se a instância existe e está ativa, gerar nome alternativo
            if (data.exists) {
                console.log(`⚠️ [DEBUG] Instância '${baseName}' já existe. Gerando nome alternativo...`);
                
                // Tentar nomes com sufixos numéricos
                for (let i = 2; i <= 10; i++) {
                    const alternativeName = `${baseName}_${i}`;
                    console.log(`🔍 [DEBUG] Tentando nome alternativo: ${alternativeName}`);
                    
                    const altResponse = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${alternativeName}/status/local`, {
                        timeout: 10000
                    });
                    
                    if (altResponse.ok) {
                        const altData = await altResponse.json();
                        if (!altData.exists) {
                            console.log(`✅ [DEBUG] Nome alternativo '${alternativeName}' está disponível`);
                            showToast(`Instância '${baseName}' já existe. Usando '${alternativeName}'`, 'info');
                            return alternativeName;
                        }
                    } else {
                        // Se não conseguiu verificar, assume que está disponível
                        console.log(`✅ [DEBUG] Nome alternativo '${alternativeName}' assumido como disponível`);
                        showToast(`Instância '${baseName}' já existe. Usando '${alternativeName}'`, 'info');
                        return alternativeName;
                    }
                }
                
                // Se chegou até aqui, usa um timestamp
                const timestampName = `${baseName}_${Date.now()}`;
                console.log(`🕒 [DEBUG] Usando nome com timestamp: ${timestampName}`);
                showToast(`Múltiplas instâncias existem. Usando nome único com timestamp`, 'warning');
                return timestampName;
            }
        }
    } catch (error) {
        console.log(`🔍 [DEBUG] Erro ao verificar instância (assumindo que não existe): ${error.message}`);
    }
    
    console.log(`✅ [DEBUG] Nome '${baseName}' está disponível`);
    return baseName;
}

// Handle WhatsApp Connect
async function handleWhatsAppConnect() {
    console.log('🎯 [DEBUG] handleWhatsAppConnect() chamada!');
    
    // Verificar se o nome do agente está definido
    const agentNameInput = document.getElementById('agent-name');
    const agentName = agentNameInput ? agentNameInput.value.trim() : '';
    console.log('🔍 [DEBUG] Nome do agente:', agentName);
    
    if (!agentName) {
        console.log('❌ [DEBUG] Nome do agente não definido');
        showToast('Por favor, defina um nome para o agente primeiro', 'error');
        return;
    }
    
    // Gerar nome da instância
    let instanceName = generateInstanceName(agentName);
    console.log('🔍 [DEBUG] Nome da instância gerado:', instanceName);
    
    if (!instanceName) {
        console.log('❌ [DEBUG] Nome da instância não pôde ser gerado');
        showToast('Erro ao gerar nome da instância', 'error');
        return;
    }
    
    // Verificar se a instância já existe e gerar nome alternativo se necessário
    instanceName = await ensureUniqueInstanceName(instanceName);
    console.log('🔍 [DEBUG] Nome da instância final:', instanceName);
    
    // Atualizar o campo de nome da instância no DOM
    const instanceNameInput = document.getElementById('whatsapp-instance-name');
    if (instanceNameInput) {
        instanceNameInput.value = instanceName;
    }
    
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    console.log('🔍 [DEBUG] Botão conectar encontrado:', connectBtn ? 'SIM' : 'NÃO');
    
    const originalText = connectBtn ? connectBtn.textContent : 'Conectar WhatsApp';
    console.log('🔍 [DEBUG] Texto original do botão:', originalText);
    
    try {
        console.log(`🚀 [DEBUG] Iniciando conexão WhatsApp para instância: ${instanceName}`);
        
        // Show QR section immediately for better UX
        const qrSection = document.getElementById('whatsapp-qr-section');
        const qrLoading = document.getElementById('qr-loading');
        const qrImage = document.getElementById('whatsapp-qr-image');
        
        if (qrSection) {
            qrSection.style.display = 'block';
            console.log('🔍 [DEBUG] Seção QR Code exibida');
        }
        
        if (qrLoading) {
            qrLoading.style.display = 'block';
            qrLoading.textContent = '🔄 Preparando conexão WhatsApp...';
            console.log('🔍 [DEBUG] Loading QR Code exibido');
        }
        
        if (qrImage) {
            qrImage.style.display = 'none';
        }
        
        if (connectBtn) {
            connectBtn.textContent = '🔄 Criando instância...';
            connectBtn.disabled = true;
            console.log('🔍 [DEBUG] Botão atualizado para estado "criando"');
        }
        
        updateWhatsAppConnectionStatus('creating', false);
        console.log('🔍 [DEBUG] Status atualizado para "creating"');
        
        // Show feedback toast
        showToast('Criando instância WhatsApp. Por favor aguarde...', 'info');
        
        // Create WhatsApp instance with webhook
        const requestBody = {
            instance_name: instanceName,
            webhook_url: `${API_BASE_URL.replace('/api', '')}/api/whatsapp/webhook`
        };
        console.log('🔍 [DEBUG] Dados da requisição:', requestBody);
        console.log('🔍 [DEBUG] URL da API:', `${API_BASE_URL}/whatsapp/create-instance`);
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/create-instance`, {
            method: 'POST',
            timeout: 30000, // 30 seconds for instance creation
            body: JSON.stringify(requestBody)
        });
        
        console.log('🔍 [DEBUG] Resposta recebida:', response.status, response.statusText);
        
        const result = await response.json();
        console.log('🔍 [DEBUG] Dados da resposta:', result);
        
        if (response.ok && result.success) {
            console.log('✅ [DEBUG] Instância criada com sucesso:', result);
            showToast('Instância WhatsApp criada! Gerando QR Code...', 'success');
            
            updateWhatsAppConnectionStatus('connecting', false);
            console.log('🔍 [DEBUG] Status atualizado para "connecting"');
            
            // Update loading text
            if (qrLoading) {
                qrLoading.textContent = '🔄 Gerando QR Code...';
            }
            
            if (connectBtn) {
                connectBtn.textContent = '🔄 Gerando QR Code...';
            }
            
            // Start loading QR code immediately
            console.log('🔍 [DEBUG] Iniciando carregamento do QR Code...');
            setTimeout(() => {
                console.log('🔍 [DEBUG] Chamando loadQRCode()');
                loadQRCode(instanceName);
            }, 1000); // Reduced delay
            
        } else {
            console.error('❌ [DEBUG] Erro ao criar instância:', result);
            throw new Error(result.error || result.message || 'Erro desconhecido');
        }
        
    } catch (error) {
        console.error('❌ [DEBUG] Erro na conexão WhatsApp:', error);
        showToast(`Erro ao conectar WhatsApp: ${error.message}`, 'error');
        updateWhatsAppConnectionStatus('error', false);
        
        // Hide QR section on error
        const qrSection = document.getElementById('whatsapp-qr-section');
        if (qrSection) {
            qrSection.style.display = 'none';
            console.log('🔍 [DEBUG] Seção QR Code ocultada devido a erro');
        }
    } finally {
        console.log('🔍 [DEBUG] Finalizando handleWhatsAppConnect()');
        if (connectBtn) {
            connectBtn.textContent = originalText;
            connectBtn.disabled = false;
            console.log('🔍 [DEBUG] Botão restaurado ao estado original');
        }
    }
}

// Load QR Code
async function loadQRCode(instanceName) {
    const qrSection = document.getElementById('whatsapp-qr-section');
    const qrImage = document.getElementById('whatsapp-qr-image');
    const qrLoading = document.getElementById('qr-loading');
    
    if (!qrSection || !qrImage || !qrLoading) {
        console.error('❌ Elementos QR não encontrados no DOM');
        return;
    }
    
    // Show QR section and loading
    qrSection.style.display = 'block';
    qrImage.style.display = 'none';
    qrLoading.style.display = 'block';
    qrLoading.textContent = '🔄 Gerando QR Code...';
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const tryLoadQR = async () => {
        try {
            attempts++;
            console.log(`📱 Tentativa ${attempts}/${maxAttempts} - Carregando QR Code para: ${instanceName}`);
            
            const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/qr-code`, {
                timeout: 15000
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log('✅ QR Code obtido com sucesso');
                
                if (data.qr_code_image) {
                    // Use utility function to safely set QR Code image
                    const qrSetSuccess = setQRCodeImageSrc(qrImage, data.qr_code_image, 'loadQRCode');
                    
                    if (!qrSetSuccess) {
                        throw new Error('Erro ao processar imagem QR Code - URL inválida');
                    }
                    qrImage.style.display = 'block';
                    qrLoading.style.display = 'none';
                    
                    showToast('QR Code gerado! Escaneie com seu WhatsApp', 'success');
                    
                    // Start monitoring connection status
                    startConnectionMonitoring(instanceName);
                    
                } else {
                    throw new Error('QR Code não disponível na resposta');
                }
                
            } else if (data.connection_state && data.connection_state.connected) {
                // Already connected
                console.log('✅ WhatsApp já conectado');
                qrSection.style.display = 'none';
                showWhatsAppConnected(data.connection_state);
                
            } else {
                throw new Error(data.error || 'QR Code não disponível');
            }
            
        } catch (error) {
            console.error(`❌ Tentativa ${attempts} falhou:`, error);
            
            if (attempts < maxAttempts) {
                qrLoading.textContent = `🔄 Tentativa ${attempts}/${maxAttempts}... (${error.message})`;
                setTimeout(tryLoadQR, 3000); // Wait 3s before retry
            } else {
                qrLoading.textContent = '❌ Não foi possível gerar o QR Code';
                showToast('Erro ao gerar QR Code. Tente novamente.', 'error');
                updateWhatsAppConnectionStatus('error', false);
            }
        }
    };
    
    tryLoadQR();
}

// Start Connection Monitoring
function startConnectionMonitoring(instanceName) {
    // Clear existing intervals
    clearWhatsAppIntervals();
    
    console.log(`🔄 Iniciando monitoramento de conexão para: ${instanceName}`);
    
    whatsappState.statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/status/local`);
            const data = await response.json();
            
            console.log(`🔍 [DEBUG] Dados de status recebidos:`, {
                success: data.success,
                connected: data.connected,
                status: data.status,
                connection_state: data.connection_state,
                state: data.state
            });
            
            // Use robust connection detection (same logic as other functions)
            const isConnected = data.success && (
                data.connected === true || 
                data.status === 'open' || 
                data.connection_state === 'open' ||
                data.state === 'open'
            );
            
            console.log(`🔍 [DEBUG] Análise de conexão: ${isConnected ? 'CONECTADO' : 'NÃO CONECTADO'}`);
            
            if (isConnected) {
                console.log('✅ WhatsApp conectado! Parando monitoramento.');
                clearWhatsAppIntervals();
                showWhatsAppConnected(data);
                
                // Hide QR section
                const qrSection = document.getElementById('whatsapp-qr-section');
                if (qrSection) qrSection.style.display = 'none';
                
                showToast('WhatsApp conectado com sucesso! 🎉', 'success');
            } else {
                const currentState = data.connection_state || data.state || data.status || 'checking';
                console.log(`🔍 Status atual: ${currentState}`);
                updateWhatsAppConnectionStatus(currentState, false);
            }
            
        } catch (error) {
            console.error('❌ Erro no monitoramento:', error);
        }
    }, 5000); // Check every 5 seconds
    
    // Set timeout to stop monitoring after 5 minutes
    whatsappState.connectionTimeout = setTimeout(() => {
        console.log('⏰ Timeout do monitoramento de conexão');
        clearWhatsAppIntervals();
        showToast('Timeout na conexão WhatsApp. Tente novamente.', 'warning');
        updateWhatsAppConnectionStatus('timeout', false);
    }, 300000); // 5 minutes
}

// Show WhatsApp Connected State
function showWhatsAppConnected(connectionData) {
    console.log('✅ Mostrando estado conectado:', connectionData);
    
    // Update global state
    whatsappState.connected = true;
    whatsappState.connectionData = connectionData;
    
    updateWhatsAppConnectionStatus('connected', true);
    
    // Show action buttons
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const testBtn = document.getElementById('test-whatsapp-btn');
    const proceedBtn = document.getElementById('proceed-whatsapp-btn');
    const refreshBtn = document.getElementById('refresh-whatsapp-btn');
    
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
    if (testBtn) testBtn.style.display = 'inline-flex';
    if (proceedBtn) proceedBtn.style.display = 'inline-flex';
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
    
    // Hide QR section
    const qrSection = document.getElementById('whatsapp-qr-section');
    if (qrSection) qrSection.style.display = 'none';
    
    console.log('🔗 [DEBUG] Estado global WhatsApp atualizado:', {
        connected: whatsappState.connected,
        instance: whatsappState.currentInstance,
        data: whatsappState.connectionData
    });
}

// Update WhatsApp Connection Status
function updateWhatsAppConnectionStatus(state, connected) {
    const statusIndicator = document.getElementById('whatsapp-status-indicator');
    const statusText = document.getElementById('whatsapp-status-text');
    
    if (!statusIndicator || !statusText) return;
    
    // Update visual indicator
    statusIndicator.className = 'status-indicator';
    
    switch (state) {
        case 'connected':
        case 'open':
            statusIndicator.classList.add('connected');
            statusText.textContent = '✅ Conectado';
            statusText.style.color = '#10B981';
            break;
            
        case 'connecting':
        case 'qr':
            statusIndicator.classList.add('connecting');
            statusText.textContent = '🔄 Conectando...';
            statusText.style.color = '#F59E0B';
            break;
            
        case 'creating':
            statusIndicator.classList.add('connecting');
            statusText.textContent = '🚀 Criando instância...';
            statusText.style.color = '#3B82F6';
            break;
            
        case 'disconnected':
        case 'close':
            statusIndicator.classList.add('disconnected');
            statusText.textContent = '❌ Desconectado';
            statusText.style.color = '#EF4444';
            break;
            
        case 'not_found':
            statusIndicator.classList.add('disconnected');
            statusText.textContent = '❓ Instância não encontrada';
            statusText.style.color = '#6B7280';
            break;
            
        case 'error':
            statusIndicator.classList.add('disconnected');
            statusText.textContent = '🚫 Erro na conexão';
            statusText.style.color = '#EF4444';
            break;
            
        case 'timeout':
            statusIndicator.classList.add('disconnected');
            statusText.textContent = '⏰ Timeout na conexão';
            statusText.style.color = '#F59E0B';
            break;
            
        default:
            statusIndicator.classList.add('disconnected');
            statusText.textContent = '⚪ Não conectado';
            statusText.style.color = '#6B7280';
    }
    
    console.log(`📊 Status WhatsApp atualizado: ${state} (connected: ${connected})`);
}

// Handle WhatsApp Disconnect
async function handleWhatsAppDisconnect() {
    const instanceName = whatsappState.currentInstance;
    if (!instanceName) return;
    
    if (!confirm(`Deseja realmente desconectar a instância WhatsApp "${instanceName}"?\\n\\nIsto irá interromper o atendimento via WhatsApp.`)) {
        return;
    }
    
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const originalText = disconnectBtn.textContent;
    
    try {
        disconnectBtn.textContent = '🔄 Desconectando...';
        disconnectBtn.disabled = true;
        
        clearWhatsAppIntervals();
        
        // Disconnect from Evolution API
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/disconnect`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('WhatsApp desconectado com sucesso', 'success');
            showWhatsAppDisconnected();
        } else {
            throw new Error('Erro ao desconectar');
        }
        
    } catch (error) {
        console.error('❌ Erro ao desconectar WhatsApp:', error);
        showToast(`Erro ao desconectar: ${error.message}`, 'error');
    } finally {
        disconnectBtn.textContent = originalText;
        disconnectBtn.disabled = false;
    }
}

// Show WhatsApp Disconnected State
function showWhatsAppDisconnected() {
    // Update global state
    whatsappState.connected = false;
    whatsappState.connectionData = null;
    
    updateWhatsAppConnectionStatus('disconnected', false);
    
    // Show/hide buttons
    const connectBtn = document.getElementById('connect-whatsapp-btn');
    const disconnectBtn = document.getElementById('disconnect-whatsapp-btn');
    const testBtn = document.getElementById('test-whatsapp-btn');
    const proceedBtn = document.getElementById('proceed-whatsapp-btn');
    const refreshBtn = document.getElementById('refresh-whatsapp-btn');
    
    if (connectBtn) connectBtn.style.display = 'inline-flex';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    if (testBtn) testBtn.style.display = 'none';
    if (proceedBtn) proceedBtn.style.display = 'none';
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
    
    // Hide QR section
    const qrSection = document.getElementById('whatsapp-qr-section');
    if (qrSection) qrSection.style.display = 'none';
    
    console.log('❌ [DEBUG] Estado global WhatsApp resetado para desconectado');
}

// Handle WhatsApp Test
async function handleWhatsAppTest() {
    const testNumber = prompt('Digite o número para teste (formato: 5511999999999):', '5511999999999');
    if (!testNumber) return;
    
    const instanceName = whatsappState.currentInstance;
    const testBtn = document.getElementById('test-whatsapp-btn');
    const originalText = testBtn.textContent;
    
    try {
        testBtn.textContent = '📤 Enviando...';
        testBtn.disabled = true;
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/send-message`, {
            method: 'POST',
            body: JSON.stringify({
                number: testNumber,
                message: '🤖 Teste de conexão do Agente SDK!\\n\\nSe você recebeu esta mensagem, a integração WhatsApp está funcionando perfeitamente! ✅'
            })
        });
        
        if (response.ok) {
            showToast('Mensagem de teste enviada com sucesso! 📱', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao enviar mensagem');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste WhatsApp:', error);
        showToast(`Erro no teste: ${error.message}`, 'error');
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

// Handle WhatsApp Proceed - Confirm webhook and proceed with agent creation
async function handleWhatsAppProceed() {
    const instanceName = whatsappState.currentInstance;
    if (!instanceName) {
        showToast('Nome da instância não definido', 'error');
        return;
    }
    
    if (!whatsappState.connected) {
        showToast('WhatsApp não está conectado', 'error');
        return;
    }
    
    const proceedBtn = document.getElementById('proceed-whatsapp-btn');
    const originalText = proceedBtn.textContent;
    
    try {
        proceedBtn.textContent = '🔄 Configurando...';
        proceedBtn.disabled = true;
        
        // Verify webhook configuration
        const webhookResponse = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/configure-webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                force_reconfigure: true,
                verify_connection: true
            })
        });
        
        if (!webhookResponse.ok) {
            throw new Error(`Erro na configuração do webhook: ${webhookResponse.status}`);
        }
        
        const webhookData = await webhookResponse.json();
        console.log('✅ Webhook verificado e configurado:', webhookData);
        
        showToast('✅ WhatsApp configurado e pronto! Agora você pode criar seu agente.', 'success');
        
        // Scroll to agent creation form
        const agentForm = document.getElementById('agent-form');
        if (agentForm) {
            agentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Highlight the form briefly
            agentForm.style.boxShadow = '0 0 20px rgba(48, 209, 88, 0.3)';
            setTimeout(() => {
                agentForm.style.boxShadow = '';
            }, 2000);
        }
        
        // Enable WhatsApp toggle if not already enabled
        const whatsappToggle = document.getElementById('enable-whatsapp');
        if (whatsappToggle && !whatsappToggle.checked) {
            whatsappToggle.checked = true;
            // Trigger the toggle event to update UI
            whatsappToggle.dispatchEvent(new Event('change'));
        }
        
    } catch (error) {
        console.error('❌ Erro ao prosseguir com WhatsApp:', error);
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        proceedBtn.textContent = originalText;
        proceedBtn.disabled = false;
    }
}

// Clear WhatsApp Intervals
function clearWhatsAppIntervals() {
    if (whatsappState.qrCodeCheckInterval) {
        clearInterval(whatsappState.qrCodeCheckInterval);
        whatsappState.qrCodeCheckInterval = null;
    }
    
    if (whatsappState.statusCheckInterval) {
        clearInterval(whatsappState.statusCheckInterval);
        whatsappState.statusCheckInterval = null;
    }
    
    if (whatsappState.connectionTimeout) {
        clearTimeout(whatsappState.connectionTimeout);
        whatsappState.connectionTimeout = null;
    }
}

// Check if WhatsApp is ready for agent creation
function isWhatsAppReadyForAgent() {
    const whatsappEnabled = document.getElementById('enable-whatsapp')?.checked || false;
    
    if (!whatsappEnabled) {
        console.log('🔍 [DEBUG] WhatsApp não está habilitado para este agente');
        return true; // If WhatsApp is not enabled, it's "ready" (not required)
    }
    
    const isReady = whatsappState.connected && whatsappState.currentInstance;
    
    console.log('🔍 [DEBUG] Verificação de prontidão do WhatsApp:', {
        enabled: whatsappEnabled,
        connected: whatsappState.connected,
        hasInstance: !!whatsappState.currentInstance,
        instanceName: whatsappState.currentInstance,
        isReady: isReady
    });
    
    return isReady;
}

// =====================================================
// ENHANCED AGENT CREATION WITH WHATSAPP
// =====================================================

// Override the original generateAgent function to include WhatsApp
async function generateAgentWithWhatsApp() {
    const formData = new FormData(agentForm);
    const agentData = Object.fromEntries(formData.entries());
    
    // Validate required fields
    if (!agentData.name || !agentData.specialization || !agentData.description || !agentData.instructions) {
        showToast('Por favor, preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    // Check if WhatsApp is enabled
    const whatsappEnabled = document.getElementById('enable-whatsapp')?.checked || false;
    const instanceName = whatsappState.currentInstance;
    
    // Validate WhatsApp readiness if enabled
    if (whatsappEnabled && !isWhatsAppReadyForAgent()) {
        showToast('WhatsApp está habilitado mas não conectado. Por favor, conecte o WhatsApp antes de criar o agente.', 'warning');
        console.log('❌ [DEBUG] Tentativa de criar agente com WhatsApp não conectado');
        return;
    }
    
    // Prepare agent data with WhatsApp configuration
    const fullAgentData = {
        ...agentData,
        whatsapp_config: whatsappEnabled ? {
            enabled: true,
            instance_name: instanceName,
            auto_connect: true,
            webhook_url: `${API_BASE_URL.replace('/api', '')}/api/whatsapp/webhook`
        } : {}
    };
    
    console.log('🤖 Criando agente com configuração WhatsApp:', fullAgentData);
    
    try {
        showLoadingOverlay();
        
        // Create agent
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents`, {
            method: 'POST',
            timeout: 30000,
            body: JSON.stringify(fullAgentData)
        });
        
        let result;
        let errorMessage = 'Erro ao criar agente';
        
        // Try to parse JSON response
        try {
            result = await response.json();
        } catch (jsonError) {
            // If not JSON, get text response
            const textResponse = await response.text();
            console.error('❌ Resposta não é JSON:', textResponse);
            errorMessage = textResponse || 'Erro interno do servidor';
            result = { error: textResponse };
        }
        
        if (!response.ok) {
            const finalError = result.message || result.detail || result.error || errorMessage;
            console.error('❌ Erro detalhado do servidor:', finalError);
            throw new Error(finalError);
        }
        
        const agentId = result.id;
        console.log('✅ Agente criado com ID:', agentId);
        
        showToast('Agente criado com sucesso!', 'success');
        
        // If WhatsApp is enabled, connect the agent to the instance
        if (whatsappEnabled && instanceName) {
            await connectAgentToWhatsApp(agentId, instanceName);
        }
        
        // Refresh agents list
        await loadAgents();
        
        // Reset form
        agentForm.reset();
        document.getElementById('enable-whatsapp').checked = false;
        handleWhatsAppToggle({ target: { checked: false } });
        
        return result;
        
    } catch (error) {
        console.error('❌ Erro ao criar agente:', error);
        showToast(`Erro ao criar agente: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoadingOverlay();
    }
}

// Connect Agent to WhatsApp Instance
async function connectAgentToWhatsApp(agentId, instanceName) {
    try {
        console.log(`🔗 Conectando agente ${agentId} à instância WhatsApp ${instanceName}`);
        
        showLoadingOverlay();
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/whatsapp/${instanceName}/connect-agent/${agentId}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log('✅ Agente conectado ao WhatsApp:', result);
            showToast(`Agente conectado ao WhatsApp como instância "${instanceName}"`, 'success');
        } else {
            console.warn('⚠️ Falha ao conectar agente ao WhatsApp:', result);
            showToast('Agente criado, mas houve erro na conexão WhatsApp', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Erro ao conectar agente ao WhatsApp:', error);
        showToast('Agente criado, mas falha na conexão WhatsApp', 'warning');
    }
}

// =====================================================
// ENHANCED AGENT DELETION WITH WHATSAPP CLEANUP
// =====================================================

// Enhanced delete agent function with WhatsApp cleanup
async function deleteAgentWithWhatsApp(agentId, agentName) {
    // Show comprehensive deletion warning
    const confirmed = await showDeleteConfirmationModal(agentId, agentName);
    if (!confirmed) return;
    
    const deleteBtn = document.querySelector(`[onclick*="deleteAgent('${agentId}')"]`);
    const originalText = deleteBtn?.textContent || '';
    
    try {
        if (deleteBtn) {
            deleteBtn.textContent = '🗑️ Excluindo...';
            deleteBtn.disabled = true;
        }
        
        showLoadingOverlay();
        
        console.log(`🗑️ Excluindo agente ${agentId} com limpeza WhatsApp`);
        
        // Delete agent (this will also clean up WhatsApp instances via backend)
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents/${agentId}`, {
            method: 'DELETE',
            timeout: 45000 // Longer timeout for cleanup
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Agente excluído com sucesso:', result);
            
            // Show detailed deletion results
            let message = `Agente "${agentName}" excluído com sucesso!`;
            
            if (result.whatsapp_instances_found && result.whatsapp_instances_found.length > 0) {
                message += `\\n\\n📱 Instâncias WhatsApp removidas: ${result.whatsapp_instances_found.length}`;
                
                if (result.evolution_api_summary) {
                    const { successful, failed, attempted } = result.evolution_api_summary;
                    if (attempted > 0) {
                        message += `\\n   • Evolution API: ${successful}/${attempted} removidas`;
                        if (failed > 0) {
                            message += ` (${failed} falharam)`;
                        }
                    }
                }
            }
            
            if (result.local_database_cleanup) {
                const cleanup = result.local_database_cleanup;
                message += `\\n\\n🗄️ Limpeza local:`;
                if (cleanup.whatsapp_instances_deleted > 0) {
                    message += `\\n   • ${cleanup.whatsapp_instances_deleted} instância(s) WhatsApp`;
                }
                if (cleanup.chat_messages_deleted > 0) {
                    message += `\\n   • ${cleanup.chat_messages_deleted} mensagem(s) de chat`;
                }
            }
            
            showToast(message, 'success');
            
            // Refresh agents list
            await loadAgents();
            
        } else {
            throw new Error(result.message || result.detail || 'Erro ao excluir agente');
        }
        
    } catch (error) {
        console.error('❌ Erro ao excluir agente:', error);
        showToast(`Erro ao excluir agente: ${error.message}`, 'error');
    } finally {
        hideLoadingOverlay();
        
        if (deleteBtn) {
            deleteBtn.textContent = originalText;
            deleteBtn.disabled = false;
        }
    }
}

// Show Delete Confirmation Modal
async function showDeleteConfirmationModal(agentId, agentName) {
    return new Promise((resolve) => {
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay" id="delete-confirmation-modal" style="display: flex;">
                <div class="modal-content delete-confirmation-modal">
                    <div class="modal-header">
                        <h3>⚠️ Confirmar Exclusão</h3>
                        <button class="modal-close" onclick="closeDeleteModal(false)">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="delete-warning">
                            <p>Você está prestes a excluir permanentemente o agente <strong>"${agentName}"</strong>.</p>
                            
                            <div class="warning-details">
                                <p><strong>Esta ação irá remover:</strong></p>
                                <ul>
                                    <li><i class="fas fa-robot"></i> Todos os dados do agente</li>
                                    <li><i class="fab fa-whatsapp"></i> Instâncias WhatsApp conectadas</li>
                                    <li><i class="fas fa-comments"></i> Histórico de conversas</li>
                                    <li><i class="fas fa-plug"></i> Configurações de integração</li>
                                </ul>
                            </div>
                            
                            <div class="danger-notice">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Esta ação não pode ser desfeita!</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" onclick="closeDeleteModal(false)">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button class="delete-confirm-btn" onclick="closeDeleteModal(true)">
                            <i class="fas fa-trash"></i> Excluir Permanentemente
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Store resolve function globally for buttons
        window.resolveDeleteModal = resolve;
    });
}

// Close Delete Modal
function closeDeleteModal(confirmed) {
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
        modal.remove();
    }
    
    if (window.resolveDeleteModal) {
        window.resolveDeleteModal(confirmed);
        delete window.resolveDeleteModal;
    }
}

// Form submission handler will be initialized in the main DOMContentLoaded

console.log('🚀 Script WhatsApp Integration carregado com sucesso!');
