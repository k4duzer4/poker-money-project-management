import type { FastifyInstance } from 'fastify';
import { PlayerStatus, TableStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../../db/prisma';
import { requireAuth } from '../../shared/middlewares/auth';

const playerResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    tableId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'LEFT'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'tableId', 'name', 'status', 'createdAt'],
} as const;

const messageErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  required: ['message'],
} as const;

export const playersRoutes = async (app: FastifyInstance) => {
  const tablePathSchema = z.object({
    tableId: z.string().uuid(),
  });

  const playerPathSchema = z.object({
    playerId: z.string().uuid(),
  });

  const createPlayerBodySchema = z.object({
    name: z.string().trim().min(1),
  }).strict();

  const updatePlayerBodySchema = z.object({
    name: z.string().trim().min(1),
  }).strict();

  app.get('/table/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Listar jogadores da mesa',
      description: 'Retorna os jogadores de uma mesa do usuário autenticado.',
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
            players: {
              type: 'array',
              items: playerResponseSchema,
            },
          },
          required: ['players'],
        },
        400: messageErrorSchema,
        401: messageErrorSchema,
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
      select: {
        id: true,
      },
    });

    if (!table) {
      return reply.status(404).send({ message: 'Mesa não encontrada.' });
    }

    const players = await prisma.tablePlayer.findMany({
      where: {
        tableId: table.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return { players };
  });

  app.post('/table/:tableId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Adicionar jogador',
      description: 'Adiciona um novo jogador em uma mesa aberta.',
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
        },
        required: ['name'],
        additionalProperties: false,
      },
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
      return reply.status(409).send({ message: 'Não é possível adicionar jogador em mesa encerrada.' });
    }

    const player = await prisma.tablePlayer.create({
      data: {
        tableId: table.id,
        name: parsedBody.data.name,
      },
    });

    return reply.status(201).send({ player });
  });

  app.patch('/:playerId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Renomear jogador',
      description: 'Atualiza o nome de um jogador de uma mesa do usuário.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          playerId: { type: 'string', format: 'uuid' },
        },
        required: ['playerId'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
        },
        required: ['name'],
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            player: playerResponseSchema,
          },
          required: ['player'],
        },
        400: messageErrorSchema,
        401: messageErrorSchema,
        404: messageErrorSchema,
      },
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
      select: {
        id: true,
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    const updatedPlayer = await prisma.tablePlayer.update({
      where: { id: player.id },
      data: {
        name: parsedBody.data.name,
      },
    });

    return { player: updatedPlayer };
  });

  app.patch('/:playerId/leave', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Marcar saída do jogador',
      description: 'Altera o status do jogador para LEFT.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          playerId: { type: 'string', format: 'uuid' },
        },
        required: ['playerId'],
      },
      response: {
        200: {
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
      select: {
        id: true,
        status: true,
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    if (player.status === PlayerStatus.LEFT) {
      return reply.status(409).send({ message: 'Jogador já está marcado como saiu.' });
    }

    const updatedPlayer = await prisma.tablePlayer.update({
      where: { id: player.id },
      data: {
        status: PlayerStatus.LEFT,
      },
    });

    return { player: updatedPlayer };
  });

  app.patch('/:playerId/reactivate', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Reativar jogador',
      description: 'Altera o status do jogador para ACTIVE em mesa aberta.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          playerId: { type: 'string', format: 'uuid' },
        },
        required: ['playerId'],
      },
      response: {
        200: {
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
      select: {
        id: true,
        status: true,
        table: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    if (player.table.status === TableStatus.CLOSED) {
      return reply.status(409).send({ message: 'Não é possível reativar jogador em mesa encerrada.' });
    }

    if (player.status === PlayerStatus.ACTIVE) {
      return reply.status(409).send({ message: 'Jogador já está ativo.' });
    }

    const updatedPlayer = await prisma.tablePlayer.update({
      where: { id: player.id },
      data: {
        status: PlayerStatus.ACTIVE,
      },
    });

    return { player: updatedPlayer };
  });

  app.delete('/:playerId', {
    preHandler: requireAuth,
    schema: {
      tags: ['Players'],
      summary: 'Remover jogador',
      description: 'Remove jogador sem transações associadas.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          playerId: { type: 'string', format: 'uuid' },
        },
        required: ['playerId'],
      },
      response: {
        204: { type: 'null', description: 'Jogador removido com sucesso.' },
        400: messageErrorSchema,
        401: messageErrorSchema,
        404: messageErrorSchema,
        409: messageErrorSchema,
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
      select: {
        id: true,
      },
    });

    if (!player) {
      return reply.status(404).send({ message: 'Jogador não encontrado.' });
    }

    const playerTransactionCount = await prisma.transaction.count({
      where: {
        tablePlayerId: player.id,
      },
    });

    if (playerTransactionCount > 0) {
      return reply.status(409).send({
        message: 'Não é possível remover jogador com transações registradas.',
      });
    }

    await prisma.tablePlayer.delete({
      where: {
        id: player.id,
      },
    });

    return reply.status(204).send();
  });
};
