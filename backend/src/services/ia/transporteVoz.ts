import { VOZ_LOCAL, ENVELOPE_VOZ_MICROUSD, custoRespostaVoz } from './limitesVoz';
import { decidirSupervisaoVoz } from './supervisaoVoz';

type Evento = Record<string, any>;
export interface DependenciasVoz {
  enviarProvedor: (evento: Evento) => void;
  enviarCliente: (evento: Evento) => void;
  fecharProvedor: () => void;
  autorizar: () => Promise<void>;
  consultar: (nome: string, argumentos: unknown) => Promise<unknown>;
  inicio: (id: string) => Promise<void>;
  finalizar: (uso: { confirmado: boolean; custo: number; sessao: string; segundos: number }) => Promise<void>;
  agora?: () => number;
}

/** Somente PCM binário e encerramento entram pelo navegador. Configuração,
 * ferramentas, respostas e contadores pertencem exclusivamente ao servidor.
 */
export class TransporteVoz {
  private agora: () => number;
  private inicioMs: number;
  private atividade: number;
  private ocupada = false;
  private usuarioFalando = false;
  private falaAte = 0;
  private pronta = false;
  private fechando = false;
  private terminada = false;
  private incerta = false;
  private geracoes = 0;
  private concluidas = new Set<string>();
  private custo = 0;
  private sessao = '';
  private bytesAudio = 0;
  private bytesSaida = 0;
  private prazoFechamento = 0;
  private avisou = false;
  private motivo = 'Conversa encerrada.';

  constructor(private d: DependenciasVoz, private configuracao: Evento, private encerrarAte: number) {
    this.agora = d.agora ?? Date.now; this.inicioMs = this.agora(); this.atividade = this.inicioMs;
  }

  abrir() { this.d.enviarProvedor({ type: 'session.update', session: this.configuracao }); }

  audio(pcm: Buffer) {
    if (!this.pronta || this.fechando || this.ocupada || this.agora() < this.falaAte) return;
    if (pcm.length === 0 || pcm.length > 9600 || pcm.length % 2) return this.encerrar(true);
    this.bytesAudio += pcm.length;
    // PCM mono 24 kHz: taxa e duração limitadas também no servidor.
    if (this.bytesAudio > Math.min(VOZ_LOCAL.segundos * 48000, (this.agora() - this.inicioMs + 1000) * 48)) return this.encerrar(true);
    this.d.enviarProvedor({ type: 'input_audio_buffer.append', audio: pcm.toString('base64') });
  }

  private async responder(aposFerramenta = false) {
    if (this.fechando || this.ocupada) return;
    if (this.agora() >= this.encerrarAte) return this.encerrar(false, 'A conversa atingiu o limite de 90 segundos.');
    if (this.custo + ENVELOPE_VOZ_MICROUSD > VOZ_LOCAL.reservaMicrousd)
      return this.encerrar(false, 'A conversa atingiu o limite de custo deste teste.');
    await this.d.autorizar();
    if (this.fechando) return;
    this.geracoes++; this.ocupada = true; this.bytesSaida = 0;
    this.d.enviarCliente({ tipo: 'estado', estado: 'respondendo' });
    this.d.enviarProvedor({ type: 'response.create', response: { max_output_tokens: VOZ_LOCAL.saidaTokens,
      tool_choice: aposFerramenta ? 'none' : 'auto' } });
  }

  async evento(e: Evento) {
    if (this.terminada) return;
    if (e.type === 'session.created') {
      if (typeof e.session?.id !== 'string' || this.sessao) throw new Error('Sessão inválida.');
      this.sessao = e.session.id; await this.d.inicio(this.sessao);
    } else if (e.type === 'session.updated') {
      const s = e.session;
      if (s?.max_output_tokens !== VOZ_LOCAL.saidaTokens
        || s?.truncation?.token_limits?.post_instructions !== VOZ_LOCAL.contextoTokens
        || s?.audio?.input?.turn_detection?.create_response !== false
        || s?.audio?.input?.transcription != null
        || s?.audio?.output?.voice !== VOZ_LOCAL.voz) throw new Error('Limites do provedor não confirmados.');
      this.pronta = true; this.d.enviarCliente({ tipo: 'estado', estado: 'ouvindo' });
    } else if (e.type === 'input_audio_buffer.speech_started') {
      this.atividade = this.agora(); this.avisou = false; this.usuarioFalando = true;
    } else if (e.type === 'input_audio_buffer.speech_stopped') {
      this.atividade = this.agora(); this.usuarioFalando = false;
    } else if (e.type === 'input_audio_buffer.committed') {
      this.atividade = this.agora(); await this.responder();
    } else if (e.type === 'response.created') {
      if (!this.ocupada) throw new Error('Geração inesperada.');
    } else if (e.type === 'response.output_audio.delta') {
      if (!this.ocupada || typeof e.delta !== 'string' || e.delta.length > 100000) throw new Error('Áudio inválido.');
      this.bytesSaida += Buffer.from(e.delta, 'base64').length;
      // 256 tokens de áudio correspondem a cerca de 12,8s; margem de framing.
      if (this.bytesSaida > 20 * 48000) throw new Error('Saída excedeu o limite.');
      this.falaAte = Math.max(this.falaAte, this.agora()) + Buffer.from(e.delta, 'base64').length / 48;
      if (!this.fechando) this.d.enviarCliente({ tipo: 'audio', audio: e.delta });
    } else if (e.type === 'response.output_audio_transcript.done') {
      if (!this.fechando && typeof e.transcript === 'string' && e.transcript.length <= 4000)
        this.d.enviarCliente({ tipo: 'texto', texto: e.transcript });
    } else if (e.type === 'response.done') {
      const r = e.response;
      if (typeof r?.id !== 'string') throw new Error('Resposta inválida.');
      if (this.concluidas.has(r.id)) return;
      if (!this.ocupada) throw new Error('Resposta sem geração autorizada.');
      this.custo += custoRespostaVoz(r.usage); this.concluidas.add(r.id); this.ocupada = false;
      if (this.custo > VOZ_LOCAL.reservaMicrousd) throw new Error('Uso excedeu a reserva.');
      this.atividade = Math.max(this.agora(), Math.ceil(this.falaAte));
      if (this.fechando) { this.d.fecharProvedor(); return; }
      const chamadas = (r.output ?? []).filter((item: Evento) => item.type === 'function_call');
      if (chamadas.length) {
        if (r.status !== 'completed' || chamadas.length !== 1) return this.encerrar();
        const call = chamadas[0];
        if (typeof call.call_id !== 'string' || typeof call.arguments !== 'string' || call.arguments.length > 4000) throw new Error('Consulta inválida.');
        this.ocupada = true;
        let resultado: unknown;
        try { resultado = await this.d.consultar(call.name, JSON.parse(call.arguments)); }
        catch { resultado = { indisponivel: true, orientacao: 'Não foi possível consultar. Não invente resultados.' }; }
        this.ocupada = false;
        if (this.fechando) { this.d.fecharProvedor(); return; }
        let output = JSON.stringify(resultado);
        // Uma ferramenta grande nunca desaparece silenciosamente por truncamento.
        if (Buffer.byteLength(output) > 1200) output = JSON.stringify({ indisponivel: true,
          orientacao: 'O resultado não cabe neste teste curto de voz. Peça para continuar essa consulta por texto; não invente nem apresente resultado parcial.' });
        this.d.enviarProvedor({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output } });
        await this.responder(true);
      }
    } else if (e.type === 'error') {
      throw new Error('O provedor não confirmou a sessão.');
    }
  }

  tick() {
    if (this.terminada) return;
    // Use o mesmo instante em toda a decisão. A atividade pode apontar para
    // o fim futuro da reprodução; duas leituras geravam falso estado inválido.
    const agora = this.agora();
    if (this.fechando) { if (agora >= this.prazoFechamento) this.d.fecharProvedor(); return; }
    const fala = agora < this.falaAte;
    const decisao = decidirSupervisaoVoz({ agoraMs: agora, encerrarAteMs: this.encerrarAte,
      ultimaAtividadeMs: Math.min(this.atividade, agora), ocupada: this.ocupada || fala || this.usuarioFalando, conexaoPerdida: false });
    if (decisao.acao === 'encerrar') {
      if (decisao.motivo === 'LIMITE_RESERVADO') return this.encerrar(false, 'A conversa atingiu o limite de 90 segundos.');
      if (decisao.motivo === 'INATIVIDADE') return this.encerrar(false, 'Conversa encerrada após 60 segundos sem atividade.');
      return this.encerrar(true);
    }
    if (!this.pronta && agora - this.inicioMs > 15000) return this.encerrar(true);
    if (this.custo + ENVELOPE_VOZ_MICROUSD > VOZ_LOCAL.reservaMicrousd && !this.ocupada && !fala)
      return this.encerrar(false, 'A conversa atingiu o limite de custo deste teste.');
    if (decisao.acao === 'avisar' && !this.avisou) { this.avisou = true; this.d.enviarCliente({ tipo: 'aviso', texto: 'A conversa será encerrada em 15 segundos sem atividade.' }); }
    if (this.pronta && !this.ocupada && !fala) this.d.enviarCliente({ tipo: 'estado', estado: 'ouvindo' });
  }

  encerrar(incerta = false, motivo = 'Conversa encerrada.') {
    this.incerta ||= incerta;
    if (this.fechando || this.terminada) return;
    this.motivo = motivo;
    this.fechando = true; this.prazoFechamento = this.agora() + 2000;
    this.d.enviarCliente({ tipo: 'estado', estado: 'encerrando' });
    if (this.ocupada) this.d.enviarProvedor({ type: 'response.cancel' });
    else this.d.fecharProvedor();
  }

  async fechou(codigo: number) {
    if (this.terminada) return;
    this.terminada = true;
    const confirmado = codigo === 1000 && !this.incerta && this.concluidas.size === this.geracoes && Boolean(this.sessao);
    await this.d.finalizar({ confirmado, custo: this.custo, sessao: this.sessao,
      segundos: Math.min(VOZ_LOCAL.segundos, Math.ceil((this.agora() - this.inicioMs) / 1000)) });
    this.d.enviarCliente({ tipo: 'fim', texto: confirmado ? this.motivo : 'Conversa encerrada. O consumo aguarda confirmação; a reserva foi preservada.' });
  }
}
