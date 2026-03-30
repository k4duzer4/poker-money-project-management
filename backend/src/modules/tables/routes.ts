import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { TableStatus, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { prisma } from '../../db/prisma';
import { requireAuth } from '../../shared/middlewares/auth';
import { calculateTransfers, distributeDifferenceAmongWinners } from './settlement';

const tablePathSchema = z.object({
  tableId: z.string().uuid(),
});

const createTableBodySchema = z.object({
  blinds: z.string().trim().min(1),
  currency: z.string().trim().min(1),
  accessPassword: z.string().min(4),
  valorFichaCents: z.number().int().positive(),
  buyInMinimoCents: z.number().int().positive(),
  buyInMaximoCents: z.number().int().positive().optional(),
  permitirRebuy: z.boolean(),
  limiteRebuys: z.number().int().min(0),
}).strict().superRefine((value, context) => {
  if (value.buyInMaximoCents && value.buyInMaximoCents < value.buyInMinimoCents) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'buyInMaximoCents não pode ser menor que buyInMinimoCents.',
      path: ['buyInMaximoCents'],
    });
  }
});

const updateTableBodySchema = z.object({
  blinds: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional(),
  accessPassword: z.string().min(4).optional(),
  valorFichaCents: z.number().int().positive().optional(),
  buyInMinimoCents: z.number().int().positive().optional(),
  buyInMaximoCents: z.number().int().positive().nullable().optional(),
  permitirRebuy: z.boolean().optional(),
  limiteRebuys: z.number().int().min(0).optional(),
}).strict();

const simpleMessageErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  required: ['message'],
} as const;

const discoverTableQuerySchema = z.object({
  q: z.string().trim().min(1),
});

const inviteTokenPathSchema = z.object({
  inviteToken: z.string().trim().min(8),
});

const tableDetailTableSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    ownerUserId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    code: { type: 'string' },
    inviteToken: { type: 'string' },
    blinds: { type: 'string' },
    currency: { type: 'string' },
    status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
    createdAt: { type: 'string', format: 'date-time' },
    closedAt: { type: ['string', 'null'], format: 'date-time' },
    valorFichaCents: { type: 'integer' },
    buyInMinimoCents: { type: 'integer' },
    buyInMaximoCents: { type: ['integer', 'null'] },
    permitirRebuy: { type: 'boolean' },
    limiteRebuys: { type: 'integer' },
    totalMesaCents: { type: 'integer' },
    ajusteProporcionalAplicado: { type: 'boolean' },
    players: {
      type: 'array',
      items: {
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
        required: ['id', 'tableId', 'name', 'status', 'createdAt', 'buyInInicialCents', 'totalInvestidoCents'],
      },
    },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tableId: { type: 'string', format: 'uuid' },
          tablePlayerId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['BUY_IN', 'REBUY', 'CASH_OUT', 'ADJUSTMENT'] },
          amountCents: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          note: { type: ['string', 'null'] },
        },
        required: ['id', 'tableId', 'tablePlayerId', 'type', 'amountCents', 'createdAt'],
      },
    },
  },
  required: [
    'id',
    'ownerUserId',
    'name',
    'code',
    'inviteToken',
    'blinds',
    'currency',
    'status',
    'createdAt',
    'valorFichaCents',
    'buyInMinimoCents',
    'permitirRebuy',
    'limiteRebuys',
    'totalMesaCents',
    'ajusteProporcionalAplicado',
    'players',
    'transactions',
  ],
} as const;

const tableSummarySchema = {
  type: 'object',
  properties: {
    totalPlayers: { type: 'integer' },
    activePlayers: { type: 'integer' },
    totalTransactions: { type: 'integer' },
    totalInvestidoCents: { type: 'integer' },
    totalFinalCents: { type: 'integer' },
    totalMesaCents: { type: 'integer' },
    players: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          playerId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'CASHOUT'] },
          buyInInicialCents: { type: 'integer' },
          totalInvestidoCents: { type: 'integer' },
          valorFinalCents: { type: ['integer', 'null'] },
          resultadoCents: { type: ['integer', 'null'] },
          rebuysCount: { type: 'integer' },
        },
        required: ['playerId', 'name', 'status', 'buyInInicialCents', 'totalInvestidoCents', 'rebuysCount'],
      },
    },
  },
  required: [
    'totalPlayers',
    'activePlayers',
    'totalTransactions',
    'totalInvestidoCents',
    'totalFinalCents',
    'totalMesaCents',
    'players',
  ],
} as const;

const toTableWhereOwner = (tableId: string, userId: string) => ({
  id: tableId,
  ownerUserId: userId,
});

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

const createTableCode = () => `MESA-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;

const createInviteToken = () => randomUUID().replace(/-/g, '');

const generateUniqueTableIdentifiers = async () => {
  let code = createTableCode();
  let inviteToken = createInviteToken();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await prisma.table.findFirst({
      where: {
        OR: [
          { code },
          { inviteToken },
        ],
      },
      select: { id: true },
    } as any);

    if (!existing) {
      return { code, inviteToken };
    }

    code = createTableCode();
    inviteToken = createInviteToken();
  }

  throw new Error('Não foi possível gerar identificadores únicos para mesa.');
};

export const tablesRoutes = async (app: FastifyInstance) => {
  app.get('/', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Listar mesas do usuário',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            tables: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  ownerUserId: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  blinds: { type: 'string' },
                  currency: { type: 'string' },
                  status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
                  createdAt: { type: 'string', format: 'date-time' },
                  closedAt: { type: ['string', 'null'], format: 'date-time' },
                  valorFichaCents: { type: 'integer' },
                  buyInMinimoCents: { type: 'integer' },
                  buyInMaximoCents: { type: ['integer', 'null'] },
                  permitirRebuy: { type: 'boolean' },
                  limiteRebuys: { type: 'integer' },
                  totalMesaCents: { type: 'integer' },
                  ajusteProporcionalAplicado: { type: 'boolean' },
                },
                required: [
                  'id',
                  'ownerUserId',
                  'name',
                  'blinds',
                  'currency',
                  'status',
                  'createdAt',
                  'valorFichaCents',
                  'buyInMinimoCents',
                  'permitirRebuy',
                  'limiteRebuys',
                  'totalMesaCents',
                  'ajusteProporcionalAplicado',
                ],
              },
            },
          },
          required: ['tables'],
        },
      },
    },
  }, async (request) => {
    const tables = await prisma.table.findMany({
      where: {
        OR: [
          { ownerUserId: request.user.id },
          {
            players: {
              some: {
                userId: request.user.id,
              },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    } as any);

    return { tables };
  });

  app.get('/discover', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Pesquisar mesas por código ou nome',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const parsedQuery = discoverTableQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        message: 'Query inválida.',
        errors: parsedQuery.error.flatten(),
      });
    }

    const query = parsedQuery.data.q;

    const tables = await prisma.table.findMany({
      where: {
        status: TableStatus.OPEN,
        OR: [
          {
            code: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        players: {
          where: {
            userId: request.user.id,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    } as any);

    return {
      tables: tables.map((table: any) => ({
        ...table,
        alreadyJoined: table.players.length > 0,
        alreadyOwner: table.ownerUserId === request.user.id,
      })),
    };
  });

  app.get('/invite/:inviteToken', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Buscar mesa por link de convite',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const parsedParams = inviteTokenPathSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: parsedParams.error.flatten(),
      });
    }

    const table = await prisma.table.findUnique({
      where: { inviteToken: parsedParams.data.inviteToken },
      include: {
        players: {
          where: {
            userId: request.user.id,
          },
          select: {
            id: true,
          },
        },
      },
    } as any) as any;

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    return {
      table: {
        ...table,
        alreadyJoined: table.players.length > 0,
        alreadyOwner: table.ownerUserId === request.user.id,
      },
    };
  });

  app.post('/', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Criar mesa com regras de negócio Chipz',
      security: [{ bearerAuth: [] }],
      response: {
        201: {
          type: 'object',
          properties: {
            table: { type: 'object', additionalProperties: true },
          },
          required: ['table'],
        },
        400: simpleMessageErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedBody = createTableBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: parsedBody.error.flatten(),
      });
    }

    const identifiers = await generateUniqueTableIdentifiers();
    const accessPasswordHash = await bcrypt.hash(parsedBody.data.accessPassword, 10);

    const table = await prisma.table.create({
      data: {
        ownerUserId: request.user.id,
        name: `Mesa ${identifiers.code}`,
        code: identifiers.code,
        inviteToken: identifiers.inviteToken,
        accessPasswordHash,
        blinds: parsedBody.data.blinds,
        currency: parsedBody.data.currency,
        status: TableStatus.OPEN,
        closedAt: null,
        valorFichaCents: parsedBody.data.valorFichaCents,
        buyInMinimoCents: parsedBody.data.buyInMinimoCents,
        buyInMaximoCents: parsedBody.data.buyInMaximoCents,
        permitirRebuy: parsedBody.data.permitirRebuy,
        limiteRebuys: parsedBody.data.limiteRebuys,
        totalMesaCents: 0,
        ajusteProporcionalAplicado: false,
      },
    } as any);

    return reply.status(201).send({ table });
  });

  app.get('/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Detalhar mesa com cálculos Chipz',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            table: tableDetailTableSchema,
            summary: tableSummarySchema,
            transfers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  amountCents: { type: 'integer' },
                },
                required: ['from', 'to', 'amountCents'],
              },
            },
            closure: {
              type: 'object',
              properties: {
                canClose: { type: 'boolean' },
                hasActivePlayers: { type: 'boolean' },
                differenceCents: { type: 'integer' },
                needsProportionalAdjustment: { type: 'boolean' },
              },
              required: ['canClose', 'hasActivePlayers', 'differenceCents', 'needsProportionalAdjustment'],
            },
          },
          required: ['table', 'summary', 'transfers', 'closure'],
        },
        404: simpleMessageErrorSchema,
        400: simpleMessageErrorSchema,
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
      include: {
        players: {
          orderBy: { createdAt: 'asc' },
        },
        transactions: {
          orderBy: { createdAt: 'asc' },
          include: {
            tablePlayer: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    } as any) as any;

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const totalInvestidoGeral = table.players.reduce((acc: number, player: any) => acc + player.totalInvestidoCents, 0);
    const totalFinalGeral = table.players.reduce((acc: number, player: any) => acc + (player.valorFinalCents ?? 0), 0);
    const differenceCents = totalInvestidoGeral - totalFinalGeral;
    const hasActivePlayers = table.players.some((player: any) => player.status === 'ACTIVE');

    const transfers = calculateTransfers(
      table.players
        .filter((player: any) => player.resultadoCents !== null)
        .map((player: any) => ({
          name: player.name,
          resultadoCents: player.resultadoCents ?? 0,
        })),
    );

    const summary = {
      totalPlayers: table.players.length,
      activePlayers: table.players.filter((player: any) => player.status === 'ACTIVE').length,
      totalTransactions: table.transactions.length,
      totalInvestidoCents: totalInvestidoGeral,
      totalFinalCents: totalFinalGeral,
      totalMesaCents: table.totalMesaCents,
      players: table.players.map((player: any) => ({
        playerId: player.id,
        name: player.name,
        status: player.status,
        buyInInicialCents: player.buyInInicialCents,
        totalInvestidoCents: player.totalInvestidoCents,
        valorFinalCents: player.valorFinalCents,
        resultadoCents: player.resultadoCents,
        rebuysCount: table.transactions.filter((tx: any) => tx.tablePlayerId === player.id && tx.type === 'REBUY').length,
      })),
    };

    return {
      table,
      summary,
      transfers,
      closure: {
        canClose: !hasActivePlayers,
        hasActivePlayers,
        differenceCents,
        needsProportionalAdjustment: false,
      },
    };
  });

  app.patch('/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Atualizar configurações da mesa',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const parsedParams = tablePathSchema.safeParse(request.params);
    const parsedBody = updateTableBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: {
          params: parsedParams.success ? null : parsedParams.error.flatten(),
          body: parsedBody.success ? null : parsedBody.error.flatten(),
        },
      });
    }

    if (Object.keys(parsedBody.data).length === 0) {
      return reply.status(400).send({ message: 'Informe ao menos um campo para atualização.' });
    }

    const table = await prisma.table.findFirst({
      where: toTableWhereOwner(parsedParams.data.tableId, request.user.id),
      select: { id: true },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const updateData: {
      blinds?: string;
      currency?: string;
      valorFichaCents?: number;
      buyInMinimoCents?: number;
      buyInMaximoCents?: number | null;
      permitirRebuy?: boolean;
      limiteRebuys?: number;
      accessPasswordHash?: string;
    } = {
      blinds: parsedBody.data.blinds,
      currency: parsedBody.data.currency,
      valorFichaCents: parsedBody.data.valorFichaCents,
      buyInMinimoCents: parsedBody.data.buyInMinimoCents,
      buyInMaximoCents: parsedBody.data.buyInMaximoCents,
      permitirRebuy: parsedBody.data.permitirRebuy,
      limiteRebuys: parsedBody.data.limiteRebuys,
    };

    if (parsedBody.data.accessPassword) {
      updateData.accessPasswordHash = await bcrypt.hash(parsedBody.data.accessPassword, 10);
    }

    const updatedTable = await prisma.table.update({
      where: { id: table.id },
      data: updateData,
    });

    return { table: updatedTable };
  });

  app.patch('/:tableId/apply-proportional-adjustment', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Aplicar ajuste proporcional entre ganhadores',
      security: [{ bearerAuth: [] }],
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
      where: toTableWhereOwner(parsedParams.data.tableId, request.user.id),
      include: {
        players: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    if (table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa encerrada não permite ajuste proporcional.' });
    }

    const totalInvestido = table.players.reduce((acc, player) => acc + player.totalInvestidoCents, 0);
    const totalFinal = table.players.reduce((acc, player) => acc + (player.valorFinalCents ?? 0), 0);
    const difference = totalInvestido - totalFinal;

    if (difference === 0) {
      const updated = await prisma.table.update({
        where: { id: table.id },
        data: { ajusteProporcionalAplicado: true },
      });

      return { table: updated, appliedAdjustments: [] };
    }

    if (difference < 0) {
      return reply.status(409).send({
        message: 'Diferença negativa não pode ser ajustada proporcionalmente pelo algoritmo atual.',
      });
    }

    const adjustments = distributeDifferenceAmongWinners(
      table.players
        .filter((player) => player.valorFinalCents !== null && player.resultadoCents !== null)
        .map((player) => ({
          id: player.id,
          valorFinalCents: player.valorFinalCents ?? 0,
          resultadoCents: player.resultadoCents ?? 0,
        })),
      difference,
    );

    if (adjustments.length === 0) {
      return reply.status(409).send({
        message: 'Não há ganhadores para absorver o ajuste proporcional.',
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const adjustment of adjustments) {
        await tx.tablePlayer.update({
          where: { id: adjustment.id },
          data: {
            valorFinalCents: adjustment.novoValorFinalCents,
            resultadoCents: adjustment.novoResultadoCents,
          },
        });
      }

      await tx.table.update({
        where: { id: table.id },
        data: {
          ajusteProporcionalAplicado: true,
          totalMesaCents: 0,
        },
      });
    });

    const refreshedTable = await prisma.table.findUnique({
      where: { id: table.id },
    });

    return {
      table: refreshedTable,
      appliedAdjustments: adjustments,
    };
  });

  app.patch('/:tableId/close', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Encerrar mesa com validações de negócio',
      security: [{ bearerAuth: [] }],
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
      where: toTableWhereOwner(parsedParams.data.tableId, request.user.id),
      include: {
        players: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    if (table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa já está encerrada.' });
    }

    const hasActivePlayers = table.players.some((player) => player.status === 'ACTIVE');
    if (hasActivePlayers) {
      return reply.status(409).send({
        message: 'Ainda há jogadores ativos na mesa. Todos precisam fazer cash out para fechar.',
      });
    }

    const closedTable = await prisma.table.update({
      where: { id: table.id },
      data: {
        status: TableStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return { table: closedTable };
  });

  app.patch('/:tableId/reopen', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Reabrir mesa',
      security: [{ bearerAuth: [] }],
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
      where: toTableWhereOwner(parsedParams.data.tableId, request.user.id),
      select: { id: true, status: true },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    if (table.status === TableStatus.OPEN) {
      return reply.status(409).send({ message: 'Mesa já está aberta.' });
    }

    const reopenedTable = await prisma.table.update({
      where: { id: table.id },
      data: {
        status: TableStatus.OPEN,
        closedAt: null,
      },
    });

    return { table: reopenedTable };
  });
};
