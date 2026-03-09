import type { FastifyInstance } from 'fastify';
import { PlayerStatus, TableStatus, TxType } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../../db/prisma';
import { requireAuth } from '../../shared/middlewares/auth';

const messageErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  required: ['message'],
} as const;

const playerResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    tableId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'CASHOUT'] },
    createdAt: { type: 'string', format: 'date-time' },
    buyInInicialCents: { type: 'integer' },
    totalInvestidoCents: { type: 'integer' },
    valorFinalCents: { type: ['integer', 'null'] },
    resultadoCents: { type: ['integer', 'null'] },
    cashoutAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: [
    'id',
    'tableId',
    'name',
    'status',
    'createdAt',
    'buyInInicialCents',
    'totalInvestidoCents',
  ],
} as const;

const tablePathSchema = z.object({
  tableId: z.string().uuid(),
});

const playerPathSchema = z.object({
  playerId: z.string().uuid(),
});

const createPlayerBodySchema = z.object({
  name: z.string().trim().min(1),
  buyInCents: z.number().int().positive().optional(),
}).strict();

const rebuyBodySchema = z.object({
  amountCents: z.number().int().min(100),
}).strict();

const cashoutBodySchema = z.object({
  valorFinalCents: z.number().int().min(0),
}).strict();

const updatePlayerBodySchema = z.object({
  name: z.string().trim().min(1),
}).strict();

const upsertRankingByResult = async (params: {
  ownerUserId: string;
  tableId: string;
  playerName: string;
  resultadoCents: number;
}) => {
  const ranking = await prisma.ranking.findUnique({
    where: {
      ownerUserId_playerName: {
        ownerUserId: params.ownerUserId,
        playerName: params.playerName,
      },
    },
  });

  if (!ranking) {
    await prisma.ranking.create({
      data: {
        ownerUserId: params.ownerUserId,
        tableId: params.tableId,
        playerName: params.playerName,
        totalLucroCents: params.resultadoCents,
        partidasJogadas: 1,
        partidasGanhas: params.resultadoCents > 0 ? 1 : 0,
        partidasPerdidas: params.resultadoCents < 0 ? 1 : 0,
      },
    });
    return;
  }

  await prisma.ranking.update({
    where: { id: ranking.id },
    data: {
      totalLucroCents: ranking.totalLucroCents + params.resultadoCents,
      partidasJogadas: ranking.partidasJogadas + 1,
      partidasGanhas: ranking.partidasGanhas + (params.resultadoCents > 0 ? 1 : 0),
      partidasPerdidas: ranking.partidasPerdidas + (params.resultadoCents < 0 ? 1 : 0),
      tableId: params.tableId,
    },
  });
};

export const playersRoutes = async (app: FastifyInstance) => {
  app.get('/table/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Listar jogadores da mesa',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            players: { type: 'array', items: playerResponseSchema },
          },
          required: ['players'],
        },
        400: messageErrorSchema,
        404: messageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = tablePathSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: parsedParams.error.flatten(),
      });
    }

    const table = await prisma.table.findFirst({
      where: {
        id: parsedParams.data.tableId,
        ownerUserId: request.user.id,
      },
      select: { id: true },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const players = await prisma.tablePlayer.findMany({
      where: { tableId: table.id },
      orderBy: { createdAt: 'asc' },
    });

    return { players };
  });

  app.post('/table/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Adicionar jogador com buy-in mínimo',
      security: [{ bearerAuth: [] }],
      response: {
        201: {
          type: 'object',
          properties: {
            player: playerResponseSchema,
          },
          required: ['player'],
        },
        400: messageErrorSchema,
        404: messageErrorSchema,
        409: messageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = tablePathSchema.safeParse(request.params);
    const parsedBody = createPlayerBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    const table = await prisma.table.findFirst({
      where: {
        id: parsedParams.data.tableId,
        ownerUserId: request.user.id,
      },
      select: {
        id: true,
        status: true,
        buyInMinimoCents: true,
        totalMesaCents: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    if (table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite adicionar jogador.' });
    }

    const buyInCents = parsedBody.data.buyInCents ?? table.buyInMinimoCents;

    if (buyInCents < table.buyInMinimoCents) {
      return reply.status(409).send({
        message: `Buy-in deve ser maior ou igual ao mínimo da mesa (${table.buyInMinimoCents} centavos).`,
      });
    }

    const [player] = await prisma.$transaction([
      prisma.tablePlayer.create({
        data: {
          tableId: table.id,
          name: parsedBody.data.name,
          status: PlayerStatus.ACTIVE,
          buyInInicialCents: buyInCents,
          totalInvestidoCents: buyInCents,
        },
      }),
      prisma.table.update({
        where: { id: table.id },
        data: {
          totalMesaCents: table.totalMesaCents + buyInCents,
          ajusteProporcionalAplicado: false,
        },
      }),
    ]);

    await prisma.transaction.create({
      data: {
        tableId: table.id,
        tablePlayerId: player.id,
        type: TxType.BUY_IN,
        amountCents: buyInCents,
      },
    });

    return reply.status(201).send({ player });
  });

  app.patch('/:playerId/rebuy', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Registrar rebuy',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            player: playerResponseSchema,
          },
          required: ['player'],
        },
        400: messageErrorSchema,
        404: messageErrorSchema,
        409: messageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = playerPathSchema.safeParse(request.params);
    const parsedBody = rebuyBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    const player = await prisma.tablePlayer.findFirst({
      where: {
        id: parsedParams.data.playerId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      include: {
        table: {
          select: {
            id: true,
            status: true,
            permitirRebuy: true,
            totalMesaCents: true,
          },
        },
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    if (player.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite rebuy.' });
    }

    if (!player.table.permitirRebuy) {
      return reply.status(409).send({ message: 'Rebuy desabilitado nas configurações da mesa.' });
    }

    if (player.status !== PlayerStatus.ACTIVE) {
      return reply.status(409).send({ message: 'Apenas jogador ativo pode fazer rebuy.' });
    }

    const amountCents = parsedBody.data.amountCents;

    const [updatedPlayer] = await prisma.$transaction([
      prisma.tablePlayer.update({
        where: { id: player.id },
        data: {
          totalInvestidoCents: player.totalInvestidoCents + amountCents,
        },
      }),
      prisma.table.update({
        where: { id: player.table.id },
        data: {
          totalMesaCents: player.table.totalMesaCents + amountCents,
          ajusteProporcionalAplicado: false,
        },
      }),
      prisma.transaction.create({
        data: {
          tableId: player.table.id,
          tablePlayerId: player.id,
          type: TxType.REBUY,
          amountCents,
        },
      }),
    ]);

    return { player: updatedPlayer };
  });

  app.patch('/:playerId/cashout', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Fazer cash out de jogador ativo',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            player: playerResponseSchema,
          },
          required: ['player'],
        },
        400: messageErrorSchema,
        404: messageErrorSchema,
        409: messageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = playerPathSchema.safeParse(request.params);
    const parsedBody = cashoutBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    const player = await prisma.tablePlayer.findFirst({
      where: {
        id: parsedParams.data.playerId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      include: {
        table: {
          select: {
            id: true,
            ownerUserId: true,
            status: true,
            totalMesaCents: true,
          },
        },
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    if (player.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite cash out.' });
    }

    if (player.status !== PlayerStatus.ACTIVE) {
      return reply.status(409).send({ message: 'Jogador já realizou cash out.' });
    }

    const valorFinalCents = parsedBody.data.valorFinalCents;
    const resultadoCents = valorFinalCents - player.totalInvestidoCents;

    const [updatedPlayer] = await prisma.$transaction([
      prisma.tablePlayer.update({
        where: { id: player.id },
        data: {
          status: PlayerStatus.CASHOUT,
          valorFinalCents,
          resultadoCents,
          cashoutAt: new Date(),
        },
      }),
      prisma.table.update({
        where: { id: player.table.id },
        data: {
          totalMesaCents: Math.max(player.table.totalMesaCents - valorFinalCents, 0),
          ajusteProporcionalAplicado: false,
        },
      }),
      prisma.transaction.create({
        data: {
          tableId: player.table.id,
          tablePlayerId: player.id,
          type: TxType.CASH_OUT,
          amountCents: valorFinalCents,
        },
      }),
    ]);

    await upsertRankingByResult({
      ownerUserId: player.table.ownerUserId,
      tableId: player.table.id,
      playerName: player.name,
      resultadoCents,
    });

    return { player: updatedPlayer };
  });

  app.patch('/:playerId/cashout/edit', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Editar cash out já realizado',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            player: playerResponseSchema,
          },
          required: ['player'],
        },
        400: messageErrorSchema,
        404: messageErrorSchema,
        409: messageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = playerPathSchema.safeParse(request.params);
    const parsedBody = cashoutBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    const player = await prisma.tablePlayer.findFirst({
      where: {
        id: parsedParams.data.playerId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      include: {
        table: {
          select: {
            id: true,
            ownerUserId: true,
            status: true,
            totalMesaCents: true,
          },
        },
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    if (player.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite editar cash out.' });
    }

    if (player.status !== PlayerStatus.CASHOUT || player.valorFinalCents === null || player.resultadoCents === null) {
      return reply.status(409).send({ message: 'Somente jogador com cash out pode ser editado.' });
    }

    const novoValorFinalCents = parsedBody.data.valorFinalCents;
    const novoResultadoCents = novoValorFinalCents - player.totalInvestidoCents;

    const diferencaValor = novoValorFinalCents - player.valorFinalCents;
    const diferencaResultado = novoResultadoCents - player.resultadoCents;

    const latestCashoutTx = await prisma.transaction.findFirst({
      where: {
        tableId: player.table.id,
        tablePlayerId: player.id,
        type: TxType.CASH_OUT,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    const [updatedPlayer] = await prisma.$transaction([
      prisma.tablePlayer.update({
        where: { id: player.id },
        data: {
          valorFinalCents: novoValorFinalCents,
          resultadoCents: novoResultadoCents,
        },
      }),
      prisma.table.update({
        where: { id: player.table.id },
        data: {
          totalMesaCents: Math.max(player.table.totalMesaCents - diferencaValor, 0),
          ajusteProporcionalAplicado: false,
        },
      }),
      latestCashoutTx
        ? prisma.transaction.update({
            where: { id: latestCashoutTx.id },
            data: {
              amountCents: novoValorFinalCents,
              note: 'cashout_edit',
            },
          })
        : prisma.transaction.create({
            data: {
              tableId: player.table.id,
              tablePlayerId: player.id,
              type: TxType.CASH_OUT,
              amountCents: novoValorFinalCents,
              note: 'cashout_edit',
            },
          }),
    ]);

    const ranking = await prisma.ranking.findUnique({
      where: {
        ownerUserId_playerName: {
          ownerUserId: player.table.ownerUserId,
          playerName: player.name,
        },
      },
    });

    if (ranking) {
      await prisma.ranking.update({
        where: { id: ranking.id },
        data: {
          totalLucroCents: ranking.totalLucroCents + diferencaResultado,
          tableId: player.table.id,
        },
      });
    }

    return { player: updatedPlayer };
  });

  app.patch('/:playerId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Renomear jogador',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const parsedParams = playerPathSchema.safeParse(request.params);
    const parsedBody = updatePlayerBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    const player = await prisma.tablePlayer.findFirst({
      where: {
        id: parsedParams.data.playerId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      select: { id: true },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    const updatedPlayer = await prisma.tablePlayer.update({
      where: { id: player.id },
      data: { name: parsedBody.data.name },
    });

    return { player: updatedPlayer };
  });

  app.delete('/:playerId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Remover jogador (não desfaz ranking)',
      security: [{ bearerAuth: [] }],
      response: {
        400: messageErrorSchema,
        404: messageErrorSchema,
        204: { type: 'null' },
      },
    },
  }, async (request, reply) => {
    const parsedParams = playerPathSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: parsedParams.error.flatten(),
      });
    }

    const player = await prisma.tablePlayer.findFirst({
      where: {
        id: parsedParams.data.playerId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      include: {
        table: {
          select: {
            id: true,
            totalMesaCents: true,
          },
        },
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    await prisma.$transaction(async (tx) => {
      if (player.status === PlayerStatus.ACTIVE) {
        await tx.table.update({
          where: { id: player.table.id },
          data: {
            totalMesaCents: Math.max(player.table.totalMesaCents - player.totalInvestidoCents, 0),
            ajusteProporcionalAplicado: false,
          },
        });
      }

      await tx.tablePlayer.delete({
        where: { id: player.id },
      });
    });

    return reply.status(204).send();
  });
};
