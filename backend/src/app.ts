import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';

import { corsOrigins } from './config/env';
import { authRoutes } from './modules/auth/routes';
import { playersRoutes } from './modules/players/routes';
import { tablesRoutes } from './modules/tables/routes';
import { transactionsRoutes } from './modules/transactions/routes';

export const app = Fastify({ logger: true });

app.get(
	'/health',
	{
		schema: {
			tags: ['Health'],
			summary: 'Health check da API',
			description: 'Retorna uma mensagem simples para validar disponibilidade da aplicação.',
			response: {
				200: {
					type: 'object',
					properties: {
						message: { type: 'string' },
					},
					required: ['message'],
				},
			},
		},
	},
	async () => ({ message: 'hello world' }),
);

app.register(cors, {
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	origin: (origin, callback) => {
		if (!origin) {
			callback(null, true);
			return;
		}

		const isAllowed = corsOrigins.includes(origin);
		callback(null, isAllowed);
	},
});

app.register(swagger, {
	openapi: {
		info: {
			title: 'Poker Cash API',
			description: 'API para gestão de mesas de poker cash game, jogadores e transações financeiras.',
			version: '1.0.0',
		},
		servers: [
			{
				url: 'http://localhost:3333',
				description: 'Ambiente local',
			},
		],
		tags: [
			{ name: 'Health', description: 'Status e disponibilidade da API' },
			{ name: 'Auth', description: 'Autenticação e sessão' },
			{ name: 'Tables', description: 'Gestão de mesas de cash game' },
			{ name: 'Players', description: 'Gestão de jogadores nas mesas' },
			{ name: 'Transactions', description: 'Lançamentos financeiros por jogador' },
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'Informe o token no formato: Bearer <token>.',
				},
			},
		},
	},
});

app.register(swaggerUi, {
	routePrefix: '/docs',
	uiConfig: {
		docExpansion: 'list',
		deepLinking: false,
	},
	staticCSP: true,
	transformStaticCSP: (header) => header,
});

app.register(authRoutes, { prefix: '/auth' });
app.register(tablesRoutes, { prefix: '/tables' });
app.register(playersRoutes, { prefix: '/players' });
app.register(transactionsRoutes, { prefix: '/transactions' });

app.setErrorHandler((error, _request, reply) => {
	if (error instanceof ZodError) {
		return reply.status(400).send({
			message: 'Dados inválidos.',
			errors: error.flatten(),
		});
	}

	app.log.error(error);

	return reply.status(500).send({
		message: 'Erro interno do servidor.',
	});
});
