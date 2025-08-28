// API Base URL
const API_BASE_URL = 'http://localhost:8000/api';

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

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicação...');
    
    try {
        initializeTabs();
        initializeEventListeners();
        initializeIntegrations();
        initializePaymentIntegrations();
        initializeEvolutionAPI();
        
        // Verificações iniciais
        checkSystemHealth();
        loadAgents();
        
        // Verificação periódica de saúde do sistema
        setInterval(checkSystemHealth, CONFIG.HEALTH_CHECK_INTERVAL);
        
        console.log('Aplicação inicializada com sucesso!');
        
    } catch (error) {
        console.error('Erro durante a inicialização:', error);
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
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
            method: 'GET',
            timeout: 8000
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
            showToast('Não foi possível conectar ao backend. Verifique se está rodando na porta 8000.', 'error');
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
        agentForm.addEventListener('submit', handleAgentFormSubmit);
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

// Handle agent form submission
async function handleAgentFormSubmit(e) {
    e.preventDefault();
    
    console.log('Iniciando criação de agente...');
    
    const formData = new FormData(e.target);
    
    // Coleta dados básicos do formulário
    const agentData = {
        name: formData.get('name'),
        specialization: formData.get('specialization'),
        description: formData.get('description'),
        model: formData.get('model'),
        instructions: formData.get('instructions'),
        whatsapp_config: {},
        scheduling_config: {}
    };
    
    // Coleta configurações de WhatsApp (se existirem)
    const whatsappTokenEl = document.getElementById('whatsapp-token');
    const whatsappPhoneEl = document.getElementById('whatsapp-phone');
    const evolutionApiUrlEl = document.getElementById('evolution-api-url');
    const evolutionInstanceEl = document.getElementById('evolution-instance-name');
    
    if (whatsappTokenEl || evolutionApiUrlEl) {
        agentData.whatsapp_config = {
            token: whatsappTokenEl?.value || '',
            phone: whatsappPhoneEl?.value || '',
            evolution_api_url: evolutionApiUrlEl?.value || '',
            instance_name: evolutionInstanceEl?.value || ''
        };
    }
    
    // Coleta configurações de agendamento (se existirem)
    const schedulingPlatformEl = document.getElementById('scheduling-platform');
    const schedulingApiKeyEl = document.getElementById('scheduling-api-key');
    
    if (schedulingPlatformEl || schedulingApiKeyEl) {
        agentData.scheduling_config = {
            platform: schedulingPlatformEl?.value || '',
            api_key: schedulingApiKeyEl?.value || ''
        };
    }
    
    console.log('Dados do agente coletados:', agentData);
    
    // Validate required fields
    if (!agentData.name || !agentData.specialization || !agentData.description || !agentData.instructions) {
        const missingFields = [];
        if (!agentData.name) missingFields.push('Nome');
        if (!agentData.specialization) missingFields.push('Especialização');
        if (!agentData.description) missingFields.push('Descrição');
        if (!agentData.instructions) missingFields.push('Instruções');
        
        showToast(`Por favor, preencha os campos obrigatórios: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    const submitBtn = document.getElementById('generate-agent-btn');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    
    try {
        console.log('Exibindo overlay de loading...');
        showLoadingOverlay();
        
        if (submitBtn) {
            submitBtn.textContent = '🔄 Criando Agente...';
            submitBtn.disabled = true;
        }
        
        console.log('Enviando requisição para API...');
        const response = await fetchWithTimeout(`${API_BASE_URL}/agents`, {
            method: 'POST',
            body: JSON.stringify(agentData),
            timeout: 30000 // 30 segundos para criação
        });
        
        console.log('Resposta da API:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorMessage = 'Erro ao criar agente';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
                console.error('Erro detalhado da API:', errorData);
            } catch (parseError) {
                console.error('Erro ao parsear resposta de erro:', parseError);
                errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('Agente criado com sucesso:', result);
        
        currentAgentCode = result.code || 'Código não disponível';
        currentAgentName = agentData.name;
        
        // Show generated code
        console.log('Exibindo código gerado...');
        showGeneratedCode();
        showToast(`Agente SDK "${agentData.name}" criado com sucesso!`, 'success');
        
        // Reset form
        console.log('Resetando formulário...');
        e.target.reset();
        updateCharacterCounter();
        
        // Reload agents list
        console.log('Recarregando lista de agentes...');
        loadAgents();
        
    } catch (error) {
        console.error('Erro durante criação do agente:', error);
        
        let userMessage = 'Erro ao criar agente';
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            userMessage = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
        } else if (error.message.includes('Timeout')) {
            userMessage = 'Timeout na criação do agente. O processo pode estar demorado, tente novamente.';
        } else {
            userMessage = `Erro ao criar agente: ${error.message}`;
        }
        
        showToast(userMessage, 'error');
        
    } finally {
        console.log('Finalizando processo de criação...');
        hideLoadingOverlay();
        
        if (submitBtn) {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    }
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
function viewAgent(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
        alert(`Agente: ${agent.name}\nEspecialização: ${getSpecializationName(agent.specialization)}\nDescrição: ${agent.description}`);
    }
}

function editAgent(agentId) {
    showToast('Funcionalidade de edição será implementada em breve', 'info');
}

async function deleteAgent(agentId) {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao excluir agente');
        }
        
        showToast('Agente excluído com sucesso!', 'success');
        loadAgents();
        
    } catch (error) {
        console.error('Error deleting agent:', error);
        showToast('Erro ao excluir agente: ' + error.message, 'error');
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

// Initialize integration toggle switches
function initializeIntegrationToggles() {
    const integrationToggles = document.querySelectorAll('.integration-toggle input[type="checkbox"]');
    
    integrationToggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const integrationName = this.id.replace('enable-', '');
            const configSection = document.getElementById(`${integrationName}-config`);
            
            if (configSection) {
                if (this.checked) {
                    configSection.style.display = 'block';
                    configSection.style.animation = 'slideDown 0.3s ease-out';
                    showToast(`Integração ${getIntegrationDisplayName(integrationName)} ativada`, 'success');
                } else {
                    configSection.style.display = 'none';
                    showToast(`Integração ${getIntegrationDisplayName(integrationName)} desativada`, 'info');
                }
                
                saveIntegrationState(integrationName, this.checked);
            }
        });
    });
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

// Get display name for integrations
function getIntegrationDisplayName(integrationName) {
    const names = {
        'whatsapp': 'WhatsApp Business',
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

// Evolution API Integration Functions
function initializeEvolutionAPI() {
    // Initialize QR Code generation button
    const generateQRBtn = document.getElementById('generate-whatsapp-qr');
    if (generateQRBtn) {
        generateQRBtn.addEventListener('click', generateWhatsAppQR);
    }
    
    // Initialize message test button
    const testMessageBtn = document.getElementById('test-whatsapp-message');
    if (testMessageBtn) {
        testMessageBtn.addEventListener('click', testWhatsAppMessage);
    }
}

// Generate WhatsApp QR Code using Evolution API
async function generateWhatsAppQR() {
    const generateBtn = document.getElementById('generate-whatsapp-qr');
    const qrSection = document.getElementById('whatsapp-qr-section');
    const qrImage = document.getElementById('whatsapp-qr-image');
    const instanceName = document.getElementById('evolution-instance-name').value || 'default';
    
    if (!instanceName.trim()) {
        showToast('Por favor, insira um nome para a instância', 'error');
        return;
    }
    
    const originalText = generateBtn.textContent;
    
    try {
        generateBtn.textContent = 'Gerando QR Code...';
        generateBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/qr-code`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao gerar QR Code');
        }
        
        const result = await response.json();
        
        if (result.qr_code_image) {
            qrImage.src = `data:image/png;base64,${result.qr_code_image}`;
            qrSection.style.display = 'block';
            showToast('QR Code gerado com sucesso! Escaneie com seu WhatsApp.', 'success');
        } else {
            throw new Error('QR Code não foi gerado');
        }
        
    } catch (error) {
        console.error('QR Code generation failed:', error);
        showToast(`Erro ao gerar QR Code: ${error.message}`, 'error');
    } finally {
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    }
}

// Test WhatsApp message sending
async function testWhatsAppMessage() {
    const testBtn = document.getElementById('test-whatsapp-message');
    const instanceName = document.getElementById('evolution-instance-name').value || 'default';
    const testPhone = document.getElementById('evolution-test-phone').value;
    
    if (!instanceName.trim() || !testPhone.trim()) {
        showToast('Preencha o nome da instância e telefone de teste', 'error');
        return;
    }
    
    const originalText = testBtn.textContent;
    
    try {
        testBtn.textContent = 'Enviando...';
        testBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/whatsapp/${instanceName}/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: testPhone,
                message: 'Teste de integração - Agente SDK funcionando! 🤖'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao enviar mensagem');
        }
        
        showToast('Mensagem de teste enviada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Message test failed:', error);
        showToast(`Erro ao enviar mensagem: ${error.message}`, 'error');
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

// Payment Integration Functions
function initializePaymentIntegrations() {
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
        const response = await fetch(`${API_BASE_URL}/calendar/create-event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                summary: title,
                start_datetime: `${date}T${time}:00`,
                end_datetime: `${date}T${time.split(':')[0]}:${parseInt(time.split(':')[1]) + 60}:00`,
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
                to: recipient,
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