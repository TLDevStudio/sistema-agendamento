const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

/* ── Banco de dados (arquivo JSON) ── */
const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

db.defaults({
    agendamentos: [],
    config: {
        horarios: [
            '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
            '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
        ],
        whatsapp_dono: '5521980000000',
        nome_salao: 'Studio Harmonia',
    },
}).write();

/* ── Serviços cadastrados ── */
const SERVICES = [
    { id: 0, name: 'Corte & Escova', duration: 60, price: 80 },
    { id: 1, name: 'Coloração', duration: 120, price: 180 },
    { id: 2, name: 'Hidratação', duration: 45, price: 60 },
    { id: 3, name: 'Manicure', duration: 40, price: 45 },
    { id: 4, name: 'Tratamento Capilar', duration: 90, price: 120 },
    { id: 5, name: 'Massagem Craniana', duration: 30, price: 50 },
];

/* ── Express ── */
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ── Helpers ── */

// Converte "09:30" + duração (min) → "10:10"
function addMinutes(time, mins) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

// Retorna todos os slots que um agendamento bloqueia
// (o slot de início + qualquer slot que caia dentro da duração)
function getSlotsOcupados(agendamento) {
    const svc = SERVICES.find(s => s.id === agendamento.service_id);
    if (!svc) return [agendamento.time];

    const todos = db.get('config.horarios').value();
    const inicio = agendamento.time;
    const fim = addMinutes(inicio, svc.duration);
    const [fh, fm] = fim.split(':').map(Number);

    return todos.filter(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotMin = sh * 60 + sm;
        const inicioMin = agendamento.time.split(':').map(Number).reduce((h, m) => h * 60 + m);
        const fimMin = fh * 60 + fm;
        return slotMin >= inicioMin && slotMin < fimMin;
    });
}

// Valida formato de data YYYY-MM-DD
function isValidDate(str) {
    return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

/* ──────────────────────────────────────────────
   ROTAS
─────────────────────────────────────────────── */

// GET /slots?date=2025-06-20
// Retorna horários disponíveis e ocupados para o dia
app.get('/slots', (req, res) => {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
        return res.status(400).json({ error: 'Parâmetro date inválido. Use YYYY-MM-DD.' });
    }

    const todos = db.get('config.horarios').value();

    // Pega agendamentos do dia com status != cancelado
    const agendamentosDia = db.get('agendamentos')
        .filter(a => a.date === date && a.status !== 'cancelado')
        .value();

    // Expande quais slots estão bloqueados
    const ocupados = new Set();
    agendamentosDia.forEach(ag => {
        getSlotsOcupados(ag).forEach(s => ocupados.add(s));
    });

    const slots = todos.map(slot => ({
        time: slot,
        available: !ocupados.has(slot),
    }));

    res.json({ date, slots });
});

// POST /agendamentos
// Cria um novo agendamento
app.post('/agendamentos', (req, res) => {
    const { nome, whatsapp, date, time, service_id, observacao } = req.body;

    // Validações básicas
    if (!nome || !whatsapp || !date || !time || service_id === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: nome, whatsapp, date, time, service_id.' });
    }

    if (!isValidDate(date)) {
        return res.status(400).json({ error: 'Data inválida. Use YYYY-MM-DD.' });
    }

    const svc = SERVICES.find(s => s.id === Number(service_id));
    if (!svc) {
        return res.status(400).json({ error: 'Serviço não encontrado.' });
    }

    const todos = db.get('config.horarios').value();
    if (!todos.includes(time)) {
        return res.status(400).json({ error: 'Horário inválido.' });
    }

    // Verifica se o slot ainda está disponível
    const agendamentosDia = db.get('agendamentos')
        .filter(a => a.date === date && a.status !== 'cancelado')
        .value();

    const ocupados = new Set();
    agendamentosDia.forEach(ag => {
        getSlotsOcupados(ag).forEach(s => ocupados.add(s));
    });

    if (ocupados.has(time)) {
        return res.status(409).json({ error: 'Horário já ocupado. Por favor, escolha outro.' });
    }

    const novoAgendamento = {
        id: Date.now().toString(),
        nome: nome.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        date,
        time,
        service_id: Number(service_id),
        service_name: svc.name,
        price: svc.price,
        duration: svc.duration,
        observacao: observacao ? observacao.trim() : '',
        status: 'confirmado',
        criado_em: new Date().toISOString(),
    };

    db.get('agendamentos').push(novoAgendamento).write();

    console.log(`[NOVO] ${novoAgendamento.nome} · ${svc.name} · ${date} ${time}`);

    res.status(201).json({
        message: 'Agendamento criado com sucesso!',
        agendamento: novoAgendamento,
    });
});

// GET /agendamentos
// Lista agendamentos com filtros opcionais: ?date=YYYY-MM-DD&status=confirmado
app.get('/agendamentos', (req, res) => {
    const { date, status } = req.query;

    let query = db.get('agendamentos');

    if (date) query = query.filter(a => a.date === date);
    if (status) query = query.filter(a => a.status === status);

    const lista = query
        .orderBy(['date', 'time'], ['asc', 'asc'])
        .value();

    res.json({ total: lista.length, agendamentos: lista });
});

// GET /agendamentos/:id
// Busca um agendamento específico
app.get('/agendamentos/:id', (req, res) => {
    const ag = db.get('agendamentos').find({ id: req.params.id }).value();
    if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' });
    res.json(ag);
});

// PATCH /agendamentos/:id/cancelar
// Cancela um agendamento
app.patch('/agendamentos/:id/cancelar', (req, res) => {
    const ag = db.get('agendamentos').find({ id: req.params.id }).value();
    if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' });

    if (ag.status === 'cancelado') {
        return res.status(400).json({ error: 'Agendamento já está cancelado.' });
    }

    db.get('agendamentos')
        .find({ id: req.params.id })
        .assign({ status: 'cancelado', cancelado_em: new Date().toISOString() })
        .write();

    console.log(`[CANCELADO] id=${req.params.id}`);

    res.json({ message: 'Agendamento cancelado.' });
});

// GET /servicos
// Lista serviços disponíveis
app.get('/servicos', (req, res) => {
    res.json(SERVICES);
});

// GET /health
// Healthcheck simples
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ── Start ── */
app.listen(PORT, () => {
    console.log(`\n🌿 Studio Harmonia Backend`);
    console.log(`   Rodando em http://localhost:${PORT}`);
    console.log(`   Banco de dados: db.json\n`);
});