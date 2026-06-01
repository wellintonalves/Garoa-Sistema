import { prisma } from '../lib/prisma';

export class ConfiguracaoService {
  /** Busca a configuração única do sistema. Se não existir, cria uma padrão. */
  static async obter() {
    let config = await prisma.configuracao.findFirst();

    if (!config) {
      const horariosPadrao = {
        domingo: { fechado: true },
        segunda: { abertura: '09:00', fechamento: '19:00', fechado: false },
        terca: { abertura: '09:00', fechamento: '19:00', fechado: false },
        quarta: { abertura: '09:00', fechamento: '19:00', fechado: false },
        quinta: { abertura: '09:00', fechamento: '19:00', fechado: false },
        sexta: { abertura: '09:00', fechamento: '20:00', fechado: false },
        sabado: { abertura: '09:00', fechamento: '17:00', fechado: false },
      };

      config = await prisma.configuracao.create({
        data: {
          horariosFuncionamento: horariosPadrao,
          regrasFidelidade: { pontosParaRecompensa: 10 } as any,
        } as any,
      });
    }

    return config;
  }

  /** Atualiza a configuração. Passa o payload completo de atualização. */
  static async atualizar(dados: any) {
    const configAtual = await this.obter();
    return await prisma.configuracao.update({
      where: { id: configAtual.id },
      data: dados,
    });
  }
}
