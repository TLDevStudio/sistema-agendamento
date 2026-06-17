const API = 'https://sistema-agendamento-qgta.onrender.com';
let allData = [];
let currentFilter = 'todos';

/* ── Init ── */
function init() {
    const senha = sessionStorage.getItem('adminPassword');
    if (!senha) {
        showLogin();
    } else {
        showPainel();
    }
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
        </div>
    `;
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
            <div class="logo">
                <div class="logo-dot"></div>
                Studio Harmonia · Admin
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span class="badge-live">PAINEL</span>
                <button class="btn-refresh" onclick="logout()">Sair</button>
            </div>
        </header>

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

        <div class="toast" id="toast"></div>
    `;

    const picker = document.getElementById('datePicker');
    picker.value = todayStr();
    picker.addEventListener('change', loadAgendamentos);
    loadAgendamentos();
    setInterval(loadAgendamentos, 30000);
}

function logout() {
    sessionStorage.removeItem('adminPassword');
    showLogin();
}

/* ── Helpers de data ── */
function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/* ── Load ── */
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
    } catch (e) {
        document.getElementById('tableContent').innerHTML =
            '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Não foi possível conectar ao servidor.</div></div>';
    }
}

/* ── Stats ── */
function updateStats() {
    const confirmados = allData.filter(a => a.status === 'confirmado');
    const cancelados = allData.filter(a => a.status === 'cancelado');
    const receita = confirmados.reduce((s, a) => s + (a.price || 0), 0);

    document.getElementById('statTotal').textContent = allData.length;
    document.getElementById('statConfirm').textContent = confirmados.length;
    document.getElementById('statCancel').textContent = cancelados.length;
    document.getElementById('statRevenue').textContent = 'R$ ' + receita;
}

/* ── Filter ── */
function setFilter(f, event) {
    currentFilter = f;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderTable();
}

/* ── Table ── */
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
        <tr id="row-${a.id}">
            <td class="td-time">${a.time}</td>
            <td class="td-name">${a.nome}</td>
            <td class="td-service">${a.service_name}</td>
            <td class="td-price">R$ ${a.price}</td>
            <td class="td-wpp">
                <a href="https://wa.me/${a.whatsapp}" target="_blank">📲 ${formatPhone(a.whatsapp)}</a>
            </td>
            <td>
                <span class="status-badge status-${a.status}">${a.status}</span>
            </td>
            <td>
                <button class="btn-cancel"
                    onclick="cancelar('${a.id}')"
                    ${a.status === 'cancelado' ? 'disabled' : ''}>
                    Cancelar
                </button>
            </td>
        </tr>
    `).join('');

    document.getElementById('tableContent').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Horário</th>
                    <th>Cliente</th>
                    <th>Serviço</th>
                    <th>Valor</th>
                    <th>WhatsApp</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

/* ── Cancel ── */
async function cancelar(id) {
    if (!confirm('Cancelar este agendamento?')) return;

    try {
        const res = await fetch(`${API}/agendamentos/${id}/cancelar`, { method: 'PATCH' });
        if (res.ok) {
            showToast('Agendamento cancelado.');
            loadAgendamentos();
        } else {
            showToast('Erro ao cancelar.');
        }
    } catch {
        showToast('Erro de conexão.');
    }
}

/* ── Helpers ── */
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

/* ── Start ── */
init();