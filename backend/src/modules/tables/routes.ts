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

export const tablesRoutes = async (app: FastifyInstance) => {
  app.get('/', { preHandler: requireAuth }, async (request) => {
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

  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
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

  app.get('/:tableId', { preHandler: requireAuth }, async (request, reply) => {
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

  app.patch('/:tableId', { preHandler: requireAuth }, async (request, reply) => {
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

  app.patch('/:tableId/close', { preHandler: requireAuth }, async (request, reply) => {
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

  app.patch('/:tableId/reopen', { preHandler: requireAuth }, async (request, reply) => {
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
