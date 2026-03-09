import type { FastifyInstance } from 'fastify';
import { TableStatus, TxType } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../../db/prisma';
import { requireAuth } from '../../shared/middlewares/auth';

const tablePathSchema = z.object({
  tableId: z.string().uuid(),
});

const createTableBodySchema = z.object({
  name: z.string().trim().min(1),
  blinds: z.string().trim().min(1),
  currency: z.string().trim().min(1),
}).strict();

const updateTableBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  blinds: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional(),
}).strict();

const amountByType: Record<TxType, (amount: number) => number> = {
  BUY_IN: (amount) => amount,
  REBUY: (amount) => amount,
  ADJUSTMENT: (amount) => amount,
  CASH_OUT: (amount) => -amount,
};

const tableResponseSchema = {
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
  },
  required: ['id', 'ownerUserId', 'name', 'blinds', 'currency', 'status', 'createdAt'],
} as const;

const simpleMessageErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  required: ['message'],
} as const;

export const tablesRoutes = async (app: FastifyInstance) => {
  app.get('/', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Listar mesas do usuário',
      description: 'Retorna todas as mesas pertencentes ao usuário autenticado, ordenadas da mais recente para a mais antiga.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            tables: {
              type: 'array',
              items: tableResponseSchema,
            },
          },
          required: ['tables'],
        },
        401: simpleMessageErrorSchema,
      },
    },
  }, async (request) => {
    const tables = await prisma.table.findMany({
      where: {
        ownerUserId: request.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { tables };
  });

  app.post('/', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Criar mesa',
      description: 'Cria uma nova mesa de cash game para o usuário autenticado.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          blinds: { type: 'string', minLength: 1 },
          currency: { type: 'string', minLength: 1 },
        },
        required: ['name', 'blinds', 'currency'],
        additionalProperties: false,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            table: tableResponseSchema,
          },
          required: ['table'],
        },
        400: simpleMessageErrorSchema,
        401: simpleMessageErrorSchema,
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

    const { name, blinds, currency } = parsedBody.data;

    const table = await prisma.table.create({
      data: {
        ownerUserId: request.user.id,
        name,
        blinds,
        currency,
      },
    });

    return reply.status(201).send({ table });
  });

  app.get('/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Detalhar mesa',
      description: 'Retorna dados da mesa, jogadores, transações e um resumo financeiro por jogador.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          tableId: { type: 'string', format: 'uuid' },
        },
        required: ['tableId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            table: {
              allOf: [
                tableResponseSchema,
                {
                  type: 'object',
                  properties: {
                    players: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          tableId: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          status: { type: 'string', enum: ['ACTIVE', 'LEFT'] },
                          createdAt: { type: 'string', format: 'date-time' },
                        },
                        required: ['id', 'tableId', 'name', 'status', 'createdAt'],
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
                          tablePlayer: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', format: 'uuid' },
                              name: { type: 'string' },
                              status: { type: 'string', enum: ['ACTIVE', 'LEFT'] },
                            },
                            required: ['id', 'name', 'status'],
                          },
                        },
                        required: ['id', 'tableId', 'tablePlayerId', 'type', 'amountCents', 'createdAt', 'tablePlayer'],
                      },
                    },
                  },
                  required: ['players', 'transactions'],
                },
              ],
            },
            summary: {
              type: 'object',
              properties: {
                totalPlayers: { type: 'integer' },
                activePlayers: { type: 'integer' },
                totalTransactions: { type: 'integer' },
                players: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      playerId: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      status: { type: 'string', enum: ['ACTIVE', 'LEFT'] },
                      netCents: { type: 'integer' },
                      buyInCents: { type: 'integer' },
                      cashOutCents: { type: 'integer' },
                    },
                    required: ['playerId', 'name', 'status', 'netCents', 'buyInCents', 'cashOutCents'],
                  },
                },
              },
              required: ['totalPlayers', 'activePlayers', 'totalTransactions', 'players'],
            },
          },
          required: ['table', 'summary'],
        },
        400: simpleMessageErrorSchema,
        401: simpleMessageErrorSchema,
        404: simpleMessageErrorSchema,
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

    const { tableId } = parsedParams.data;

    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        ownerUserId: request.user.id,
      },
      include: {
        players: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        transactions: {
          orderBy: {
            createdAt: 'asc',
          },
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
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const playersSummary = new Map<string, { netCents: number; buyInCents: number; cashOutCents: number }>();

    for (const player of table.players) {
      playersSummary.set(player.id, { netCents: 0, buyInCents: 0, cashOutCents: 0 });
    }

    for (const transaction of table.transactions) {
      const current = playersSummary.get(transaction.tablePlayerId) ?? {
        netCents: 0,
        buyInCents: 0,
        cashOutCents: 0,
      };

      current.netCents += amountByType[transaction.type](transaction.amountCents);

      if (transaction.type === TxType.CASH_OUT) {
        current.cashOutCents += transaction.amountCents;
      } else {
        current.buyInCents += transaction.amountCents;
      }

      playersSummary.set(transaction.tablePlayerId, current);
    }

    const summary = {
      totalPlayers: table.players.length,
      activePlayers: table.players.filter((player) => player.status === 'ACTIVE').length,
      totalTransactions: table.transactions.length,
      players: table.players.map((player) => ({
        playerId: player.id,
        name: player.name,
        status: player.status,
        ...playersSummary.get(player.id),
      })),
    };

    return { table, summary };
  });

  app.patch('/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Atualizar mesa',
      description: 'Atualiza nome, blinds e/ou moeda de uma mesa.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          tableId: { type: 'string', format: 'uuid' },
        },
        required: ['tableId'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          blinds: { type: 'string', minLength: 1 },
          currency: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            table: tableResponseSchema,
          },
          required: ['table'],
        },
        400: simpleMessageErrorSchema,
        401: simpleMessageErrorSchema,
        404: simpleMessageErrorSchema,
      },
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
      return reply.status(400).send({
        message: 'Informe ao menos um campo para atualização.',
      });
    }

    const table = await prisma.table.findFirst({
      where: {
        id: parsedParams.data.tableId,
        ownerUserId: request.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const updatedTable = await prisma.table.update({
      where: { id: table.id },
      data: parsedBody.data,
    });

    return { table: updatedTable };
  });

  app.patch('/:tableId/close', {
    preHandler: requireAuth,
    schema: {
      tags: ['Tables'],
      summary: 'Encerrar mesa',
      description: 'Altera o status da mesa para CLOSED e define data/hora de encerramento.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          tableId: { type: 'string', format: 'uuid' },
        },
        required: ['tableId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            table: tableResponseSchema,
          },
          required: ['table'],
        },
        400: simpleMessageErrorSchema,
        401: simpleMessageErrorSchema,
        404: simpleMessageErrorSchema,
        409: simpleMessageErrorSchema,
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
      select: {
        id: true,
        status: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    if (table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Mesa já está encerrada.' });
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
      description: 'Altera o status da mesa para OPEN e remove data de encerramento.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          tableId: { type: 'string', format: 'uuid' },
        },
        required: ['tableId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            table: tableResponseSchema,
          },
          required: ['table'],
        },
        400: simpleMessageErrorSchema,
        401: simpleMessageErrorSchema,
        404: simpleMessageErrorSchema,
        409: simpleMessageErrorSchema,
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
      select: {
        id: true,
        status: true,
      },
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
