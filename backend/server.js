const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

/* ── Serviços ── */
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

/* ── Schemas ── */
const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    senha: { type: String, required: true },
    confirmado: { type: Boolean, default: false },
    token_confirmacao: { type: String },
    criado_em: { type: String, default: () => new Date().toISOString() },
});

const agendamentoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    usuario_id: { type: String },
    nome: String,
    email: String,
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

const Usuario = mongoose.model('Usuario', usuarioSchema);
const Agendamento = mongoose.model('Agendamento', agendamentoSchema);

/* ── Email ── */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function enviarEmailConfirmacao(email, nome, token) {
    const BASE_URL = process.env.BASE_URL || 'https://sistema-agendamento-qgta.onrender.com';
    const link = `${BASE_URL}/auth/confirmar/${token}`;

    await transporter.sendMail({
        from: `"Studio Harmonia" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Confirme seu cadastro',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                <h2 style="font-size:1.4rem;margin-bottom:8px;">Olá, ${nome}!</h2>
                <p style="color:#555;margin-bottom:24px;">Clique no botão abaixo para confirmar seu cadastro e acessar o sistema de agendamento.</p>
                <a href="${link}"
                   style="display:inline-block;background:#0e0e0e;color:#fff;padding:14px 28px;
                          border-radius:8px;text-decoration:none;font-weight:600;">
                   Confirmar cadastro
                </a>
                <p style="color:#aaa;font-size:12px;margin-top:24px;">Se você não criou uma conta, ignore este email.</p>
            </div>
        `,
    });
}

/* ── Express ── */
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ── Middleware JWT ── */
function autenticar(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return res.status(401).json({ error: 'Token não fornecido.' });

    try {
        const payload = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'fallback-secret');
        req.usuario = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido.' });
    }
}

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

/* ══════════════════════════════════════
   ROTAS DE AUTENTICAÇÃO
══════════════════════════════════════ */

// POST /auth/cadastro
app.post('/auth/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha)
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });

    if (senha.length < 6)
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

    const existe = await Usuario.findOne({ email: email.toLowerCase() });
    if (existe)
        return res.status(409).json({ error: 'Este email já está cadastrado.' });

    const hash = await bcrypt.hash(senha, 10);
    const token = crypto.randomBytes(32).toString('hex');

    const usuario = new Usuario({
        nome: nome.trim(),
        email: email.toLowerCase(),
        senha: hash,
        token_confirmacao: token,
    });

    await usuario.save();

    try {
        await enviarEmailConfirmacao(email, nome, token);
    } catch (e) {
        console.error('Erro ao enviar email:', e.message);
    }

    res.status(201).json({ message: 'Cadastro realizado! Verifique seu email para confirmar a conta.' });
});

// GET /auth/confirmar/:token
app.get('/auth/confirmar/:token', async (req, res) => {
    const usuario = await Usuario.findOne({ token_confirmacao: req.params.token });

    if (!usuario)
        return res.status(400).send('<h2>Link inválido ou expirado.</h2>');

    usuario.confirmado = true;
    usuario.token_confirmacao = null;
    await usuario.save();

    // Redireciona para a página de login
    const FRONTEND = process.env.FRONTEND_URL || 'https://tldevstudio.github.io/sistema-agendamento';
    res.redirect(`${FRONTEND}/login.html?confirmado=1`);
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha)
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

    const usuario = await Usuario.findOne({ email: email.toLowerCase() });
    if (!usuario)
        return res.status(401).json({ error: 'Email ou senha incorretos.' });

    if (!usuario.confirmado)
        return res.status(403).json({ error: 'Confirme seu email antes de fazer login.' });

    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk)
        return res.status(401).json({ error: 'Email ou senha incorretos.' });

    const token = jwt.sign(
        { id: usuario._id.toString(), nome: usuario.nome, email: usuario.email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
    );

    res.json({ token, nome: usuario.nome, email: usuario.email });
});

/* ══════════════════════════════════════
   ROTAS DO CLIENTE (autenticadas)
══════════════════════════════════════ */

// GET /cliente/agendamentos
app.get('/cliente/agendamentos', autenticar, async (req, res) => {
    const lista = await Agendamento
        .find({ usuario_id: req.usuario.id })
        .sort({ date: -1, time: -1 });
    res.json({ total: lista.length, agendamentos: lista });
});

// PATCH /cliente/agendamentos/:id/cancelar
app.patch('/cliente/agendamentos/:id/cancelar', autenticar, async (req, res) => {
    const ag = await Agendamento.findOne({ id: req.params.id, usuario_id: req.usuario.id });

    if (!ag)
        return res.status(404).json({ error: 'Agendamento não encontrado.' });

    if (ag.status === 'cancelado')
        return res.status(400).json({ error: 'Agendamento já está cancelado.' });

    ag.status = 'cancelado';
    ag.cancelado_em = new Date().toISOString();
    await ag.save();

    res.json({ message: 'Agendamento cancelado com sucesso.' });
});

/* ══════════════════════════════════════
   ROTAS PÚBLICAS
══════════════════════════════════════ */

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
    const { nome, whatsapp, date, time, service_id, observacao, token_cliente } = req.body;

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

    // Se cliente logado, associa ao usuário
    let usuario_id = null;
    let email_cliente = null;
    if (token_cliente) {
        try {
            const payload = jwt.verify(token_cliente, process.env.JWT_SECRET || 'fallback-secret');
            usuario_id = payload.id;
            email_cliente = payload.email;
        } catch { }
    }

    const novo = new Agendamento({
        id: Date.now().toString(),
        usuario_id,
        nome: nome.trim(),
        email: email_cliente,
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

// PATCH /agendamentos/:id/cancelar (admin)
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