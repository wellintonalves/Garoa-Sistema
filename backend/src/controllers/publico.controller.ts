import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { tenantStorage } from '../lib/als';
import { validarEscritaAssinatura } from '../services/acessoAssinatura.service';
import { ErroDeNegocio } from '../lib/erros';
import { ClienteAuthRequest } from '../types';
import { ClienteAppService } from '../services/clienteApp.service';
import { AgendamentoService } from '../services/agendamento.service';
import { validarVinculoCliente } from '../services/acessoAgenda.service';
import { objetoPermitido, texto, listaIds } from '../utils/entradaSegura.util';
import { reciboAgendamento } from '../utils/agendamentoEntrada.util';
import { toBrasiliaDate, diaBrasiliaStr, getHoraMinutoBrasilia } from '../lib/timezone';

async function unidadeAtiva(id: unknown): Promise<string> {
  const barbeariaId = texto(id);
  const barbearia = await prisma.barbearia.findFirst({ where: { id: barbeariaId, ativo: true }, select: { id: true } });
  if (!barbearia) throw new ErroDeNegocio('Barbearia não encontrada.', 404);
  return barbearia.id;
}

async function clienteVerificado(req: ClienteAuthRequest): Promise<string> {
  if (!req.cliente) throw new ErroDeNegocio('Entre na sua conta para continuar.', 401);
  const cliente = await prisma.cliente.findFirst({
    where: { id: req.cliente.clienteId, usuarioId: req.cliente.usuarioId, usuario: { papel: 'CLIENTE', emailVerificado: true } },
    select: { id: true },
  });
  if (!cliente) throw new ErroDeNegocio('Entre na sua conta para continuar.', 401);
  return cliente.id;
}

export class PublicoController {
  static async buscarBarbeariaPorSlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbearia = await prisma.barbearia.findFirst({
        where: { slug: texto(req.params.slug), ativo: true },
        select: { id: true, nome: true, slug: true, logo: true, endereco: true },
      });
      if (!barbearia) throw new ErroDeNegocio('Barbearia não encontrada.', 404);
      res.json(barbearia);
    } catch (error) { next(error); }
  }

  static async listarServicos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbeariaId = await unidadeAtiva(req.query.barbeariaId);
      res.json(await prisma.servico.findMany({
        where: { barbeariaId, ativo: true }, orderBy: { nome: 'asc' },
        select: { id: true, nome: true, descricao: true, preco: true, duracaoMinutos: true, cor: true },
      }));
    } catch (error) { next(error); }
  }

  static async listarBarbeiros(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbeariaId = await unidadeAtiva(req.query.barbeariaId);
      res.json(await prisma.barbeiro.findMany({
        where: { barbeariaId, ativo: true },
        select: { id: true, foto: true, especialidades: true, usuario: { select: { nome: true } } },
      }));
    } catch (error) { next(error); }
  }

  static async listarHorariosDisponiveis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbeariaId = await unidadeAtiva(req.query.barbeariaId);
      const data = texto(req.query.data, 10);
      const servicoId = texto(req.query.servicoId);
      const barbeiroId = req.query.barbeiroId === undefined ? 'sem_preferencia' : texto(req.query.barbeiroId);
      const barbeiros = await prisma.barbeiro.findMany({
        where: { barbeariaId, ativo: true, ...(barbeiroId !== 'sem_preferencia' ? { id: barbeiroId } : {}) }, select: { id: true },
      });
      const horarios = new Set<string>();
      for (const barbeiro of barbeiros) {
        const slots = await ClienteAppService.horariosDisponiveis(barbeariaId, barbeiro.id, data, servicoId);
        for (const slot of slots) if (slot.disponivel) horarios.add(slot.horario);
      }
      res.json([...horarios].sort());
    } catch (error) { next(error); }
  }

  /** Compatibility alias: a phone or customer ID is never proof of identity. */
  static async criarAgendamento(req: ClienteAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clienteId = await clienteVerificado(req);
      const dados = objetoPermitido(req.body, ['barbeariaId', 'barbeiroId', 'servicoId', 'servicosIds', 'dataHora', 'observacoes']);
      const barbeariaId = await unidadeAtiva(dados.barbeariaId);
      await validarVinculoCliente(clienteId, barbeariaId);
      await validarEscritaAssinatura(barbeariaId, 'POST', '/publico/agendamentos');
      const servicoId = texto(dados.servicoId);
      const servicosIds = listaIds(dados.servicosIds ?? [servicoId]);
      const dataHora = texto(dados.dataHora, 40);
      const inicio = toBrasiliaDate(dataHora);
      if (!Number.isFinite(inicio.getTime()) || inicio.getTime() <= Date.now()) throw new ErroDeNegocio('Escolha um horário futuro válido.');
      let barbeiroId = dados.barbeiroId === undefined ? 'sem_preferencia' : texto(dados.barbeiroId);
      if (barbeiroId === 'sem_preferencia') {
        const barbeiros = await prisma.barbeiro.findMany({ where: { barbeariaId, ativo: true }, select: { id: true } });
        const { hora, minuto } = getHoraMinutoBrasilia(inicio);
        const horario = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
        for (const barbeiro of barbeiros) {
          const slots = await ClienteAppService.horariosDisponiveis(barbeariaId, barbeiro.id, diaBrasiliaStr(inicio), servicosIds.join(','), clienteId);
          if (slots.some(slot => slot.disponivel && slot.horario === horario)) { barbeiroId = barbeiro.id; break; }
        }
        if (barbeiroId === 'sem_preferencia') throw new ErroDeNegocio('Horário indisponível. Escolha outro horário.', 409);
      }
      const agendamento = await tenantStorage.run({ barbeariaId }, () => AgendamentoService.criar({
        barbeariaId, clienteId, barbeiroId, servicoId, servicosIds, dataHora,
        observacoes: dados.observacoes === undefined ? undefined : texto(dados.observacoes, 4000, true),
        origem: 'ONLINE', status: 'CONFIRMADO',
      }, { id: req.cliente!.usuarioId, papel: 'CLIENTE', barbeariaId }));
      res.status(201).json(reciboAgendamento(agendamento));
    } catch (error) { next(error); }
  }

  /** Compatibility alias for the customer's own loyalty in one connected business. */
  static async checarFidelidade(req: ClienteAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clienteId = await clienteVerificado(req);
      objetoPermitido(req.query, ['barbeariaId']);
      const barbeariaId = await unidadeAtiva(req.query.barbeariaId);
      await validarVinculoCliente(clienteId, barbeariaId);
      await validarEscritaAssinatura(barbeariaId, 'GET', '/publico/fidelidade');
      res.json(await tenantStorage.run({ barbeariaId }, () => ClienteAppService.fidelidade(clienteId, barbeariaId)));
    } catch (error) { next(error); }
  }
}
