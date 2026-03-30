import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { PlayerStatus, TableStatus, TxType, type Prisma } from '@prisma/client';
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
    userId: { type: 'string', format: 'uuid' },
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
  accessPassword: z.string().min(4),
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

const pendingActionPathSchema = z.object({
  actionId: z.string().uuid(),
});

const respondPendingActionBodySchema = z.object({
  decision: z.enum(['APPROVE', 'DENY']),
}).strict();

const PENDING_PLAYER_ACTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
} as const;

type PendingPlayerActionTypeValue = 'REBUY' | 'CASH_OUT';

const toTableWhereMember = (tableId: string, userId: string) => ({
  id: tableId,
  OR: [
    { ownerUserId: userId },
    {
      players: {
        some: {
          userId,
        },
      },
    },
  ],
} as unknown as Prisma.TableWhereInput);

const toPlayerWhereOwnerOrSelf = (playerId: string, userId: string) => ({
  id: playerId,
  OR: [
    {
      table: {
        ownerUserId: userId,
      },
    },
    {
      userId,
    },
  ],
});

const isOwnerOrSelf = (player: { userId: string; table: { ownerUserId: string } }, userId: string) => {
  return player.userId === userId || player.table.ownerUserId === userId;
};

const toPendingActionTypeLabel = (type: PendingPlayerActionTypeValue) => {
  return type === 'REBUY' ? 'rebuy' : 'cash out';
};

const createOrReusePendingAction = async (params: {
  tableId: string;
  tablePlayerId: string;
  requesterUserId: string;
  approverUserId: string;
  type: PendingPlayerActionTypeValue;
  amountCents: number;
}) => {
  const existingPending = await (prisma as any).pendingPlayerAction.findFirst({
    where: {
      tablePlayerId: params.tablePlayerId,
      approverUserId: params.approverUserId,
      type: params.type,
      status: PENDING_PLAYER_ACTION_STATUS.PENDING,
    },
  });

  if (existingPending) {
    return existingPending;
  }

  return (prisma as any).pendingPlayerAction.create({
    data: {
      tableId: params.tableId,
      tablePlayerId: params.tablePlayerId,
      requesterUserId: params.requesterUserId,
      approverUserId: params.approverUserId,
      type: params.type,
      amountCents: params.amountCents,
      status: PENDING_PLAYER_ACTION_STATUS.PENDING,
    },
  });
};

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

const executeRebuy = async (params: {
  player: {
    id: string;
    totalInvestidoCents: number;
    table: {
      id: string;
      totalMesaCents: number;
    };
  };
  amountCents: number;
}) => {
  const [updatedPlayer] = await prisma.$transaction([
    prisma.tablePlayer.update({
      where: { id: params.player.id },
      data: {
        totalInvestidoCents: params.player.totalInvestidoCents + params.amountCents,
      },
    }),
    prisma.table.update({
      where: { id: params.player.table.id },
      data: {
        totalMesaCents: params.player.table.totalMesaCents + params.amountCents,
        ajusteProporcionalAplicado: false,
      },
    }),
    prisma.transaction.create({
      data: {
        tableId: params.player.table.id,
        tablePlayerId: params.player.id,
        type: TxType.REBUY,
        amountCents: params.amountCents,
      },
    }),
  ]);

  return updatedPlayer;
};

const executeCashout = async (params: {
  player: {
    id: string;
    name: string;
    totalInvestidoCents: number;
    table: {
      id: string;
      ownerUserId: string;
      totalMesaCents: number;
    };
  };
  valorFinalCents: number;
}) => {
  const resultadoCents = params.valorFinalCents - params.player.totalInvestidoCents;

  const [updatedPlayer] = await prisma.$transaction([
    prisma.tablePlayer.update({
      where: { id: params.player.id },
      data: {
        status: PlayerStatus.CASHOUT,
        valorFinalCents: params.valorFinalCents,
        resultadoCents,
        cashoutAt: new Date(),
      },
    }),
    prisma.table.update({
      where: { id: params.player.table.id },
      data: {
        totalMesaCents: Math.max(params.player.table.totalMesaCents - params.valorFinalCents, 0),
        ajusteProporcionalAplicado: false,
      },
    }),
    prisma.transaction.create({
      data: {
        tableId: params.player.table.id,
        tablePlayerId: params.player.id,
        type: TxType.CASH_OUT,
        amountCents: params.valorFinalCents,
      },
    }),
  ]);

  await upsertRankingByResult({
    ownerUserId: params.player.table.ownerUserId,
    tableId: params.player.table.id,
    playerName: params.player.name,
    resultadoCents,
  });

  return updatedPlayer;
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
      where: toTableWhereMember(parsedParams.data.tableId, request.user.id),
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
      summary: 'Entrar na mesa com buy-in mínimo',
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
        401: messageErrorSchema,
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
      },
      select: {
        id: true,
        status: true,
        accessPasswordHash: true,
        buyInMinimoCents: true,
        totalMesaCents: true,
      },
    } as any) as any;

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    if (table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite entrada de jogador.' });
    }

    const passwordMatches = await bcrypt.compare(parsedBody.data.accessPassword, table.accessPasswordHash);

    if (!passwordMatches) {
      return reply.status(401).send({ message: 'Senha da mesa inválida.' });
    }

    const userAlreadyJoined = await prisma.tablePlayer.findFirst({
      where: {
        tableId: table.id,
        userId: request.user.id,
      },
      select: { id: true },
    } as any);

    if (userAlreadyJoined) {
      return reply.status(409).send({ message: 'Este usuário já entrou na mesa.' });
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
          userId: request.user.id,
          name: request.user.email,
          status: PlayerStatus.ACTIVE,
          buyInInicialCents: buyInCents,
          totalInvestidoCents: buyInCents,
        },
      } as any),
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
          additionalProperties: true,
        },
        202: {
          type: 'object',
          additionalProperties: true,
        },
        400: messageErrorSchema,
        403: messageErrorSchema,
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

    const player = await prisma.tablePlayer.findUnique({
      where: { id: parsedParams.data.playerId },
      include: {
        table: {
          select: {
            id: true,
            ownerUserId: true,
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

    if (!isOwnerOrSelf(player, request.user.id)) {
      return reply.status(403).send({ message: 'Apenas o dono da mesa pode autorizar rebuy de outro jogador.' });
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

    const requesterCanOperate = await prisma.table.findFirst({
      where: toTableWhereMember(player.table.id, request.user.id),
      select: { id: true },
    });

    if (!requesterCanOperate) {
      return reply.status(403).send({ message: 'Você não tem permissão para solicitar ação nesta mesa.' });
    }

    const amountCents = parsedBody.data.amountCents;
    const actorIsOwner = request.user.id === player.table.ownerUserId;
    const actorIsTarget = request.user.id === player.userId;

    if (!actorIsOwner && !actorIsTarget) {
      return reply.status(403).send({ message: 'Usuário não dono não pode solicitar rebuy para outros jogadores.' });
    }

    if (!actorIsOwner && actorIsTarget) {
      const pendingAction = await createOrReusePendingAction({
        tableId: player.table.id,
        tablePlayerId: player.id,
        requesterUserId: request.user.id,
        approverUserId: player.table.ownerUserId,
        type: 'REBUY',
        amountCents,
      });

      return reply.status(202).send({
        requiresApproval: true,
        message: 'Solicitação de rebuy enviada para aprovação do dono da mesa.',
        pendingAction,
      });
    }

    if (actorIsOwner && !actorIsTarget) {
      const pendingAction = await createOrReusePendingAction({
        tableId: player.table.id,
        tablePlayerId: player.id,
        requesterUserId: request.user.id,
        approverUserId: player.userId,
        type: 'REBUY',
        amountCents,
      });

      return reply.status(202).send({
        requiresApproval: true,
        message: 'Solicitação de rebuy enviada para aprovação.',
        pendingAction,
      });
    }

    const updatedPlayer = await executeRebuy({
      player,
      amountCents,
    });

    return {
      requiresApproval: false,
      player: updatedPlayer,
    };
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
          additionalProperties: true,
        },
        202: {
          type: 'object',
          additionalProperties: true,
        },
        400: messageErrorSchema,
        403: messageErrorSchema,
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

    const player = await prisma.tablePlayer.findUnique({
      where: { id: parsedParams.data.playerId },
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

    if (!isOwnerOrSelf(player, request.user.id)) {
      return reply.status(403).send({ message: 'Usuário não dono só pode solicitar rebuy para si mesmo.' });
    }

    if (player.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite cash out.' });
    }

    if (player.status !== PlayerStatus.ACTIVE) {
      return reply.status(409).send({ message: 'Jogador já realizou cash out.' });
    }

    const requesterCanOperate = await prisma.table.findFirst({
      where: toTableWhereMember(player.table.id, request.user.id),
      select: { id: true },
    });

    if (!requesterCanOperate) {
      return reply.status(403).send({ message: 'Você não tem permissão para solicitar ação nesta mesa.' });
    }

    const valorFinalCents = parsedBody.data.valorFinalCents;
    const actorIsOwner = request.user.id === player.table.ownerUserId;
    const actorIsTarget = request.user.id === player.userId;

    if (!actorIsOwner && !actorIsTarget) {
      return reply.status(403).send({ message: 'Usuário não dono não pode solicitar cash out para outros jogadores.' });
    }

    if (!actorIsOwner && actorIsTarget) {
      const pendingAction = await createOrReusePendingAction({
        tableId: player.table.id,
        tablePlayerId: player.id,
        requesterUserId: request.user.id,
        approverUserId: player.table.ownerUserId,
        type: 'CASH_OUT',
        amountCents: valorFinalCents,
      });

      return reply.status(202).send({
        requiresApproval: true,
        message: 'Solicitação de cash out enviada para aprovação do dono da mesa.',
        pendingAction,
      });
    }

    if (actorIsOwner && !actorIsTarget) {
      const pendingAction = await createOrReusePendingAction({
        tableId: player.table.id,
        tablePlayerId: player.id,
        requesterUserId: request.user.id,
        approverUserId: player.userId,
        type: 'CASH_OUT',
        amountCents: valorFinalCents,
      });

      return reply.status(202).send({
        requiresApproval: true,
        message: 'Solicitação de cash out enviada para aprovação.',
        pendingAction,
      });
    }

    const updatedPlayer = await executeCashout({
      player,
      valorFinalCents,
    });

    return {
      requiresApproval: false,
      player: updatedPlayer,
    };
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
      where: toPlayerWhereOwnerOrSelf(parsedParams.data.playerId, request.user.id),
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

  app.get('/table/:tableId/pending-actions', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Listar solicitações pendentes de aprovação do usuário',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
        400: messageErrorSchema,
        403: messageErrorSchema,
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

    const canAccessTable = await prisma.table.findFirst({
      where: toTableWhereMember(parsedParams.data.tableId, request.user.id),
      select: { id: true },
    });

    if (!canAccessTable) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const actions = await (prisma as any).pendingPlayerAction.findMany({
      where: {
        tableId: parsedParams.data.tableId,
        approverUserId: request.user.id,
        status: PENDING_PLAYER_ACTION_STATUS.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
          },
        },
        tablePlayer: {
          select: {
            id: true,
            name: true,
            userId: true,
            status: true,
          },
        },
      },
    });

    return {
      actions,
    };
  });

  app.patch('/actions/:actionId/respond', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Aprovar ou negar solicitação pendente',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
        400: messageErrorSchema,
        403: messageErrorSchema,
        404: messageErrorSchema,
        409: messageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = pendingActionPathSchema.safeParse(request.params);
    const parsedBody = respondPendingActionBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    const action = await (prisma as any).pendingPlayerAction.findUnique({
      where: { id: parsedParams.data.actionId },
      include: {
        tablePlayer: {
          include: {
            table: {
              select: {
                id: true,
                ownerUserId: true,
                status: true,
                permitirRebuy: true,
                totalMesaCents: true,
              },
            },
          },
        },
      },
    });

    if (!action) {
      return reply.status(404).send({ message: 'Solicitação não encontrada.' });
    }

    if (action.approverUserId !== request.user.id) {
      return reply.status(403).send({ message: 'Você não pode decidir esta solicitação.' });
    }

    if (action.status !== PENDING_PLAYER_ACTION_STATUS.PENDING) {
      return reply.status(409).send({ message: 'Solicitação já foi processada.' });
    }

    if (parsedBody.data.decision === 'DENY') {
      const denied = await (prisma as any).pendingPlayerAction.update({
        where: { id: action.id },
        data: {
          status: PENDING_PLAYER_ACTION_STATUS.DENIED,
          decidedAt: new Date(),
          decidedByUserId: request.user.id,
        },
      });

      return {
        action: denied,
        message: 'Solicitação negada.',
      };
    }

    const player = action.tablePlayer;

    if (player.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite processar esta solicitação.' });
    }

    if (action.type === 'REBUY') {
      if (!player.table.permitirRebuy) {
        return reply.status(409).send({ message: 'Rebuy desabilitado nas configurações da mesa.' });
      }

      if (player.status !== PlayerStatus.ACTIVE) {
        return reply.status(409).send({ message: 'Apenas jogador ativo pode fazer rebuy.' });
      }

      const updatedPlayer = await executeRebuy({
        player,
        amountCents: action.amountCents,
      });

      const approved = await (prisma as any).pendingPlayerAction.update({
        where: { id: action.id },
        data: {
          status: PENDING_PLAYER_ACTION_STATUS.APPROVED,
          decidedAt: new Date(),
          decidedByUserId: request.user.id,
        },
      });

      return {
        action: approved,
        player: updatedPlayer,
        message: `Solicitação de ${toPendingActionTypeLabel(action.type)} aprovada.`,
      };
    }

    if (player.status !== PlayerStatus.ACTIVE) {
      return reply.status(409).send({ message: 'Jogador já realizou cash out.' });
    }

    const updatedPlayer = await executeCashout({
      player,
      valorFinalCents: action.amountCents,
    });

    const approved = await (prisma as any).pendingPlayerAction.update({
      where: { id: action.id },
      data: {
        status: PENDING_PLAYER_ACTION_STATUS.APPROVED,
        decidedAt: new Date(),
        decidedByUserId: request.user.id,
      },
    });

    return {
      action: approved,
      player: updatedPlayer,
      message: `Solicitação de ${toPendingActionTypeLabel(action.type)} aprovada.`,
    };
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

    return reply.status(409).send({
      message: 'Renomear jogador foi desabilitado. O nome do jogador é o e-mail da conta.',
    });
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
      where: toPlayerWhereOwnerOrSelf(parsedParams.data.playerId, request.user.id),
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
