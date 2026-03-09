import type { FastifyInstance } from 'fastify';
import { TableStatus, TxType } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../../db/prisma';
import { requireAuth } from '../../shared/middlewares/auth';

const transactionResponseSchema = {
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
} as const;

const txErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  required: ['message'],
} as const;

export const transactionsRoutes = async (app: FastifyInstance) => {
  const tablePathSchema = z.object({
    tableId: z.string().uuid(),
  });

  const transactionPathSchema = z.object({
    transactionId: z.string().uuid(),
  });

  const createTransactionBodySchema = z.object({
    tableId: z.string().uuid(),
    tablePlayerId: z.string().uuid(),
    type: z.nativeEnum(TxType),
    amountCents: z.number().int().positive(),
    note: z.string().trim().max(500).optional(),
  }).strict();

  const updateTransactionBodySchema = z.object({
    type: z.nativeEnum(TxType).optional(),
    amountCents: z.number().int().positive().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }).strict();

  app.get('/table/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Transactions'],
      summary: 'Listar transações da mesa',
      description: 'Retorna os lançamentos financeiros de uma mesa do usuário autenticado.',
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
            transactions: {
              type: 'array',
              items: transactionResponseSchema,
            },
          },
          required: ['transactions'],
        },
        400: txErrorSchema,
        401: txErrorSchema,
        404: txErrorSchema,
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
      select: {
        id: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        tableId: table.id,
      },
      orderBy: {
        createdAt: 'desc',
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
    });

    return { transactions };
  });

  app.post('/', {
    preHandler: requireAuth,
    schema: {
      tags: ['Transactions'],
      summary: 'Criar transação',
      description: 'Cria uma transação para um jogador em uma mesa aberta.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          tableId: { type: 'string', format: 'uuid' },
          tablePlayerId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['BUY_IN', 'REBUY', 'CASH_OUT', 'ADJUSTMENT'] },
          amountCents: { type: 'integer', minimum: 1 },
          note: { type: 'string', maxLength: 500 },
        },
        required: ['tableId', 'tablePlayerId', 'type', 'amountCents'],
        additionalProperties: false,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            transaction: transactionResponseSchema,
          },
          required: ['transaction'],
        },
        400: txErrorSchema,
        401: txErrorSchema,
        404: txErrorSchema,
        409: txErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedBody = createTransactionBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        errors: parsedBody.error.flatten(),
      });
    }

    const { tableId, tablePlayerId, type, amountCents, note } = parsedBody.data;

    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
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
      return reply.status(409).send({ message: 'Não é possível lançar transações em mesa encerrada.' });
    }

    const player = await prisma.tablePlayer.findFirst({
      where: {
        id: tablePlayerId,
        tableId: table.id,
      },
      select: {
        id: true,
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado para esta mesa.' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        tableId: table.id,
        tablePlayerId: player.id,
        type,
        amountCents,
        note: note ?? null,
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
    });

    return reply.status(201).send({ transaction });
  });

  app.patch('/:transactionId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Transactions'],
      summary: 'Atualizar transação',
      description: 'Atualiza tipo, valor e/ou observação de uma transação em mesa aberta.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', format: 'uuid' },
        },
        required: ['transactionId'],
      },
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['BUY_IN', 'REBUY', 'CASH_OUT', 'ADJUSTMENT'] },
          amountCents: { type: 'integer', minimum: 1 },
          note: { type: ['string', 'null'], maxLength: 500 },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            transaction: transactionResponseSchema,
          },
          required: ['transaction'],
        },
        400: txErrorSchema,
        401: txErrorSchema,
        404: txErrorSchema,
        409: txErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = transactionPathSchema.safeParse(request.params);
    const parsedBody = updateTransactionBodySchema.safeParse(request.body);

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

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: parsedParams.data.transactionId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      select: {
        id: true,
        table: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!transaction) {
      return reply.status(404).send({ message: 'Transação não encontrada.' });
    }

    if (transaction.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Não é possível alterar transações de mesa encerrada.' });
    }

    const updatedTransaction = await prisma.transaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        type: parsedBody.data.type,
        amountCents: parsedBody.data.amountCents,
        note: parsedBody.data.note,
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
    });

    return { transaction: updatedTransaction };
  });

  app.delete('/:transactionId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Transactions'],
      summary: 'Excluir transação',
      description: 'Remove uma transação de uma mesa aberta.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', format: 'uuid' },
        },
        required: ['transactionId'],
      },
      response: {
        204: { type: 'null', description: 'Transação removida com sucesso.' },
        400: txErrorSchema,
        401: txErrorSchema,
        404: txErrorSchema,
        409: txErrorSchema,
      },
    },
  }, async (request, reply) => {
    const parsedParams = transactionPathSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: 'Parâmetros inválidos.',
        errors: parsedParams.error.flatten(),
      });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: parsedParams.data.transactionId,
        table: {
          ownerUserId: request.user.id,
        },
      },
      select: {
        id: true,
        table: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!transaction) {
      return reply.status(404).send({ message: 'Transação não encontrada.' });
    }

    if (transaction.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Não é possível remover transações de mesa encerrada.' });
    }

    await prisma.transaction.delete({
      where: {
        id: transaction.id,
      },
    });

    return reply.status(204).send();
  });
};
