const API = 'https://sistema-agendamento-qgta.onrender.com';
let allData = [];
let currentFilter = 'todos';

/* ── Init ── */
function init() {
    const picker = document.getElementById('datePicker');
    picker.value = todayStr();
    picker.addEventListener('change', loadAgendamentos);
    loadAgendamentos();
    setInterval(loadAgendamentos, 30000); // auto-refresh a cada 30s
}

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
    document.getElementById('statRevenue').textContent = 'R$' + receita;
}

/* ── Filter ── */
function setFilter(f) {
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

init();