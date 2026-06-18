const API = 'https://sistema-agendamento-qgta.onrender.com';
let allData = [];
let currentFilter = 'todos';
let currentTab = 'hoje';

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/* ── Init ── */
function init() {
    const senha = sessionStorage.getItem('adminPassword');
    if (!senha) showLogin();
    else showPainel();
}

/* ── Login ── */
function showLogin() {
    document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f0f0f;">
            <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:40px;width:320px;">
                <div style="font-size:1.1rem;font-weight:600;margin-bottom:8px;color:#f0f0f0;">Studio Harmonia</div>
                <div style="font-size:0.8rem;color:#888;margin-bottom:28px;">Acesso restrito · Admin</div>
                <input id="pwdInput" type="password" placeholder="Senha"
                    style="width:100%;background:#0f0f0f;border:1px solid #2a2a2a;color:#f0f0f0;
                           padding:10px 14px;border-radius:8px;font-size:0.9rem;margin-bottom:12px;"
                    onkeydown="if(event.key==='Enter') doLogin()" />
                <button onclick="doLogin()"
                    style="width:100%;background:#c8f564;color:#000;border:none;padding:10px;
                           border-radius:8px;font-weight:600;font-size:0.9rem;cursor:pointer;">
                    Entrar
                </button>
                <div id="loginErr" style="color:#ff5c5c;font-size:0.8rem;margin-top:10px;text-align:center;"></div>
            </div>
        </div>`;
}

async function doLogin() {
    const pwd = document.getElementById('pwdInput').value;
    if (!pwd) return;
    try {
        const res = await fetch(`${API}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        if (res.ok) {
            sessionStorage.setItem('adminPassword', pwd);
            showPainel();
        } else {
            document.getElementById('loginErr').textContent = 'Senha incorreta.';
        }
    } catch {
        document.getElementById('loginErr').textContent = 'Erro de conexão com o servidor.';
    }
}

/* ── Painel ── */
function showPainel() {
    document.body.innerHTML = `
        <header>
            <div class="logo"><div class="logo-dot"></div>Studio Harmonia · Admin</div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span class="badge-live">PAINEL</span>
                <button class="btn-refresh" onclick="logout()">Sair</button>
            </div>
        </header>

        <div style="display:flex;border-bottom:1px solid #2a2a2a;">
            <button id="tab-hoje" onclick="switchTab('hoje')"
                style="padding:14px 28px;background:transparent;border:none;border-bottom:2px solid #c8f564;
                       color:#f0f0f0;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:600;cursor:pointer;">
                📅 Hoje
            </button>
            <button id="tab-historico" onclick="switchTab('historico')"
                style="padding:14px 28px;background:transparent;border:none;border-bottom:2px solid transparent;
                       color:#888;font-family:'DM Sans',sans-serif;font-size:0.88rem;cursor:pointer;">
                📊 Histórico
            </button>
        </div>

        <div id="view-hoje">
            <div class="toolbar">
                <div class="date-picker">
                    <label>Data</label>
                    <input type="date" id="datePicker" />
                </div>
                <div class="filter-tabs">
                    <button class="filter-tab active" onclick="setFilter('todos', event)">Todos</button>
                    <button class="filter-tab" onclick="setFilter('confirmado', event)">Confirmados</button>
                    <button class="filter-tab" onclick="setFilter('cancelado', event)">Cancelados</button>
                </div>
                <button class="btn-refresh" onclick="loadAgendamentos()">↻ Atualizar</button>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-label">Total do dia</div>
                    <div class="stat-value" id="statTotal">—</div>
                    <div class="stat-sub">agendamentos</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Confirmados</div>
                    <div class="stat-value" id="statConfirm">—</div>
                    <div class="stat-sub">no dia</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Cancelados</div>
                    <div class="stat-value" id="statCancel">—</div>
                    <div class="stat-sub">no dia</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Receita prevista</div>
                    <div class="stat-value" id="statRevenue">—</div>
                    <div class="stat-sub">confirmados</div>
                </div>
            </div>

            <div class="table-wrap">
                <div class="section-title" id="tableTitle">Agendamentos</div>
                <div id="tableContent">
                    <div class="loading"><div class="spinner"></div> Carregando...</div>
                </div>
            </div>
        </div>

        <div id="view-historico" style="display:none;">
            <div class="toolbar" style="justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="btn-refresh" onclick="changeHistMonth(-1)">‹</button>
                    <span id="histMonthLabel" style="font-size:0.95rem;font-weight:600;color:#f0f0f0;min-width:140px;text-align:center;"></span>
                    <button class="btn-refresh" onclick="changeHistMonth(1)">›</button>
                </div>
                <div id="histStats" style="display:flex;gap:16px;font-size:0.82rem;color:#888;flex-wrap:wrap;"></div>
            </div>
            <div class="table-wrap">
                <div id="histContent">
                    <div class="loading"><div class="spinner"></div> Carregando...</div>
                </div>
            </div>
        </div>

        <!-- Modal de detalhes -->
        <div id="modalOverlay" onclick="closeModal()"
            style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;"></div>

        <div id="modalSheet"
            style="display:none;position:fixed;bottom:0;left:0;right:0;background:#1a1a1a;
                   border-radius:20px 20px 0 0;border-top:1px solid #2a2a2a;z-index:201;
                   transform:translateY(100%);transition:transform 0.3s cubic-bezier(.32,.72,0,1);
                   max-height:85vh;overflow-y:auto;">
            <div style="text-align:center;padding:12px;">
                <div style="width:40px;height:4px;background:#333;border-radius:2px;display:inline-block;"></div>
            </div>
            <div id="modalContent" style="padding:0 24px 40px;"></div>
        </div>

        <div class="toast" id="toast"></div>`;

    const picker = document.getElementById('datePicker');
    picker.value = todayStr();
    picker.addEventListener('change', loadAgendamentos);
    loadAgendamentos();
    setInterval(loadAgendamentos, 30000);
}

/* ── Modal ── */
function openModal(ag) {
    const [y, m, d] = ag.date.split('-');
    const diaSemana = DAYS_PT[new Date(ag.date).getDay()];
    const isCancel = ag.status === 'cancelado';

    document.getElementById('modalContent').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
            <div>
                <div style="font-size:1.2rem;font-weight:600;color:#f0f0f0;">${ag.nome}</div>
                <div style="font-size:0.82rem;color:#888;margin-top:2px;">${diaSemana}, ${d}/${m}/${y}</div>
            </div>
            <span class="status-badge status-${ag.status}">${ag.status}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
            <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px;">
                <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Horário</div>
                <div style="font-family:'DM Mono',monospace;font-size:1.4rem;color:#c8f564;font-weight:500;">${ag.time}</div>
            </div>
            <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px;">
                <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Valor</div>
                <div style="font-family:'DM Mono',monospace;font-size:1.4rem;color:#c8f564;font-weight:500;">R$ ${ag.price}</div>
            </div>
            <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px;">
                <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Serviço</div>
                <div style="font-size:0.92rem;color:#f0f0f0;font-weight:500;">${ag.service_name}</div>
            </div>
            <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px;">
                <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Duração</div>
                <div style="font-size:0.92rem;color:#f0f0f0;font-weight:500;">${ag.duration} min</div>
            </div>
        </div>

        <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:12px;">
            <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">WhatsApp</div>
            <a href="https://wa.me/${ag.whatsapp}" target="_blank"
               style="color:#c8f564;text-decoration:none;font-family:'DM Mono',monospace;font-size:0.92rem;">
                📲 ${formatPhone(ag.whatsapp)}
            </a>
        </div>

        ${ag.observacao ? `
        <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:12px;">
            <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Observação</div>
            <div style="font-size:0.88rem;color:#f0f0f0;">${ag.observacao}</div>
        </div>` : ''}

        ${ag.cancelado_em ? `
        <div style="background:#2a1a1a;border:1px solid #3a2a2a;border-radius:12px;padding:16px;margin-bottom:12px;">
            <div style="font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Cancelado em</div>
            <div style="font-size:0.88rem;color:#ff5c5c;">${new Date(ag.cancelado_em).toLocaleString('pt-BR')}</div>
        </div>` : ''}

        <div style="font-size:0.7rem;color:#555;margin-bottom:20px;">
            Agendado em ${new Date(ag.criado_em).toLocaleString('pt-BR')}
        </div>

        ${!isCancel ? `
        <button onclick="cancelarDoModal('${ag.id}')"
            style="width:100%;padding:12px;border-radius:10px;border:1px solid #ff5c5c;
                   background:transparent;color:#ff5c5c;font-family:'DM Sans',sans-serif;
                   font-size:0.9rem;cursor:pointer;transition:all 0.15s;"
            onmouseover="this.style.background='#ff5c5c';this.style.color='#fff'"
            onmouseout="this.style.background='transparent';this.style.color='#ff5c5c'">
            Cancelar agendamento
        </button>` : ''}
    `;

    const overlay = document.getElementById('modalOverlay');
    const sheet = document.getElementById('modalSheet');
    overlay.style.display = 'block';
    sheet.style.display = 'block';
    requestAnimationFrame(() => {
        sheet.style.transform = 'translateY(0)';
    });
}

function closeModal() {
    const sheet = document.getElementById('modalSheet');
    const overlay = document.getElementById('modalOverlay');
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
        sheet.style.display = 'none';
        overlay.style.display = 'none';
    }, 300);
}

async function cancelarDoModal(id) {
    if (!confirm('Cancelar este agendamento?')) return;
    try {
        const res = await fetch(`${API}/agendamentos/${id}/cancelar`, { method: 'PATCH' });
        if (res.ok) {
            showToast('Agendamento cancelado.');
            closeModal();
            loadAgendamentos();
            if (currentTab === 'historico') loadHistorico();
        } else {
            showToast('Erro ao cancelar.');
        }
    } catch { showToast('Erro de conexão.'); }
}

/* ── Tabs ── */
function switchTab(tab) {
    currentTab = tab;
    const isHoje = tab === 'hoje';

    document.getElementById('view-hoje').style.display = isHoje ? 'block' : 'none';
    document.getElementById('view-historico').style.display = isHoje ? 'none' : 'block';

    document.getElementById('tab-hoje').style.borderBottomColor = isHoje ? '#c8f564' : 'transparent';
    document.getElementById('tab-hoje').style.color = isHoje ? '#f0f0f0' : '#888';
    document.getElementById('tab-historico').style.borderBottomColor = isHoje ? 'transparent' : '#c8f564';
    document.getElementById('tab-historico').style.color = isHoje ? '#888' : '#f0f0f0';

    if (!isHoje) loadHistorico();
}

/* ── Histórico ── */
let histYear = new Date().getFullYear();
let histMonth = new Date().getMonth();

function changeHistMonth(dir) {
    histMonth += dir;
    if (histMonth > 11) { histMonth = 0; histYear++; }
    if (histMonth < 0) { histMonth = 11; histYear--; }
    loadHistorico();
}

async function loadHistorico() {
    document.getElementById('histMonthLabel').textContent = MONTHS_PT[histMonth] + ' ' + histYear;
    document.getElementById('histContent').innerHTML =
        '<div class="loading"><div class="spinner"></div> Carregando...</div>';

    try {
        const res = await fetch(`${API}/agendamentos`);
        const data = await res.json();
        const todos = data.agendamentos || [];

        const doMes = todos.filter(a => {
            const [y, m] = a.date.split('-').map(Number);
            return y === histYear && m === histMonth + 1;
        });

        renderHistorico(doMes);
    } catch {
        document.getElementById('histContent').innerHTML =
            '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Erro ao carregar histórico.</div></div>';
    }
}

function renderHistorico(dados) {
    if (dados.length === 0) {
        document.getElementById('histStats').innerHTML = '';
        document.getElementById('histContent').innerHTML =
            '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Nenhum agendamento neste mês.</div></div>';
        return;
    }

    const confirmados = dados.filter(a => a.status === 'confirmado');
    const cancelados = dados.filter(a => a.status === 'cancelado');
    const receita = confirmados.reduce((s, a) => s + (a.price || 0), 0);

    document.getElementById('histStats').innerHTML = `
        <span>Total: <strong style="color:#f0f0f0">${dados.length}</strong></span>
        <span>✓ <strong style="color:#4ade80">${confirmados.length}</strong></span>
        <span>✗ <strong style="color:#ff5c5c">${cancelados.length}</strong></span>
        <span>R$ <strong style="color:#c8f564">${receita}</strong></span>`;

    const porDia = {};
    dados.forEach(a => {
        if (!porDia[a.date]) porDia[a.date] = [];
        porDia[a.date].push(a);
    });

    const dias = Object.keys(porDia).sort();

    const html = dias.map(date => {
        const [y, m, d] = date.split('-');
        const ags = porDia[date];
        const conf = ags.filter(a => a.status === 'confirmado');
        const canc = ags.filter(a => a.status === 'cancelado');
        const rec = conf.reduce((s, a) => s + (a.price || 0), 0);
        const diaSemana = DAYS_PT[new Date(date).getDay()];

        const cards = ags.map(a => `
            <div onclick='openModal(${JSON.stringify(a)})'
                style="display:flex;align-items:center;justify-content:space-between;
                       padding:12px 16px;border:1px solid #2a2a2a;border-radius:10px;
                       margin-bottom:8px;cursor:pointer;transition:background 0.15s;background:#0f0f0f;"
                onmouseover="this.style.background='#1f1f1f'"
                onmouseout="this.style.background='#0f0f0f'">
                <div style="display:flex;align-items:center;gap:14px;">
                    <span style="font-family:'DM Mono',monospace;font-size:0.95rem;color:#c8f564;font-weight:500;min-width:42px;">${a.time}</span>
                    <div>
                        <div style="font-size:0.88rem;font-weight:500;color:#f0f0f0;">${a.nome}</div>
                        <div style="font-size:0.78rem;color:#888;margin-top:1px;">${a.service_name}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-family:'DM Mono',monospace;font-size:0.82rem;color:#f0f0f0;">R$ ${a.price}</span>
                    <span class="status-badge status-${a.status}" style="font-size:0.65rem;">${a.status}</span>
                    <span style="color:#555;font-size:0.8rem;">›</span>
                </div>
            </div>`).join('');

        return `
            <div style="margin-bottom:12px;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
                <div onclick="toggleDia('dia-${date}')"
                    style="display:flex;align-items:center;justify-content:space-between;
                           padding:14px 20px;cursor:pointer;background:#1a1a1a;user-select:none;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-family:'DM Mono',monospace;font-size:1rem;color:#c8f564;font-weight:500;">${d}/${m}</span>
                        <span style="font-size:0.8rem;color:#888;">${diaSemana} · ${ags.length} agendamento(s)</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;font-size:0.78rem;">
                        <span style="color:#4ade80">✓ ${conf.length}</span>
                        <span style="color:#ff5c5c">✗ ${canc.length}</span>
                        <span style="color:#c8f564">R$ ${rec}</span>
                        <span style="color:#555;" id="arrow-dia-${date}">▼</span>
                    </div>
                </div>
                <div id="dia-${date}" style="display:none;padding:12px 16px;">
                    ${cards}
                </div>
            </div>`;
    }).join('');

    document.getElementById('histContent').innerHTML = html;
}

function toggleDia(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    const open = el.style.display === 'none';
    el.style.display = open ? 'block' : 'none';
    arrow.textContent = open ? '▲' : '▼';
}

function logout() {
    sessionStorage.removeItem('adminPassword');
    showLogin();
}

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

async function loadAgendamentos() {
    const date = document.getElementById('datePicker').value;
    document.getElementById('tableContent').innerHTML =
        '<div class="loading"><div class="spinner"></div> Carregando...</div>';
    try {
        const res = await fetch(`${API}/agendamentos?date=${date}`);
        const data = await res.json();
        allData = data.agendamentos || [];
        updateStats();
        renderTable();
    } catch {
        document.getElementById('tableContent').innerHTML =
            '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Não foi possível conectar ao servidor.</div></div>';
    }
}

function updateStats() {
    const confirmados = allData.filter(a => a.status === 'confirmado');
    const cancelados = allData.filter(a => a.status === 'cancelado');
    const receita = confirmados.reduce((s, a) => s + (a.price || 0), 0);
    document.getElementById('statTotal').textContent = allData.length;
    document.getElementById('statConfirm').textContent = confirmados.length;
    document.getElementById('statCancel').textContent = cancelados.length;
    document.getElementById('statRevenue').textContent = 'R$ ' + receita;
}

function setFilter(f, event) {
    currentFilter = f;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderTable();
}

function renderTable() {
    const filtered = currentFilter === 'todos'
        ? allData
        : allData.filter(a => a.status === currentFilter);

    const date = document.getElementById('datePicker').value;
    const [y, m, d] = date.split('-');
    document.getElementById('tableTitle').textContent =
        `${filtered.length} agendamento(s) · ${d}/${m}/${y}`;

    if (filtered.length === 0) {
        document.getElementById('tableContent').innerHTML =
            '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Nenhum agendamento encontrado.</div></div>';
        return;
    }

    const rows = filtered.map(a => `
        <tr style="cursor:pointer;" onclick='openModal(${JSON.stringify(a)})'>
            <td class="td-time">${a.time}</td>
            <td class="td-name">${a.nome}</td>
            <td class="td-service">${a.service_name}</td>
            <td class="td-price">R$ ${a.price}</td>
            <td><span class="status-badge status-${a.status}">${a.status}</span></td>
        </tr>`).join('');

    document.getElementById('tableContent').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Horário</th><th>Cliente</th><th>Serviço</th>
                    <th>Valor</th><th>Status</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

async function cancelar(id) {
    if (!confirm('Cancelar este agendamento?')) return;
    try {
        const res = await fetch(`${API}/agendamentos/${id}/cancelar`, { method: 'PATCH' });
        if (res.ok) { showToast('Agendamento cancelado.'); loadAgendamentos(); }
        else showToast('Erro ao cancelar.');
    } catch { showToast('Erro de conexão.'); }
}

function formatPhone(n) {
    if (!n) return '';
    const d = n.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return d;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

init();