/* ── Data ── */
const SERVICES = [
    { id: 0, icon: '✂️', name: 'Servico 1', duration: '00 min', price: 0 },
    { id: 1, icon: '🎨', name: 'Servico 2', duration: '00 min', price: 0 },
    { id: 2, icon: '💧', name: 'Servico 3', duration: '00 min', price: 0 },
    { id: 3, icon: '💅', name: 'Servico 4', duration: '00 min', price: 0 },
    { id: 4, icon: '🧖', name: 'Servico 5', duration: '00 min', price: 0 },
    { id: 5, icon: '💆', name: 'Servico 6', duration: '00 min', price: 0 },
];

const BUSY_SLOTS = ['10:00', '13:00', '15:30'];

const ALL_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
];

const STEP_LABELS = [
    'Escolha o serviço',
    'Escolha a data',
    'Escolha o horário',
    'Confirme seus dados',
];

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAYS_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/* ── State ── */
const state = {
    step: 0,
    service: null,
    date: null,
    time: null,
    viewYear: 0,
    viewMonth: 0,
};

const today = new Date();
today.setHours(0, 0, 0, 0);

/* ── Init ── */
// DEPOIS
const API = 'http://localhost:3000';

async function init() {
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();

    const res = await fetch(`${API}/servicos`);
    const data = await res.json();
    SERVICES.length = 0;
    data.forEach(s => SERVICES.push({
        id: s.id, icon: SERVICES_ICONS[s.id] || '✂️',
        name: s.name, duration: s.duration + ' min', price: s.price
    }));

    renderServices();
    renderCalendar();
}

const SERVICES_ICONS = ['✂️', '🎨', '💧', '💅', '🧖', '💆'];

/* ── Services ── */
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = '';
    SERVICES.forEach(svc => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.dataset.id = svc.id;
        card.innerHTML = `
        <span class="svc-icon">${svc.icon}</span>
        <div class="svc-name">${svc.name}</div>
        <div class="svc-duration">${svc.duration}</div>
        <div class="svc-price">R$ ${svc.price}</div>
      `;
        card.addEventListener('click', () => selectService(svc.id, card));
        grid.appendChild(card);
    });
}

function selectService(id, el) {
    state.service = id;
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('btnS0').disabled = false;
}

/* ── Calendar ── */
function renderCalendar() {
    document.getElementById('calMonth').textContent =
        MONTHS[state.viewMonth] + ' ' + state.viewYear;

    const grid = document.getElementById('calDays');
    grid.innerHTML = '';

    const firstDay = new Date(state.viewYear, state.viewMonth, 1).getDay();
    const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day cal-empty';
        grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        const cellDt = new Date(state.viewYear, state.viewMonth, d);
        const isPast = cellDt < today;
        const isSunday = cellDt.getDay() === 0;
        const isToday = cellDt.getTime() === today.getTime();
        const isSel = state.date && cellDt.getTime() === state.date.getTime();

        cell.className = 'cal-day'
            + (isPast ? ' cal-past' : '')
            + (isSunday ? ' cal-sunday' : '')
            + (isToday ? ' cal-today' : '')
            + (isSel ? ' cal-selected' : '');
        cell.textContent = d;

        if (!isPast && !isSunday) {
            cell.addEventListener('click', () => selectDay(d, cell));
        }
        grid.appendChild(cell);
    }
}

function selectDay(d, cell) {
    document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('cal-selected'));
    cell.classList.add('cal-selected');
    state.date = new Date(state.viewYear, state.viewMonth, d);
    document.getElementById('btnS1').disabled = false;
}

function selectTime(slot, el) {
    document.querySelectorAll('.time-slot').forEach(c => c.classList.remove('time-selected'));
    el.classList.add('time-selected');
    state.time = slot;
    document.getElementById('btnS2').disabled = false;
}

function changeMonth(dir) {
    state.viewMonth += dir;
    if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
    state.date = null;
    document.getElementById('btnS1').disabled = true;
    renderCalendar();
}

/* ── Times ── */
async function renderTimes() {
    const d = state.date;
    document.getElementById('dateLabel').textContent =
        DAYS_NAMES[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS_SHORT[d.getMonth()];

    const grid = document.getElementById('timesGrid');
    grid.innerHTML = '<p>Carregando...</p>';
    state.time = null;
    document.getElementById('btnS2').disabled = true;

    const dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

    const res = await fetch(`${API}/slots?date=${dateStr}`);
    const data = await res.json();

    grid.innerHTML = '';
    data.slots.forEach(slot => {
        const el = document.createElement('div');
        el.className = 'time-slot' + (!slot.available ? ' time-busy' : '');
        el.textContent = slot.time;
        if (slot.available) el.addEventListener('click', () => selectTime(slot.time, el));
        grid.appendChild(el);
    });
}

/* ── Summary ── */
function renderSummary() {
    const svc = SERVICES[state.service];
    const d = state.date;
    document.getElementById('sumService').textContent = svc.name;
    document.getElementById('sumDate').textContent =
        DAYS_NAMES[d.getDay()] + ', ' + d.getDate() + '/' + String(d.getMonth() + 1).padStart(2, '0');
    document.getElementById('sumTime').textContent = state.time;
    document.getElementById('sumDuration').textContent = svc.duration;
    document.getElementById('sumPrice').textContent = 'R$ ' + svc.price;
}

/* ── Form validation ── */
function checkForm() {
    const nome = document.getElementById('inputNome').value.trim();
    const wpp = document.getElementById('inputWpp').value.replace(/\D/g, '');
    document.getElementById('btnS3').disabled = !(nome.length >= 3 && wpp.length >= 10);
}

function maskPhone(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 11);
    if (v.length >= 7) {
        v = '(' + v.substring(0, 2) + ') ' + v.substring(2, 7) + '-' + v.substring(7);
    } else if (v.length >= 3) {
        v = '(' + v.substring(0, 2) + ') ' + v.substring(2);
    } else if (v.length >= 1) {
        v = '(' + v;
    }
    el.value = v;
}

/* ── Confirm ── */
async function confirmBooking() {
    const nome = document.getElementById('inputNome').value.trim();
    const wpp = document.getElementById('inputWpp').value.replace(/\D/g, '');
    const obs = document.getElementById('inputObs').value.trim();
    const svc = SERVICES[state.service];
    const d = state.date;

    const dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

    const res = await fetch(`${API}/agendamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome, whatsapp: wpp, date: dateStr,
            time: state.time, service_id: state.service, observacao: obs
        })
    });

    if (!res.ok) {
        showToast('Erro ao agendar. Tente outro horário.');
        return;
    }

    document.getElementById('successMsg').innerHTML =
        'Olá, <strong>' + nome + '</strong>! Seu agendamento foi registrado com sucesso. ' +
        'Enviaremos uma confirmação no seu WhatsApp em breve.';

    document.getElementById('successCard').innerHTML = `
      <div class="success-card-row"><span class="ico">✂️</span> <span>${svc.name} &nbsp;·&nbsp; ${svc.duration}</span></div>
      <div class="success-card-row"><span class="ico">📅</span> <span><strong>${DAYS_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}</strong></span></div>
      <div class="success-card-row"><span class="ico">🕐</span> <span><strong>${state.time}</strong></span></div>
      <div class="success-card-row"><span class="ico">💰</span> <span><strong>R$ ${svc.price}</strong></span></div>
    `;

    goStep(4);
}

/* ── WhatsApp ── */
function sendWhatsApp() {
    const nome = document.getElementById('inputNome').value.trim();
    const wpp = document.getElementById('inputWpp').value.replace(/\D/g, '');
    const svc = SERVICES[state.service];
    const d = state.date;

    const msg = encodeURIComponent(
        'Olá! Acabei de agendar pelo site.\n' +
        '📋 Serviço: ' + svc.name + '\n' +
        '📅 Data: ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + '\n' +
        '🕐 Horário: ' + state.time + '\n' +
        '👤 Nome: ' + nome
    );

    window.open('https://wa.me/5521980000000?text=' + msg, '_blank');
}

/* ── Navigation ── */
function goStep(n) {
    state.step = n;

    document.querySelectorAll('.step-content').forEach((el, i) => {
        el.classList.toggle('active', i === n);
    });

    for (let i = 0; i < 4; i++) {
        const pip = document.getElementById('pip' + i);
        pip.className = 'step-pip';
        if (i < n) pip.classList.add('done');
        else if (i === n) pip.classList.add('active');
    }

    const label = document.getElementById('stepLabel');
    label.textContent = n < 4 ? STEP_LABELS[n] : 'Agendamento confirmado';

    if (n === 2) renderTimes();
    if (n === 3) renderSummary();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Restart ── */
function restart() {
    state.service = null;
    state.date = null;
    state.time = null;
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();

    document.getElementById('inputNome').value = '';
    document.getElementById('inputWpp').value = '';
    document.getElementById('inputObs').value = '';
    document.getElementById('btnS0').disabled = true;

    renderServices();
    renderCalendar();
    goStep(0);
}

/* ── Toast ── */
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── Start ── */
init();