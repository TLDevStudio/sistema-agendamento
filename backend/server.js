const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

/* ── Serviços cadastrados ── */
const SERVICES = [
    { id: 0, name: 'Serviço 1', duration: 0, price: 0 },
    { id: 1, name: 'Serviço 2', duration: 0, price: 0 },
    { id: 2, name: 'Serviço 3', duration: 0, price: 0 },
    { id: 3, name: 'Serviço 4', duration: 0, price: 0 },
    { id: 4, name: 'Serviço 5', duration: 0, price: 0 },
    { id: 5, name: 'Serviço 6', duration: 0, price: 0 },
];

const HORARIOS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
];

/* ── MongoDB ── */
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Erro MongoDB:', err));

const agendamentoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    nome: String,
    whatsapp: String,
    date: String,
    time: String,
    service_id: Number,
    service_name: String,
    price: Number,
    duration: Number,
    observacao: String,
    status: { type: String, default: 'confirmado' },
    criado_em: String,
    cancelado_em: String,
});

const Agendamento = mongoose.model('Agendamento', agendamentoSchema);

/* ── Express ── */
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ── Helpers ── */
function addMinutes(time, mins) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function getSlotsOcupados(agendamento) {
    const svc = SERVICES.find(s => s.id === agendamento.service_id);
    if (!svc || !svc.duration) return [agendamento.time];

    const fim = addMinutes(agendamento.time, svc.duration);
    const [fh, fm] = fim.split(':').map(Number);
    const fimMin = fh * 60 + fm;

    return HORARIOS.filter(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotMin = sh * 60 + sm;
        const [ih, im] = agendamento.time.split(':').map(Number);
        const inicioMin = ih * 60 + im;
        return slotMin >= inicioMin && slotMin < fimMin;
    });
}

function isValidDate(str) {
    return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

/* ── ROTAS ── */

// GET /slots?date=YYYY-MM-DD
app.get('/slots', async (req, res) => {
    const { date } = req.query;
    if (!date || !isValidDate(date))
        return res.status(400).json({ error: 'Parâmetro date inválido. Use YYYY-MM-DD.' });

    const agendamentosDia = await Agendamento.find({ date, status: { $ne: 'cancelado' } });

    const ocupados = new Set();
    agendamentosDia.forEach(ag => getSlotsOcupados(ag).forEach(s => ocupados.add(s)));

    const slots = HORARIOS.map(slot => ({ time: slot, available: !ocupados.has(slot) }));
    res.json({ date, slots });
});

// POST /agendamentos
app.post('/agendamentos', async (req, res) => {
    const { nome, whatsapp, date, time, service_id, observacao } = req.body;

    if (!nome || !whatsapp || !date || !time || service_id === undefined)
        return res.status(400).json({ error: 'Campos obrigatórios: nome, whatsapp, date, time, service_id.' });

    if (!isValidDate(date))
        return res.status(400).json({ error: 'Data inválida. Use YYYY-MM-DD.' });

    const svc = SERVICES.find(s => s.id === Number(service_id));
    if (!svc) return res.status(400).json({ error: 'Serviço não encontrado.' });

    if (!HORARIOS.includes(time))
        return res.status(400).json({ error: 'Horário inválido.' });

    const agendamentosDia = await Agendamento.find({ date, status: { $ne: 'cancelado' } });
    const ocupados = new Set();
    agendamentosDia.forEach(ag => getSlotsOcupados(ag).forEach(s => ocupados.add(s)));

    if (ocupados.has(time))
        return res.status(409).json({ error: 'Horário já ocupado. Por favor, escolha outro.' });

    const novo = new Agendamento({
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
    });

    await novo.save();
    console.log(`[NOVO] ${novo.nome} · ${svc.name} · ${date} ${time}`);
    res.status(201).json({ message: 'Agendamento criado com sucesso!', agendamento: novo });
});

// GET /agendamentos
app.get('/agendamentos', async (req, res) => {
    const { date, status } = req.query;
    const filtro = {};
    if (date) filtro.date = date;
    if (status) filtro.status = status;

    const lista = await Agendamento.find(filtro).sort({ date: 1, time: 1 });
    res.json({ total: lista.length, agendamentos: lista });
});

// GET /agendamentos/:id
app.get('/agendamentos/:id', async (req, res) => {
    const ag = await Agendamento.findOne({ id: req.params.id });
    if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' });
    res.json(ag);
});

// PATCH /agendamentos/:id/cancelar
app.patch('/agendamentos/:id/cancelar', async (req, res) => {
    const ag = await Agendamento.findOne({ id: req.params.id });
    if (!ag) return res.status(404).json({ error: 'Agendamento não encontrado.' });
    if (ag.status === 'cancelado')
        return res.status(400).json({ error: 'Agendamento já está cancelado.' });

    ag.status = 'cancelado';
    ag.cancelado_em = new Date().toISOString();
    await ag.save();

    console.log(`[CANCELADO] id=${req.params.id}`);
    res.json({ message: 'Agendamento cancelado.' });
});

// GET /servicos
app.get('/servicos', (req, res) => res.json(SERVICES));

// GET /health
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// POST /admin/login
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    const senha = process.env.ADMIN_PASSWORD || 'harmonia2026';
    if (password === senha) {
        res.json({ ok: true });
    } else {
        res.status(401).json({ error: 'Senha incorreta.' });
    }
});

/* ── Start ── */
app.listen(PORT, () => {
    console.log(`\n🌿 Studio Harmonia Backend`);
    console.log(`   Rodando em http://localhost:${PORT}\n`);
});